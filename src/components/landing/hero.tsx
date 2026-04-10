import Link from 'next/link';
import { Play, TrendingUp, CheckCircle2, Star } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text content */}
          <div className="text-center lg:text-left">
            {/* Badge pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-600/20 bg-brand-600/10 px-3 py-1 text-sm font-medium text-brand-700 dark:text-brand-400 animate-fade-up">
              <span>🎮</span>
              <span>Real money. Real stakes.</span>
            </div>

            {/* Headline */}
            <h1 className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-fg">
              <span className="block animate-fade-up animate-fade-up-delay-100">Play your game.</span>
              <span className="block animate-fade-up animate-fade-up-delay-200">Stake your skill.</span>
              <span
                className="block animate-fade-up animate-fade-up-delay-300 bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #22c55e 0%, #10b981 50%, #06b6d4 100%)' }}
              >
                Earn your winnings.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-lg text-fg-secondary max-w-xl mx-auto lg:mx-0 animate-fade-up animate-fade-up-delay-400">
              PlayStake is the peer-to-peer wagering platform that lets competitive gamers bet real money against each other — directly, fairly, instantly.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start animate-fade-up animate-fade-up-delay-500">
              <Link
                href="/register"
                className="inline-flex items-center justify-center h-12 px-7 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 active:scale-[0.98] transition-all shadow-sm"
              >
                Get Started
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-lg border border-themed text-fg font-semibold hover:bg-elevated active:scale-[0.98] transition-all"
              >
                <Play size={16} fill="currentColor" />
                Watch how it works
              </Link>
            </div>

            {/* Social proof bar */}
            <div className="mt-10 pt-6 border-t border-themed animate-fade-up animate-fade-up-delay-500">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 justify-center lg:justify-start text-sm text-fg-muted">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-brand-600" />
                  <span className="tabular-nums font-semibold text-fg">$200K+</span>
                  <span>paid out</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-brand-600" />
                  <span className="tabular-nums font-semibold text-fg">12,000+</span>
                  <span>bets settled</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-amber-500" fill="currentColor" />
                  <span className="tabular-nums font-semibold text-fg">4.9</span>
                  <span>player rating</span>
                </div>
              </div>
            </div>
          </div>

          {/* Geometric illustration (desktop only) */}
          <div className="hidden lg:block relative">
            <HeroGraphic />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroGraphic() {
  return (
    <div className="relative aspect-square max-w-lg mx-auto">
      <svg viewBox="0 0 500 500" className="w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        {/* Large brand gradient circle */}
        <circle cx="280" cy="220" r="160" fill="url(#brandGradient)" opacity="0.18" />
        {/* Teal hex */}
        <polygon
          points="150,120 220,120 255,180 220,240 150,240 115,180"
          fill="#06b6d4"
          opacity="0.22"
        />
        {/* Green circle */}
        <circle cx="150" cy="340" r="90" fill="#22c55e" opacity="0.15" />
        {/* Brand gradient ring */}
        <circle cx="280" cy="220" r="160" fill="none" stroke="url(#brandGradient)" strokeWidth="2" opacity="0.5" />
        {/* Small accent circles */}
        <circle cx="400" cy="100" r="20" fill="#22c55e" opacity="0.6" />
        <circle cx="80" cy="220" r="12" fill="#06b6d4" opacity="0.7" />
        <circle cx="380" cy="380" r="16" fill="#10b981" opacity="0.5" />
        {/* Dashed connector lines */}
        <line
          x1="150"
          y1="180"
          x2="280"
          y2="220"
          stroke="#22c55e"
          strokeWidth="1.5"
          strokeDasharray="6 6"
          opacity="0.45"
        />
        <line
          x1="280"
          y1="220"
          x2="150"
          y2="340"
          stroke="#06b6d4"
          strokeWidth="1.5"
          strokeDasharray="6 6"
          opacity="0.45"
        />
        {/* Center pulse */}
        <circle cx="280" cy="220" r="8" fill="url(#brandGradient)">
          <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
