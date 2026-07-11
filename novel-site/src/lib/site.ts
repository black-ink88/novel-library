export function sitePath(pathname = "/"): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = pathname.replace(/^\//, "");
  return `${base}/${path}`;
}
