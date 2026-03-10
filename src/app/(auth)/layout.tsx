import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-brand-400 text-3xl font-bold">PS</span>
          <span className="text-xl font-semibold text-surface-100">PlayStake</span>
        </Link>
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
