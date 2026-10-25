import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { GAME_GUIDES } from '@/lib/games/guides';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/games`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    ...GAME_GUIDES.map((guide) => ({
      url: `${SITE_URL}/games/${guide.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    {
      url: `${SITE_URL}/learn-more`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/how-it-works`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/referees/human`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/referees/ai`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/complaints`,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/faq`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/investors`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/match-rules`,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/fair-play`,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];
}
