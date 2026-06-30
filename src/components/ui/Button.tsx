import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'text' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  let baseStyles = 'font-bold transition-all flex justify-center items-center gap-2 ';

  if (variant === 'primary') {
    baseStyles +=
      'bg-primary hover:bg-primary-dark text-text-inverse rounded-xl h-12 px-6 text-sm border-4 border-border neo-3d disabled:opacity-50 disabled:cursor-not-allowed ';
  } else if (variant === 'secondary') {
    baseStyles +=
      'bg-surface-container-lowest border-4 border-border text-text-primary hover:bg-surface-container-high rounded-xl h-12 px-6 text-sm neo-3d disabled:opacity-50 ';
  } else if (variant === 'destructive') {
    baseStyles +=
      'bg-severity-high hover:bg-red-700 text-text-inverse rounded-xl h-12 px-6 text-sm border-4 border-border neo-3d disabled:opacity-50 ';
  } else if (variant === 'text') {
    baseStyles += 'bg-transparent border-none text-primary hover:underline text-sm disabled:opacity-50 ';
  } else if (variant === 'icon') {
    baseStyles +=
      'h-10 w-10 p-0 rounded-xl border-2 border-border hover:bg-surface-container-high text-on-surface-variant hover:text-text-primary flex items-center justify-center ';
  }

  if (fullWidth && variant !== 'icon' && variant !== 'text') {
    baseStyles += 'w-full ';
  }

  return (
    <button className={`${baseStyles} ${className}`} {...props}>
      {children}
    </button>
  );
}
