import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
}

export default function Toast({ message, type = 'info', onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getStyles = () => {
    switch (type) {
      case 'success':
        return { border: 'border-l-status-success', icon: <CheckCircle2 className="h-5 w-5 text-status-success" /> };
      case 'error':
        return { border: 'border-l-severity-high', icon: <AlertCircle className="h-5 w-5 text-severity-high" /> };
      case 'info':
      default:
        return { border: 'border-l-primary', icon: <Info className="h-5 w-5 text-primary" /> };
    }
  };

  const { border, icon } = getStyles();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 fade-in duration-300">
      <div className={`bg-surface shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-lg p-4 pr-10 flex items-center gap-3 border border-border border-l-4 ${border} min-w-[300px] max-w-[90vw] relative`}>
        {icon}
        <p className="text-body-md text-text-primary font-medium">{message}</p>
        <button onClick={onClose} className="absolute right-2 top-2 p-1 text-text-secondary hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
