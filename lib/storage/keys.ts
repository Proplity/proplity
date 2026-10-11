/** Filesystem/URL-safe version of an uploaded file name (for the tail of a key). */
export function cleanFileName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .toLowerCase();
  return base.slice(-80) || 'file';
}
