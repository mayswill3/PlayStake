/**
 * Sticky bottom CTA bar — visible on mobile only (hidden at md+).
 * Sits above the native home indicator via safe-area-inset-bottom.
 * Uses PSButton from the design system for consistent styling.
 */
import { PSButton } from '@/components/ui/playstake';

export function StickyMobileCTA() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]"
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
          className="flex-1"
          aria-label="Join the PlayStake beta waitlist"
        >
          <PSButton fullWidth size="md">
            Join Beta
          </PSButton>
        </a>
        <a
          href="#how-it-works"
          className="flex-1"
          aria-label="See how PlayStake works"
        >
          <PSButton variant="secondary" fullWidth size="md">
            How It Works
          </PSButton>
        </a>
      </div>
    </div>
  );
}
