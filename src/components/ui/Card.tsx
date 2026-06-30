import React, { useId } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'standard' | 'elevated';
  children?: React.ReactNode;
  onClick?: () => void;
}

export default function Card({
  variant = 'standard',
  className = '',
  children,
  onClick,
  ...props
}: CardProps) {
  const baseStyles = 'bg-surface border border-border rounded-xl p-4 text-left w-full';
  const shadow =
    variant === 'elevated'
      ? 'shadow-[0_4px_12px_rgba(0,0,0,0.12)]'
      : 'shadow-[0_1px_3px_rgba(0,0,0,0.08)]';
  const interactive = onClick ? 'cursor-pointer hover:border-primary/30 transition-all' : '';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseStyles} ${shadow} ${interactive} ${className}`}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={`${baseStyles} ${shadow} ${className}`} {...props}>
      {children}
    </div>
  );
}
