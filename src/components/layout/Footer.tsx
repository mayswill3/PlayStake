import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-surface-800 py-6 px-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-surface-500">
          PlayStake &mdash; Peer-to-peer wagering for competitive games
        </p>
        <div className="flex items-center gap-6">
          <Link href="/developer" className="text-sm text-surface-500 hover:text-surface-300 transition-colors">
            Developers
          </Link>
          <a href="mailto:support@playstake.com" className="text-sm text-surface-500 hover:text-surface-300 transition-colors">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
