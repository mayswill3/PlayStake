import Link from 'next/link';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-page">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="PlayStake" width={40} height={40} className="h-10 w-10" />
          <span className="text-xl font-display font-semibold text-fg">PlayStake</span>
        </Link>
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
