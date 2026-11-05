"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  title?: string;
  message: string;
  type?: ToastType;
}

interface ToastContextValue {
  toast: (options: { message: string; title?: string; type?: ToastType; duration?: number }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({
      message,
      title,
      type = "info",
      duration = 4000,
    }: {
      message: string;
      title?: string;
      type?: ToastType;
      duration?: number;
    }) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newToast: Toast = { id, title, message, type };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const value: ToastContextValue = {
    toast: addToast,
    success: (msg, title) => addToast({ message: msg, title, type: "success" }),
    error: (msg, title) => addToast({ message: msg, title, type: "error" }),
    info: (msg, title) => addToast({ message: msg, title, type: "info" }),
    warning: (msg, title) => addToast({ message: msg, title, type: "warning" }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container overlay */}
      <div className="fixed bottom-6 right-6 z-[950] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const isSuccess = t.type === "success";
          const isError = t.type === "error";
          const isWarning = t.type === "warning";

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 border-2 transition-all duration-200 animate-in slide-in-from-bottom-3 ${
                isSuccess
                  ? "bg-[#131415] text-white border-[#CCF2DF]"
                  : isError
                  ? "bg-[#181214] text-white border-rose-500"
                  : isWarning
                  ? "bg-[#161412] text-white border-amber-500"
                  : "bg-[#131415] text-white border-[#303132]"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#CCF2DF]" />}
                {isError && <AlertCircle className="w-4 h-4 text-rose-400" />}
                {isWarning && <AlertCircle className="w-4 h-4 text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-white" />}
              </div>

              <div className="flex-1 min-w-0">
                {t.title && (
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white">
                    {t.title}
                  </div>
                )}
                <div className="text-xs leading-relaxed text-[#B8B9B9] break-words mt-0.5">
                  {t.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-[#B8B9B9] hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback if invoked outside provider
    return {
      toast: ({ message }) => console.log(message),
      success: (msg) => console.log(msg),
      error: (msg) => console.error(msg),
      info: (msg) => console.log(msg),
      warning: (msg) => console.warn(msg),
    };
  }
  return ctx;
}
