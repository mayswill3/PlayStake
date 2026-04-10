'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface RoleSelectorProps {
  onSelect: (role: 'A' | 'B') => void;
  disabled?: boolean;
  gameLabel?: { a: string; b: string };
}

export function RoleSelector({ onSelect, disabled, gameLabel }: RoleSelectorProps) {
  return (
    <Card>
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-text-primary mb-4">
        Choose Your Player
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="w-full flex-col h-auto py-6"
          onClick={() => onSelect('A')}
          disabled={disabled}
        >
          <span className="font-display text-2xl font-bold text-blue-400">
            {gameLabel?.a ?? 'X'}
          </span>
          <span className="font-mono text-xs text-text-secondary mt-1">
            Player A — Creates the bet
          </span>
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="w-full flex-col h-auto py-6 border border-white/8"
          onClick={() => onSelect('B')}
          disabled={disabled}
        >
          <span className="font-display text-2xl font-bold text-pink-400">
            {gameLabel?.b ?? 'O'}
          </span>
          <span className="font-mono text-xs text-text-secondary mt-1">
            Player B — Accepts the bet
          </span>
        </Button>
      </div>
    </Card>
  );
}
