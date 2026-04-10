'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Code2, Webhook, PieChart, Globe, ArrowRight, Check, Copy } from 'lucide-react';

const FEATURES = [
  {
    icon: Code2,
    title: 'REST API + Widget SDK',
    description: 'One API key, one <script> tag, full wagering in your game.',
  },
  {
    icon: Webhook,
    title: 'Webhook events',
    description: 'Get notified on every bet state change. HMAC-signed payloads.',
  },
  {
    icon: PieChart,
    title: 'Revenue share',
    description: 'Earn a percentage of every bet placed in your game.',
  },
  {
    icon: Globe,
    title: 'Any browser game',
    description: 'Works in any iframe-embeddable game. No platform restrictions.',
  },
];

const CODE_SNIPPET = `// Add wagering to your game in minutes
const widget = PlayStake.init({
  gameId: "your-game-uuid",
  widgetToken: "wt_...",
  theme: "dark",
  onBetSettled: function(bet) {
    console.log("Winner:", bet.outcome);
    endMatch(bet);
  }
});

widget.createBet({ amount: 1000 });`;

export function ForDevelopers() {
  return (
    <section id="for-developers" className="py-20 lg:py-28 bg-elevated">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Code block (left on desktop) */}
          <div className="order-2 lg:order-1">
            <CodeBlock />
          </div>

          {/* Text (right on desktop) */}
          <div className="order-1 lg:order-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-3">
              For Developers
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-fg leading-tight">
              Add real-money wagering to your game in 15 minutes.
            </h2>
            <p className="mt-4 text-lg text-fg-secondary">
              A drop-in widget, a REST API, and a revenue share. Ship wagering without building a ledger, escrow system, or payment pipeline.
            </p>

            <ul className="mt-8 space-y-6">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.title} className="flex gap-4">
                    <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800/10 text-slate-700 dark:bg-slate-700/20 dark:text-slate-300">
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-fg">{feature.title}</h3>
                      <p className="mt-1 text-fg-secondary">{feature.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Link
              href="/developer"
              className="inline-flex items-center gap-2 mt-8 text-brand-600 hover:text-brand-700 font-semibold transition-colors"
            >
              Read the developer docs
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function CodeBlock() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE_SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl max-w-xl mx-auto"
      style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500"></span>
          <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
          <span className="h-3 w-3 rounded-full bg-green-500"></span>
          <span className="ml-3 text-xs text-white/50 font-mono">integration.js</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors px-2 py-1 rounded"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check size={14} className="text-brand-400" />
              <span className="text-brand-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <pre className="px-5 py-5 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono" style={{ color: '#c9d1d9' }}>
          <span style={{ color: '#8b949e' }}>{'// Add wagering to your game in minutes\n'}</span>
          <span style={{ color: '#ff7b72' }}>{'const'}</span>
          <span>{' widget '}</span>
          <span style={{ color: '#ff7b72' }}>{'='}</span>
          <span>{' PlayStake.'}</span>
          <span style={{ color: '#d2a8ff' }}>{'init'}</span>
          <span>{'({\n  gameId: '}</span>
          <span style={{ color: '#a5d6ff' }}>{'"your-game-uuid"'}</span>
          <span>{',\n  widgetToken: '}</span>
          <span style={{ color: '#a5d6ff' }}>{'"wt_..."'}</span>
          <span>{',\n  theme: '}</span>
          <span style={{ color: '#a5d6ff' }}>{'"dark"'}</span>
          <span>{',\n  onBetSettled: '}</span>
          <span style={{ color: '#ff7b72' }}>{'function'}</span>
          <span>{'(bet) {\n    console.'}</span>
          <span style={{ color: '#d2a8ff' }}>{'log'}</span>
          <span>{'('}</span>
          <span style={{ color: '#a5d6ff' }}>{'"Winner:"'}</span>
          <span>{', bet.outcome);\n    '}</span>
          <span style={{ color: '#d2a8ff' }}>{'endMatch'}</span>
          <span>{'(bet);\n  }\n});\n\nwidget.'}</span>
          <span style={{ color: '#d2a8ff' }}>{'createBet'}</span>
          <span>{'({ amount: '}</span>
          <span style={{ color: '#79c0ff' }}>{'1000'}</span>
          <span>{' });'}</span>
        </code>
      </pre>
    </div>
  );
}
