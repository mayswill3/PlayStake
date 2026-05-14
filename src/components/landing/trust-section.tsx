import { ShieldCheck, SlidersHorizontal, UserCheck, AlertTriangle, Scale } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

const PILLARS = [
  {
    icon: UserCheck,
    title: 'KYC & Age Verification',
    body: 'All players will verify their identity and confirm they are 18 or older before any real-money play is enabled. PlayStake uses industry-standard verification providers.',
    accent: 'green' as const,
  },
  {
    icon: SlidersHorizontal,
    title: 'Stake Limits & Controls',
    body: 'Players can set daily, weekly, or per-match stake limits. Limits can always be lowered instantly; increases require a 48-hour cooling period.',
    accent: 'cyan' as const,
  },
  {
    icon: ShieldCheck,
    title: 'Anti-Cheat & Fairness',
    body: 'Results are validated via two independent sources. Match logs are stored for dispute review. Accounts found manipulating results are permanently suspended.',
    accent: 'green' as const,
  },
  {
    icon: Scale,
    title: 'Dispute Resolution',
    body: 'Either player can raise a dispute within 24 hours of a result. Our team reviews game logs and evidence, aiming to resolve all disputes within 24 hours.',
    accent: 'cyan' as const,
  },
  {
    icon: AlertTriangle,
    title: 'Responsible Play First',
    body: 'Self-exclusion, cool-down periods, and links to gambling support organisations are built into the platform — not afterthoughts tacked on later.',
    accent: 'green' as const,
  },
] as const;

export function TrustSection() {
  return (
    <section id="trust" className="py-20 lg:py-28 bg-page">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">
            Trust & Safety
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-fg">
            Built to Be Trusted
          </h2>
          <p className="mt-4 text-fg-secondary max-w-2xl mx-auto">
            PlayStake is being built with responsible play, verification, and regulatory
            readiness at the core — before the first real-money match is played.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PILLARS.map(({ icon: Icon, title, body, accent }) => (
            <GlassCard key={title} padding="md" neon={accent}>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl mb-4"
                style={{
                  background:
                    accent === 'green'
                      ? 'rgba(34,197,94,0.10)'
                      : 'rgba(6,182,212,0.10)',
                }}
              >
                <Icon
                  size={20}
                  className={accent === 'green' ? 'text-brand-400' : 'text-accent-400'}
                  aria-hidden="true"
                />
              </div>
              <h3 className="font-display text-base font-bold text-fg mb-2">{title}</h3>
              <p className="text-sm text-fg-secondary leading-relaxed">{body}</p>
            </GlassCard>
          ))}
        </div>

        {/* Regulatory note */}
        <p className="mt-10 text-center text-xs text-fg-muted max-w-2xl mx-auto px-4">
          PlayStake does not currently hold a gambling licence. Real-money play will not
          be enabled until all applicable regulatory requirements have been met in each
          operating territory. Beta gameplay is for testing purposes only.
        </p>
      </div>
    </section>
  );
}
