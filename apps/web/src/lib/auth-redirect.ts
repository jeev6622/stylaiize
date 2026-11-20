export const DEFAULT_POST_LOGIN_URL = "https://www.stylaiize.site/";

function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;
  return value;
}

export function getPostLoginRedirect(searchParams?: URLSearchParams | null): string {
  const intended = safeInternalPath(
    searchParams?.get("next") ?? searchParams?.get("returnTo"),
  );
  return intended ?? DEFAULT_POST_LOGIN_URL;
}

export function redirectAfterLogin(searchParams?: URLSearchParams | null): void {
  window.location.assign(getPostLoginRedirect(searchParams));
}
