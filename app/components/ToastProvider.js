'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({
  showToast: (message, type = 'info') => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const borderColor =
            t.type === 'error' ? 'var(--red)' :
            t.type === 'success' ? 'var(--green)' :
            t.type === 'warning' ? 'var(--yellow)' : 'var(--accent)';

          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                background: 'var(--surface)',
                borderLeft: `4px solid ${borderColor}`,
                borderTop: '1px solid var(--border)',
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '12px 16px',
                minWidth: 280,
                maxWidth: 400,
                fontSize: 13,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                animation: 'slideIn 0.2s ease-out',
                borderRadius: '0px', // Strict 0px radius enforcement
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, color: borderColor }}>
                  {t.type === 'error' ? '✕' : t.type === 'success' ? '✓' : t.type === 'warning' ? '⚠' : 'ℹ'}
                </span>
                <span>{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  marginLeft: 12,
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
