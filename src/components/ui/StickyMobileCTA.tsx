/**
 * Sticky bottom CTA bar — visible on mobile only (hidden at md+).
 * Sits above the native home indicator via safe-area-inset-bottom.
 * Background adapts to the active theme (light/dark).
 */
export function StickyMobileCTA() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-themed"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg) 95%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex gap-3 px-4 pt-3">
        <a
          href="#beta-signup"
          className="flex flex-1 items-center justify-center rounded-lg bg-brand-500 text-surface-950 font-bold text-sm tracking-wide transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
          style={{ minHeight: 44 }}
          aria-label="Join the PlayStake beta waitlist"
        >
          Join Beta
        </a>
        <a
          href="#how-it-works"
          className="flex flex-1 items-center justify-center rounded-lg font-semibold text-sm transition-all active:scale-[0.97] border border-brand-600/40 text-brand-700 dark:border-brand-500/35 dark:text-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
          style={{ minHeight: 44 }}
          aria-label="See how PlayStake works"
        >
          How It Works
        </a>
      </div>
    </div>
  );
}
