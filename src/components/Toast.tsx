import React from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxWidth: "400px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => onDismiss(toast.id)}
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 18px",
            borderRadius: "var(--radius-sm)",
            background: "#141c2e",
            border: `1px solid ${
              toast.type === "success"
                ? "var(--primary)"
                : toast.type === "error"
                  ? "var(--accent-rose)"
                  : "var(--accent-cyan)"
            }`,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)",
            color: "#fff",
            fontSize: "13.5px",
            cursor: "pointer",
            animation: "slideIn 0.25s ease-out",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
          ) : toast.type === "error" ? (
            <AlertCircle size={16} style={{ color: "var(--accent-rose)", flexShrink: 0 }} />
          ) : (
            <Info size={16} style={{ color: "var(--accent-cyan)", flexShrink: 0 }} />
          )}
          <span style={{ flex: 1 }}>{toast.message}</span>
        </div>
      ))}
    </div>
  );
};
