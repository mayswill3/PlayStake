import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-brand-400 text-2xl font-bold">PS</span>
            <span className="text-lg font-semibold text-surface-100">PlayStake</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-surface-100 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-6xl font-bold text-surface-100 mb-6 leading-tight">
            Bet Against Friends in
            <br />
            <span className="text-brand-400">Your Favorite Games</span>
          </h1>
          <p className="text-lg sm:text-xl text-surface-400 max-w-2xl mx-auto mb-10">
            PlayStake is the peer-to-peer wagering platform for competitive gamers.
            Real money, real stakes, real victories.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center px-8 py-3.5 text-base font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors shadow-lg shadow-brand-600/25"
            >
              Get Started
            </Link>
            <Link
              href="/developer"
              className="inline-flex items-center px-8 py-3.5 text-base font-semibold rounded-lg bg-surface-800 text-surface-200 hover:bg-surface-700 transition-colors"
            >
              Developer Docs
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-surface-800 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-surface-100 text-center mb-16">
              How It Works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
              <Step
                number="01"
                title="Connect"
                description="Create your account and fund your wallet with a simple deposit. Link your favorite games."
              />
              <Step
                number="02"
                title="Challenge"
                description="Place a wager on your next match. Your opponent accepts and both stakes are locked in escrow."
              />
              <Step
                number="03"
                title="Win"
                description="Play your match. The winner takes the pot automatically, minus a small platform fee."
              />
            </div>
          </div>
        </section>

        {/* For Players / Developers */}
        <section className="border-t border-surface-800 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="rounded-xl border border-surface-800 bg-surface-900 p-8">
                <span className="text-brand-400 text-sm font-semibold uppercase tracking-wider">For Players</span>
                <h3 className="text-2xl font-bold text-surface-100 mt-3 mb-4">
                  Fair, Transparent Wagering
                </h3>
                <ul className="space-y-3 text-surface-400">
                  <li className="flex items-start gap-3">
                    <span className="text-brand-400 mt-0.5">&#10003;</span>
                    Funds held in secure escrow until match completion
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-brand-400 mt-0.5">&#10003;</span>
                    Dual-source result verification prevents cheating
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-brand-400 mt-0.5">&#10003;</span>
                    Instant payouts to your wallet after settlement
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-brand-400 mt-0.5">&#10003;</span>
                    Dispute resolution system for contested results
                  </li>
                </ul>
                <Link
                  href="/register"
                  className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
                >
                  Create Account
                </Link>
              </div>

              <div className="rounded-xl border border-surface-800 bg-surface-900 p-8">
                <span className="text-blue-400 text-sm font-semibold uppercase tracking-wider">For Developers</span>
                <h3 className="text-2xl font-bold text-surface-100 mt-3 mb-4">
                  Integrate Wagering Into Your Game
                </h3>
                <ul className="space-y-3 text-surface-400">
                  <li className="flex items-start gap-3">
                    <span className="text-blue-400 mt-0.5">&#10003;</span>
                    Simple REST API and embeddable widget
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-400 mt-0.5">&#10003;</span>
                    Earn revenue share on every bet in your game
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-400 mt-0.5">&#10003;</span>
                    Webhook-driven event system for real-time updates
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-400 mt-0.5">&#10003;</span>
                    Analytics dashboard to track volume and earnings
                  </li>
                </ul>
                <Link
                  href="/developer"
                  className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-surface-700 text-surface-200 text-sm font-medium hover:bg-surface-600 transition-colors"
                >
                  Developer Portal
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-600/15 text-brand-400 font-bold text-lg mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-surface-100 mb-2">{title}</h3>
      <p className="text-surface-400">{description}</p>
    </div>
  );
}
