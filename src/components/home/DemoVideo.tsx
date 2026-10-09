'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Play } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

/** Videos recorded in our test environment, shown on the homepage. */
export const DEMO_VIDEOS = {
  full: { src: '/home/playstake-demo.mp4', poster: '/home/playstake-demo.jpg', title: 'A live stream match, start to finish' },
  challenge: { src: '/home/clip-challenge.mp4', poster: '/home/clip-challenge.jpg', title: 'Setting up a challenge' },
  match: { src: '/home/clip-match.mp4', poster: '/home/clip-match.jpg', title: 'Playing the match' },
  result: { src: '/home/clip-result.mp4', poster: '/home/clip-result.jpg', title: 'Reviewing the result' },
} as const;

export type DemoVideoKey = keyof typeof DEMO_VIDEOS;

const DemoVideoContext = createContext<(key: DemoVideoKey) => void>(() => {});

/** One shared player, so any "Watch" button on the page can open a video. */
export function DemoVideoProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<DemoVideoKey | null>(null);
  const video = current ? DEMO_VIDEOS[current] : null;

  return (
    <DemoVideoContext.Provider value={setCurrent}>
      {children}
      <Dialog open={video !== null} onClose={() => setCurrent(null)} size="lg" title={video?.title}>
        {video && (
          <div className="space-y-2">
            <video
              key={video.src}
              src={video.src}
              poster={video.poster}
              controls
              autoPlay
              playsInline
              className="w-full rounded-[var(--ps-radius-md)] bg-black"
            />
            <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
              Recorded in our test environment with test accounts and test money. Game streams are simulated.
            </p>
          </div>
        )}
      </Dialog>
    </DemoVideoContext.Provider>
  );
}

export function useDemoVideo() {
  return useContext(DemoVideoContext);
}

/** A round play button that opens one of the demo videos. */
export function PlayButton({ video, label, className = '' }: { video: DemoVideoKey; label: string; className?: string }) {
  const open = useDemoVideo();
  const play = useCallback(() => open(video), [open, video]);
  return (
    <button
      type="button"
      onClick={play}
      aria-label={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/90 bg-black/40 text-white backdrop-blur-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-lime)] ${className}`}
    >
      <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden="true" />
    </button>
  );
}

/** Outlined "Watch …" button. */
export function WatchButton({ video, children, className = '' }: { video: DemoVideoKey; children: ReactNode; className?: string }) {
  const open = useDemoVideo();
  return (
    <button
      type="button"
      onClick={() => open(video)}
      className={`inline-flex h-12 items-center justify-center gap-2.5 rounded-[var(--ps-radius-md)] border border-ps-text/80 px-5 text-sm font-semibold text-ps-text transition-colors hover:bg-ps-text/5 dark:border-white/70 dark:text-ps-text-on-dark dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-lime)] ${className}`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-current">
        <Play className="h-3 w-3 translate-x-[1px] fill-current" aria-hidden="true" />
      </span>
      {children}
    </button>
  );
}
