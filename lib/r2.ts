/**
 * Subida de imágenes a Cloudflare R2 (API compatible con S3).
 *
 * Implementado con `crypto` y `fetch` de Node, sin dependencias externas.
 * Firma las peticiones con AWS Signature V4, que es lo que exige R2.
 *
 * Variables de entorno:
 *   R2_ENDPOINT           https://<account-id>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID      Access Key ID del token de R2
 *   R2_SECRET_ACCESS_KEY  Secret Access Key del token de R2
 *   R2_BUCKET             nombre del bucket (p. ej. cenicola-imagenes)
 *   R2_PUBLIC_URL         dirección pública del bucket (p. ej. https://img.quefranelas.com)
 */
import crypto from "crypto";

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
};

export function r2Configurado(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
  );
}

function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function codificarRuta(ruta: string): string {
  // Codificación RFC 3986 por segmento, como exige SigV4 para S3.
  return ruta
    .split("/")
    .map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()))
    .join("/");
}

/**
 * Calcula la cabecera Authorization de AWS Signature V4.
 * Exportada para poder verificarla con los vectores de prueba de AWS.
 */
export function firmarSigV4(opts: {
  metodo: string;
  host: string;
  ruta: string; // ya codificada
  cabeceras: Record<string, string>; // en minúsculas, sin "host"
  hashCuerpo: string;
  fechaAmz: string; // YYYYMMDDTHHMMSSZ
  region: string;
  servicio: string;
  accessKeyId: string;
  secretAccessKey: string;
}): { authorization: string; signedHeaders: string } {
  const todas: Record<string, string> = { ...opts.cabeceras, host: opts.host };
  const nombres = Object.keys(todas).map((k) => k.toLowerCase()).sort();
  const canonicas = nombres.map((k) => `${k}:${String(todas[k]).trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = nombres.join(";");
  const peticionCanonica = [opts.metodo, opts.ruta, "", canonicas, signedHeaders, opts.hashCuerpo].join("\n");

  const fecha = opts.fechaAmz.slice(0, 8);
  const ambito = `${fecha}/${opts.region}/${opts.servicio}/aws4_request`;
  const textoAFirmar = ["AWS4-HMAC-SHA256", opts.fechaAmz, ambito, sha256Hex(peticionCanonica)].join("\n");

  const kFecha = hmac(`AWS4${opts.secretAccessKey}`, fecha);
  const kRegion = hmac(kFecha, opts.region);
  const kServicio = hmac(kRegion, opts.servicio);
  const kFirma = hmac(kServicio, "aws4_request");
  const firma = crypto.createHmac("sha256", kFirma).update(textoAFirmar).digest("hex");

  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${ambito}, SignedHeaders=${signedHeaders}, Signature=${firma}`,
    signedHeaders,
  };
}

/** Sube un archivo a R2 y devuelve su dirección pública. */
export async function subirAR2(cuerpo: Buffer, clave: string, tipoContenido: string): Promise<string> {
  if (!r2Configurado()) throw new Error("R2 no está configurado");
  const endpoint = new URL(process.env.R2_ENDPOINT!);
  const bucket = process.env.R2_BUCKET!;
  const claveCodificada = codificarRuta(clave);
  const ruta = `/${encodeURIComponent(bucket)}/${claveCodificada}`;
  const fechaAmz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const hashCuerpo = sha256Hex(cuerpo);

  const cabeceras: Record<string, string> = {
    "cache-control": "public, max-age=31536000, immutable",
    "content-type": tipoContenido,
    "x-amz-content-sha256": hashCuerpo,
    "x-amz-date": fechaAmz,
  };
  const { authorization } = firmarSigV4({
    metodo: "PUT",
    host: endpoint.host,
    ruta,
    cabeceras,
    hashCuerpo,
    fechaAmz,
    region: "auto",
    servicio: "s3",
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  });

  const res = await fetch(`${endpoint.origin}${ruta}`, {
    method: "PUT",
    headers: { ...cabeceras, authorization },
    body: new Uint8Array(cuerpo),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Error subiendo a R2 (${res.status}): ${detalle.slice(0, 300)}`);
  }
  return `${process.env.R2_PUBLIC_URL!.replace(/\/+$/, "")}/${claveCodificada}`;
}

/** Sube una imagen recibida en un formulario a `carpeta/` con un nombre único. */
export async function subirImagenAR2(archivo: File, carpeta: string): Promise<string> {
  const cuerpo = Buffer.from(await archivo.arrayBuffer());
  const tipo = (archivo.type || "image/jpeg").toLowerCase();
  const ext = EXTENSIONES[tipo] ?? (archivo.name.split(".").pop() || "jpg").toLowerCase();
  const carpetaLimpia = carpeta.replace(/^\/+|\/+$/g, "");
  const clave = `${carpetaLimpia}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  return subirAR2(cuerpo, clave, tipo);
}
