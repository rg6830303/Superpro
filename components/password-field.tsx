"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * A password input with a reveal toggle.
 *
 * Typing a password blind is where most sign-in failures actually come from,
 * and it is worse on a phone keyboard. The toggle is a button rather than a
 * checkbox so it can sit inside the field, and it never submits the form.
 *
 * The control reports its state through `aria-pressed` and the input keeps its
 * autocomplete hint, so password managers still behave normally.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required = false,
  minLength,
  hint,
  error,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  hint?: string;
  error?: string | null;
}) {
  const generated = useId();
  const inputId = id ?? `pw-${generated}`;
  const [shown, setShown] = useState(false);

  return (
    <div>
      <label className="label" htmlFor={inputId}>
        {label}
        {required && <span className="ml-1 text-signal">*</span>}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          className="field pr-12"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          // Revealed passwords must not be autocorrected or capitalised.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"}
          title={shown ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 grid h-9 w-10 -translate-y-1/2 place-items-center rounded-md text-ink/45 transition-colors hover:bg-mist hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
        >
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {hint && !error && <p className="mt-1.5 text-[11px] text-ink/50">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
