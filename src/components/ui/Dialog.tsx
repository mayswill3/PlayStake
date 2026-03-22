'use client';

import { useRef, useEffect, useCallback, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={handleBackdropClick}
      className="
        backdrop:bg-black/60 backdrop:backdrop-blur-sm
        bg-transparent p-0 m-auto
        open:animate-in open:fade-in open:zoom-in-95
        max-w-lg w-full mx-4
      "
    >
      <div className="bg-surface-850 border border-white/8 rounded-sm p-6">
        {title && (
          <div className="mb-4">
            <h2 className="text-lg font-display font-semibold text-text-primary">{title}</h2>
          </div>
        )}
        <div className="text-surface-300 font-mono">{children}</div>
        {actions && (
          <div className="mt-6 flex justify-end gap-3">{actions}</div>
        )}
      </div>
    </dialog>
  );
}
