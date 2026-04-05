"use client";

import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const borderColors = {
    success: 'border-l-[#00e5a0]',
    error: 'border-l-red-500',
    info: 'border-l-blue-400',
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'i',
  };

  return (
    <div
      className={`flex items-center gap-3 bg-[rgba(255,255,255,0.04)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] border-l-4 ${borderColors[toast.type]} text-white px-4 py-3 rounded-[14px] shadow-lg mb-3 mx-4 animate-slide-in-right max-w-sm`}
    >
      <div className={`font-bold flex items-center justify-center w-6 h-6 rounded-full text-xs
        ${toast.type === 'success' ? 'bg-[#00e5a0]/20 text-[#00e5a0]' : 
          toast.type === 'error' ? 'bg-red-500/20 text-red-500' : 
          'bg-blue-400/20 text-blue-400'}`}
      >
        {icons[toast.type]}
      </div>
      <p className="font-sans text-sm">{toast.message}</p>
      <button 
        onClick={() => onDismiss(toast.id)}
        className="ml-auto text-gray-400 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// Global Store for Toasts (Simple implementation for demonstration)
// In a real app, you might use Context or Zustand
let addToastExternal: (type: ToastType, message: string) => void = () => {};

export const toast = {
  success: (msg: string) => addToastExternal('success', msg),
  error: (msg: string) => addToastExternal('error', msg),
  info: (msg: string) => addToastExternal('info', msg),
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastExternal = (type: ToastType, message: string) => {
      const newToast: ToastMessage = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        message,
      };
      setToasts((prev) => [...prev, newToast]);
    };
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={handleDismiss} />
      ))}
    </div>
  );
};
