/**
 * Cloudinary Helper & Optimizer
 */

/**
 * Optimizes a Cloudinary image URL by injecting dynamic width, limit scaling,
 * automatic modern format (AVIF/WebP), and automatic quality optimization
 * (w_{width},c_limit,f_auto,q_auto).
 *
 * @param url Original image URL (handles falsy, external URLs, and existing transforms)
 * @param width Target width in pixels (defaults to 600)
 * @returns The optimized URL string, or the untouched original URL if not applicable
 */
export function getOptimizedCloudinaryUrl(
  url?: string | null,
  width: number = 600
): string {
  if (!url || typeof url !== "string") {
    return url ?? "";
  }

  // Only transform Cloudinary URLs
  if (!url.includes("res.cloudinary.com")) {
    return url;
  }

  const uploadSegment = "/image/upload/";
  const uploadIndex = url.indexOf(uploadSegment);
  if (uploadIndex === -1) {
    return url;
  }

  const afterUpload = url.slice(uploadIndex + uploadSegment.length);

  // Check if transformations are already present (w_..., f_auto, q_auto, c_limit, etc.)
  if (
    afterUpload.startsWith("w_") ||
    afterUpload.startsWith("f_auto") ||
    afterUpload.startsWith("q_auto") ||
    afterUpload.startsWith("c_") ||
    /(?:^|\/)(?:w_\d+|f_auto|q_auto|c_limit)(?:[,\/]|$)/.test(afterUpload)
  ) {
    return url;
  }

  const transformation = `w_${width},c_limit,f_auto,q_auto`;
  return `${url.slice(0, uploadIndex + uploadSegment.length)}${transformation}/${afterUpload}`;
}

export const cloudinaryUrl = getOptimizedCloudinaryUrl;
