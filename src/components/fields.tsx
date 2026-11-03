import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Base = { label: string; name: string; hint?: ReactNode };

export function TextField({ label, name, hint, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input id={name} name={name} className="input" {...rest} />
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function TextArea({ label, name, hint, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <textarea id={name} name={name} className="input min-h-28" {...rest} />
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Select({
  label,
  name,
  hint,
  options,
  placeholder,
  ...rest
}: Base & SelectHTMLAttributes<HTMLSelectElement> & {
  options: readonly (readonly [string, string])[];
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <select id={name} name={name} className="input" {...rest}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, name, ...rest }: { label: ReactNode; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-start gap-3 text-sm text-gray-700">
      <input type="checkbox" name={name} value="yes" className="mt-1 h-5 w-5 shrink-0 accent-brand-600" {...rest} />
      <span>{label}</span>
    </label>
  );
}
