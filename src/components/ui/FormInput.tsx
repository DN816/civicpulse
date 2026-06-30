import React, { useId } from 'react';

type BaseInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'type'>;

interface FormInputProps extends BaseInputProps {
  label?: string;
  error?: string;
  isTextArea?: boolean;
  type?: string;
  id?: string;
}

export default function FormInput({
  label,
  error,
  isTextArea = false,
  className = '',
  id: idProp,
  ...props
}: FormInputProps) {
  const autoId = useId();
  const inputId = idProp ?? autoId;

  const baseInputStyles = `
    w-full border-[1.5px] border-border rounded-lg px-4 text-body-lg text-text-primary bg-surface
    focus:outline-none focus:ring-0 focus:border-primary focus:border-2 transition-all
    placeholder:text-text-secondary
  `;

  const errorStyles = error ? '!border-severity-high !border-2' : '';
  const heightStyles = isTextArea ? 'min-h-[96px] py-3 resize-y' : 'h-12';
  const combinedStyles = `${baseInputStyles} ${errorStyles} ${heightStyles} ${className}`;

  return (
    <div className="flex flex-col w-full">
      {label && (
        <label htmlFor={inputId} className="text-label font-medium text-text-primary mb-1.5">
          {label}
        </label>
      )}

      {isTextArea ? (
        <textarea
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={combinedStyles}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={combinedStyles}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {error && (
        <p id={`${inputId}-error`} className="text-caption text-severity-high mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
