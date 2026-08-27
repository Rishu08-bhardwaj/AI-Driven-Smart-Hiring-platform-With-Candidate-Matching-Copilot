/**
 * Thin form controls designed for react-hook-form. Spread `register('name')`
 * onto them and pass `error` (the RHF field error) for inline validation text.
 */
import { forwardRef } from 'react';

function Wrapper({ label, error, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && <p className="field-error">{error.message}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, required, className, ...props }, ref) {
  return (
    <Wrapper label={label} error={error} required={required} className={className}>
      <input ref={ref} className="input" {...props} />
    </Wrapper>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, required, className, rows = 3, ...props }, ref) {
  return (
    <Wrapper label={label} error={error} required={required} className={className}>
      <textarea ref={ref} rows={rows} className="input" {...props} />
    </Wrapper>
  );
});

export const Select = forwardRef(function Select({ label, error, required, className, children, ...props }, ref) {
  return (
    <Wrapper label={label} error={error} required={required} className={className}>
      <select ref={ref} className="input" {...props}>
        {children}
      </select>
    </Wrapper>
  );
});

/** Build <option> list from a {value: label} map or [{value,label}] array. */
export function Options({ map, placeholder = 'Select…', includeEmpty = true }) {
  const entries = Array.isArray(map) ? map.map((o) => [o.value, o.label]) : Object.entries(map);
  return (
    <>
      {includeEmpty && <option value="">{placeholder}</option>}
      {entries.map(([value, label]) => (
        <option key={value} value={value}>
          {typeof label === 'object' ? label.label : label}
        </option>
      ))}
    </>
  );
}
