import imageCompression from "browser-image-compression";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export function validateImageFile(
  file: File,
  opts: { validTypes?: string[]; maxMb?: number } = {}
): string | null {
  const types = opts.validTypes ?? VALID_IMAGE_TYPES;
  if (!types.includes(file.type)) {
    return "Formato no soportado. Solo se permiten imágenes JPG, PNG o WEBP.";
  }
  if (opts.maxMb !== undefined && file.size > opts.maxMb * 1024 * 1024) {
    return `La imagen no puede superar ${opts.maxMb} MB.`;
  }
  return null;
}

// Samples a small region of the image to detect transparency, avoiding a full decode.
async function hasAlphaChannel(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(img.naturalWidth, size);
      canvas.height = Math.min(img.naturalHeight, size);
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); resolve(false); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) { resolve(true); return; }
      }
      resolve(false);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

/**
 * Compresses and resizes an image client-side before upload.
 * - Max dimension: 1200px (longest side, aspect ratio preserved)
 * - Quality: ~80%
 * - PNG without transparency is converted to JPEG
 * - GIFs are returned as-is (animation would be destroyed by canvas)
 */
export async function optimizeImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  let targetType = file.type;
  if (file.type === "image/png") {
    const alpha = await hasAlphaChannel(file);
    if (!alpha) targetType = "image/jpeg";
  }

  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1200,
    initialQuality: 0.8,
    fileType: targetType,
    useWebWorker: true,
  });

  // Fix the filename extension when the format changed (PNG → JPEG)
  if (compressed.type !== file.type) {
    const ext = compressed.type === "image/jpeg" ? "jpg" : (compressed.type.split("/")[1] ?? "jpg");
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([compressed], `${baseName}.${ext}`, { type: compressed.type });
  }

  return compressed;
}