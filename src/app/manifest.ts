import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PlayStake',
    short_name: 'PlayStake',
    description:
      'Skill-based player-versus-player challenges for competitive gamers.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1220',
    theme_color: '#5fdcb2',
    icons: [
      {
        src: '/logo.png',
        sizes: '200x200',
        type: 'image/png',
      },
    ],
  };
}
