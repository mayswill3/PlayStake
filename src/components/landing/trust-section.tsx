import { ShieldCheck, SlidersHorizontal, UserCheck, Scale } from 'lucide-react';
import { EyebrowPill, GlowCard, IconTile } from '@/components/ui/playstake';

const PILLARS = [
  {
    icon: <UserCheck size={24} strokeWidth={1.5} />,
    title: 'KYC & Age Verification',
    body: 'All players will verify their identity and confirm they are 18 or older before any real-money play is enabled. PlayStake uses industry-standard verification providers.',
  },
  {
    icon: <SlidersHorizontal size={24} strokeWidth={1.5} />,
    title: 'Stake Limits & Controls',
    body: 'Players can set daily, weekly, or per-match stake limits. Limits can always be lowered instantly; increases require a 48-hour cooling period.',
  },
  {
    icon: <ShieldCheck size={24} strokeWidth={1.5} />,
    title: 'Anti-Cheat & Fairness',
    body: 'Results are validated via two independent sources. Match logs are stored for dispute review. Accounts found manipulating results are permanently suspended.',
  },
  {
    icon: <Scale size={24} strokeWidth={1.5} />,
    title: 'Dispute Resolution',
    body: 'Either player can raise a dispute within 24 hours of a result. Our team reviews game logs and evidence, aiming to resolve all disputes within 24 hours.',
  },
] as const;

export function TrustSection() {
  return (
    <section id="trust" className="py-16 lg:py-24 bg-ps-paper dark:bg-ps-ink-2">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <EyebrowPill label="TRUST & SAFETY" className="mb-3" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark">
            Built on Verification.{' '}
            <span className="block ps-gradient-text">Designed for Trust.</span>
          </h2>
          <p className="mt-4 text-ps-muted dark:text-ps-muted-on-dark max-w-2xl mx-auto">
            PlayStake is being built with responsible play, verification, and regulatory
            readiness at the core — before the first real-money match is played.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {PILLARS.map(({ icon, title, body }) => (
            <GlowCard key={title} padding="md" glow="subtle">
              <IconTile icon={icon} size="md" className="mb-4" />
              <h3 className="font-display text-base font-bold text-ps-text dark:text-ps-text-on-dark mb-2">{title}</h3>
              <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark leading-relaxed">{body}</p>
            </GlowCard>
          ))}
        </div>

        {/* Regulatory note */}
        <p className="mt-10 text-center text-xs text-ps-muted dark:text-ps-muted-on-dark max-w-2xl mx-auto px-4">
          PlayStake does not currently hold a gambling licence. Real-money play will not
          be enabled until all applicable regulatory requirements have been met in each
          operating territory. Beta gameplay is for testing purposes only.
        </p>
      </div>
    </section>
  );
}
