'use client';

import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MobileMenuProps {
  links: Array<{ href: string; label: string }>;
}

export function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-secondary hover:text-fg hover:bg-elevated transition-colors lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div
            className="absolute top-0 left-0 right-0 bg-page border-b border-themed shadow-xl"
            style={{ animation: 'fadeUp 0.2s ease-out' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-themed">
              <span className="font-display text-lg font-bold text-fg">PlayStake</span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-secondary hover:text-fg hover:bg-elevated transition-colors"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex flex-col px-6 py-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="py-4 text-base font-medium text-fg hover:text-brand-600 transition-colors border-b border-themed last:border-b-0"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex flex-col gap-3 px-6 pb-6 pt-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center h-12 rounded-lg border border-themed text-fg font-medium hover:bg-elevated transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center h-12 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
