export function buildPublicImageUrl(req, filename) {
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl.replace(/\/$/, '')}/uploads/${filename}`;
}
