const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors = Partial<Record<string, string>>;

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Email is required.";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(value: string, label = "Password"): string | null {
  if (!value) return `${label} is required.`;
  if (value.length < 8) return `${label} must be at least 8 characters.`;
  if (value.length > 128) return `${label} must be at most 128 characters.`;
  return null;
}

export function validateFullName(value: string): string | null {
  const v = value.trim();
  if (!v) return "Full name is required.";
  if (v.length > 255) return "Full name is too long.";
  return null;
}

export function validateLoginForm(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const e = validateEmail(email);
  if (e) errors.email = e;
  if (!password) errors.password = "Password is required.";
  return errors;
}

export function validateRegisterForm(
  fullName: string,
  email: string,
  password: string,
  confirmPassword: string,
): FieldErrors {
  const errors: FieldErrors = {};
  const n = validateFullName(fullName);
  if (n) errors.fullName = n;
  const e = validateEmail(email);
  if (e) errors.email = e;
  const p = validatePassword(password);
  if (p) errors.password = p;
  if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
  return errors;
}
