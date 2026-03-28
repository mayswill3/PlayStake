'use client';

import { useEffect, useState } from 'react';

interface RotatePromptProps {
  isInGame: boolean;
}

export function RotatePrompt({ isInGame }: RotatePromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!isInGame) {
      setShowPrompt(false);
      return;
    }

    const check = () => {
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      const mobile = window.matchMedia('(max-width: 1024px)').matches;
      setShowPrompt(portrait && mobile);
    };

    check();
    window.addEventListener('orientationchange', check);
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('orientationchange', check);
      window.removeEventListener('resize', check);
    };
  }, [isInGame]);

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-surface-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="rotate-prompt-icon" aria-hidden="true">
          <div className="rotate-prompt-icon__home" />
        </div>
        <p className="font-mono text-sm text-text-primary tracking-wider">
          Rotate your device to play
        </p>
        <p className="font-mono text-xs text-text-muted">
          This game is best played in landscape
        </p>
      </div>
    </div>
  );
}
