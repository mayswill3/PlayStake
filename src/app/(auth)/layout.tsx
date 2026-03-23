import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="PlayStake" className="h-10 w-10" />
          <span className="text-xl font-display font-semibold text-text-primary">PlayStake</span>
        </Link>
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
