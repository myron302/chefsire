/** Only same-origin paths may follow sign-in; auth entry paths would loop. */
export function authEntryDestination(search: string): string {
  const value = new URLSearchParams(search).get("next");
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/feed";
  try {
    const url = new URL(value, "https://chefsire.invalid");
    if (url.origin !== "https://chefsire.invalid" || /^\/(login|signup|verify-email|verify\/success)\/?$/i.test(decodeURIComponent(url.pathname))) return "/feed";
    return url.pathname + url.search + url.hash;
  } catch { return "/feed"; }
}

export function authEntryLink(path: "/login" | "/signup" | "/verify-email" | "/api/auth/google", search: string) {
  const destination = authEntryDestination(search);
  return destination === "/feed" ? path : `${path}?next=${encodeURIComponent(destination)}`;
}
