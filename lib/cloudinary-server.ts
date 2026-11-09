import { v2 as cloudinary } from "cloudinary";
import { r2Configurado, subirImagenAR2 } from "@/lib/r2";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

/**
 * Sube una imagen y devuelve su dirección pública.
 *
 * Si R2 está configurado (variables R2_*), la imagen va a Cloudflare R2.
 * Si no, se usa Cloudinary como antes. El nombre se mantiene para no tocar
 * las rutas que ya la llaman.
 */
export async function uploadToCloudinary(
  file: File,
  folder: string
): Promise<string> {
  if (r2Configurado()) {
    return subirImagenAR2(file, folder);
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "image" }, (err, result) => {
        if (err || !result) return reject(err ?? new Error("Upload failed"));
        resolve(result.secure_url);
      })
      .end(buffer);
  });
}
