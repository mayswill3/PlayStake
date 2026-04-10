import type { GameConfig } from './game-config';

interface GameInfoPanelProps {
  config: GameConfig;
}

export function GameInfoPanel({ config }: GameInfoPanelProps) {
  const { name, description, icon: Icon, accentBg, accentText, preview: Preview, rules } = config;

  return (
    <div className="space-y-5">
      {/* Title area */}
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl flex-shrink-0 ${accentBg} border border-themed`}>
          <Icon size={28} className={accentText} strokeWidth={2} />
        </div>
        <div>
          {/* Live badge */}
          <div className="inline-flex items-center gap-1.5 mb-2 bg-brand-600/10 dark:bg-brand-600/15 text-brand-700 dark:text-brand-400 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-brand-600/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75 animate-ping"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500"></span>
            </span>
            Live Demo
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-fg leading-tight">
            {name}
          </h1>
          <p className="text-fg-secondary mt-1">{description}</p>
        </div>
      </div>

      {/* Preview area */}
      <div className="relative rounded-xl overflow-hidden border border-themed bg-elevated aspect-video">
        <Preview />
        <div className="absolute bottom-3 left-3 bg-page/80 backdrop-blur-sm border border-themed rounded-lg px-3 py-1 text-[11px] font-semibold text-fg-secondary uppercase tracking-wider">
          Preview
        </div>
      </div>

      {/* How to play */}
      <div className="rounded-xl border border-themed bg-card p-5">
        <h3 className="text-[11px] font-semibold text-fg-muted uppercase tracking-widest mb-3">
          How to Play
        </h3>
        <ol className="space-y-3">
          {rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-fg">
              <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums mt-0.5 ${accentBg} ${accentText}`}>
                {i + 1}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
