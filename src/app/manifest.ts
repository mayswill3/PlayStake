import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PlayStake',
    short_name: 'PlayStake',
    description:
      'Skill-based player-versus-player challenges for competitive gamers.',
    start_url: '/',
    display: 'standalone',
    // Kept in step with design/tokens.css: --ps-ink and --ps-lime.
    background_color: '#0A0F1C',
    theme_color: '#5FDCB2',
    icons: [
      {
        src: '/logo.png',
        sizes: '200x200',
        type: 'image/png',
      },
    ],
  };
}
