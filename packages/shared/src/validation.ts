const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function isValidEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || /\s/.test(email)) return false;

  const parts = email.split("@");
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9-]+$/.test(label))) return false;
  if (labels.some((label) => label.startsWith("-") || label.endsWith("-"))) return false;
  if (!/^[a-z]{2,24}$/.test(labels[labels.length - 1] ?? "")) return false;

  if (GMAIL_DOMAINS.has(domain)) {
    if (!/^[a-z0-9._%+-]+$/.test(local)) return false;
    if (local.includes("..") || local.startsWith(".") || local.endsWith(".")) return false;
  }

  return true;
}

export function normalizeIndianMobile(value: string): string | null {
  const stripped = value.replace(/[\s()-]/g, "");
  const withoutCountry = stripped.startsWith("+91")
    ? stripped.slice(3)
    : stripped.startsWith("91") && stripped.length === 12
      ? stripped.slice(2)
      : stripped;

  if (!/^[6-9]\d{9}$/.test(withoutCountry)) return null;
  return withoutCountry;
}

export function isValidIndianMobile(value: string): boolean {
  return normalizeIndianMobile(value) !== null;
}

export function isValidPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value)
  );
}

export function maskMobile(mobile: string): string {
  const normalized = normalizeIndianMobile(mobile);
  if (!normalized) return "***";
  return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
}
