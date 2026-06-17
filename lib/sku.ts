export function generateSku(productName: string, size: string): string {
  const slug = productName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 12)
    .replace(/^-|-$/g, "");
  const sizeSlug = size.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const suffix = Date.now().toString(36).toUpperCase().slice(-5);
  return `${slug}-${sizeSlug}-${suffix}`;
}
