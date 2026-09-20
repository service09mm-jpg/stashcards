import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

const VARIANTS: Record<Variant, string> = {
  primary: "bg-text text-ink active:bg-muted",
  ghost: "bg-surface text-text active:bg-surface-2",
  danger: "bg-transparent text-danger active:bg-surface",
};

/**
 * Кнопка.
 *
 * `min-h-12` не декоративне обмеження: це приблизний розмір подушечки пальця,
 * нижче якого в кнопку перестають влучати. Застосунком користуються однією
 * рукою, на ходу, тож усе, що натискається, має бути великим.
 */
export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-medium transition-colors disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}
