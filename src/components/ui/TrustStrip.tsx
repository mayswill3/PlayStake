import { ShieldCheck, SlidersHorizontal, UserCheck, Lock, HeartHandshake } from 'lucide-react';

const BADGES = [
  { icon: ShieldCheck, label: '18+ Only' },
  { icon: SlidersHorizontal, label: 'Stake Controls' },
  { icon: UserCheck, label: 'KYC Ready' },
  { icon: Lock, label: 'Secure Wallet' },
  { icon: HeartHandshake, label: 'Responsible Play' },
] as const;

interface TrustStripProps {
  className?: string;
}

export function TrustStrip({ className = '' }: TrustStripProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 sm:gap-4 ${className}`}
      role="list"
      aria-label="Trust and safety badges"
    >
      {BADGES.map(({ icon: Icon, label }) => (
        <div
          key={label}
          role="listitem"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-ps-paper dark:bg-ps-ink-3 border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]"
        >
          <Icon size={13} className="text-ps-lime flex-shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium text-ps-muted dark:text-ps-muted-on-dark whitespace-nowrap">{label}</span>
        </div>
      ))}
    </div>
  );
}
