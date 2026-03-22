'use client';

import { useState } from 'react';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { FileCode, Braces, Code2 } from 'lucide-react';

const tabs = [
  { id: 'vanilla', label: 'Vanilla JS', icon: Braces },
  { id: 'react', label: 'React', icon: FileCode },
  { id: 'vue', label: 'Vue', icon: Code2 },
] as const;

type TabId = (typeof tabs)[number]['id'];

const codeSnippets: Record<TabId, string> = {
  vanilla: `import { PlayStake } from '@playstake/sdk';

// Initialize the SDK
const ps = new PlayStake({
  apiKey: 'ps_live_xxxxxxxxxxxxxxxx',
  environment: 'production',
});

// Mount the wager widget
const widget = ps.createWidget({
  containerId: 'playstake-widget',
  gameId: 'your-game-id',
  userId: 'player-123',
  wagerAmountCents: 500,
});

// Listen for lifecycle events
widget.on('consent', (data) => {
  console.log('Player consented:', data);
});

widget.on('matched', (data) => {
  console.log('Wager matched:', data.betId);
});

widget.on('settled', (data) => {
  console.log('Result:', data.outcome);
});

// Report the game result
async function onGameOver(winner) {
  await widget.reportResult({
    outcome: winner ? 'WIN' : 'LOSS',
    score: 1200,
  });
}`,

  react: `import { PlayStakeWidget, usePlayStake } from '@playstake/react';

function GamePage() {
  const { reportResult, betState } = usePlayStake({
    apiKey: 'ps_live_xxxxxxxxxxxxxxxx',
    gameId: 'your-game-id',
  });

  const handleGameOver = async (winner: boolean) => {
    await reportResult({
      outcome: winner ? 'WIN' : 'LOSS',
      score: 1200,
    });
  };

  return (
    <div className="game-container">
      <GameCanvas onGameOver={handleGameOver} />

      <PlayStakeWidget
        userId="player-123"
        wagerAmountCents={500}
        onConsent={(data) => {
          console.log('Player consented:', data);
        }}
        onMatched={(data) => {
          console.log('Wager matched:', data.betId);
        }}
        onSettled={(data) => {
          console.log('Result:', data.outcome);
        }}
      />

      {betState && (
        <p>Current state: {betState}</p>
      )}
    </div>
  );
}`,

  vue: `<template>
  <div class="game-container">
    <GameCanvas @game-over="handleGameOver" />

    <PlayStakeWidget
      :user-id="'player-123'"
      :wager-amount-cents="500"
      @consent="onConsent"
      @matched="onMatched"
      @settled="onSettled"
    />

    <p v-if="betState">
      Current state: {{ betState }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { PlayStakeWidget, usePlayStake } from '@playstake/vue';

const { reportResult, betState } = usePlayStake({
  apiKey: 'ps_live_xxxxxxxxxxxxxxxx',
  gameId: 'your-game-id',
});

async function handleGameOver(winner: boolean) {
  await reportResult({
    outcome: winner ? 'WIN' : 'LOSS',
    score: 1200,
  });
}

function onConsent(data: any) {
  console.log('Player consented:', data);
}

function onMatched(data: any) {
  console.log('Wager matched:', data.betId);
}

function onSettled(data: any) {
  console.log('Result:', data.outcome);
}
</script>`,
};

interface CodePanelProps {
  className?: string;
}

export function CodePanel({ className = '' }: CodePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('vanilla');

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center gap-1 border-b border-white/8 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2.5 text-xs font-mono
                border-b-2 transition-colors duration-150
                ${
                  activeTab === tab.id
                    ? 'border-brand-400 text-brand-400'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }
              `}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto" role="tabpanel">
        <CodeBlock
          code={codeSnippets[activeTab]}
          language={activeTab === 'vue' ? 'vue' : 'javascript'}
          className="border-0 rounded-none h-full"
        />
      </div>
    </div>
  );
}
