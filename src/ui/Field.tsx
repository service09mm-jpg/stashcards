import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Кнопка праворуч у полі — наприклад, «сканувати». */
  action?: ReactNode;
};

/**
 * Поле вводу.
 *
 * Розмір тексту навмисно не менший за 16px: Safari на iPhone автоматично
 * наближає сторінку, коли фокус потрапляє в дрібніше поле, і після цього
 * розмітка лишається зміщеною.
 */
export function Field({ label, hint, error, action, className = "", ...props }: Props) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <input
          {...props}
          className={`min-h-12 w-full rounded-2xl border bg-surface px-4 text-base text-text outline-none placeholder:text-muted/50 focus:border-muted ${
            error ? "border-danger" : "border-line"
          } ${className}`}
        />
        {action}
      </span>
      {error ? (
        <span className="mt-1.5 block text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
