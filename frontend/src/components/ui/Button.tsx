import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variantClass: Record<Variant, string> = {
  primary: "pp-btn pp-btn--primary",
  secondary: "pp-btn pp-btn--secondary",
  danger: "pp-btn pp-btn--danger",
  ghost: "pp-btn pp-btn--ghost",
};

export function Button({
  variant = "primary",
  type = "button",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button type={type} className={`${variantClass[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
