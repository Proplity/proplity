// A `from`/redirect query param is attacker-controlled input -- reject
// anything that isn't a same-origin relative path (a bare `//host` or
// `https://host` or backslash smuggling `/\host` value into the query string
// would otherwise send the browser off-site) before it's ever passed to router.push/replace.
export function safeRedirect(from: string | null): string | null {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return null;
  return from;
}
