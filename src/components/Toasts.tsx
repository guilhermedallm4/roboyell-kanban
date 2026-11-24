import { useEffect } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

export interface Toast {
  id: number;
  message: string;
  tone?: 'success' | 'info';
  action?: { label: string; run: () => void };
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(toast.id), toast.action ? 6000 : 3500);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);

  const Icon = toast.tone === 'info' ? Info : CheckCircle2;
  return (
    <div className={`toast toast--${toast.tone ?? 'success'}`} role="status">
      <Icon size={16} aria-hidden="true" />
      <span>{toast.message}</span>
      {toast.action && (
        <button
          className="link"
          onClick={() => {
            toast.action!.run();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="icon-btn icon-btn--sm" onClick={() => onDismiss(toast.id)} aria-label="Fechar aviso">
        <X size={14} />
      </button>
    </div>
  );
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}
