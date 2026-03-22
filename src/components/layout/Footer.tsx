import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-white/8 py-6 px-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-mono text-sm text-text-muted">
          PlayStake &mdash; Peer-to-peer wagering for competitive games
        </p>
        <div className="flex items-center gap-6">
          <Link href="/developer" className="font-mono text-sm text-text-muted hover:text-text-secondary transition-colors">
            Developers
          </Link>
          <a href="mailto:support@playstake.com" className="font-mono text-sm text-text-muted hover:text-text-secondary transition-colors">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
