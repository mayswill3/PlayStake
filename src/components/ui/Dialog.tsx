'use client';

import { useRef, useEffect, useCallback, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** md (default) for confirmations; lg for richer content like challenges. */
  size?: 'md' | 'lg';
}

const SIZE_CLASSES = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export function Dialog({ open, onClose, title, children, actions, size = 'md' }: DialogProps) {
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
      // m-auto centres the top-layer dialog on both axes; the width leaves a
      // 1rem gutter on small screens (a horizontal margin would break centring).
      className={`
        backdrop:bg-black/60 backdrop:backdrop-blur-sm
        bg-transparent p-0 m-auto
        open:animate-in open:fade-in open:zoom-in-95
        w-[calc(100%-2rem)] ${SIZE_CLASSES[size]}
      `}
    >
      <div className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-6 shadow-2xl dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2">
        {title && (
          <div className="mb-4">
            <h2 className="text-lg font-display font-semibold text-ps-text dark:text-ps-text-on-dark">{title}</h2>
          </div>
        )}
        <div className="font-mono text-ps-muted dark:text-ps-muted-on-dark">{children}</div>
        {actions && (
          <div className="mt-6 flex justify-end gap-3">{actions}</div>
        )}
      </div>
    </dialog>
  );
}
