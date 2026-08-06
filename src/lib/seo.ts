import type { Metadata } from 'next';

export const SITE_NAME = 'PlayStake';
export const SITE_URL = 'https://playstake.org';
export const SOCIAL_IMAGE_URL = `${SITE_URL}/opengraph-image`;
export const SOCIAL_PROFILES = {
  instagram: 'https://www.instagram.com/joinplaystake/',
  tiktok: 'https://www.tiktok.com/@joinplaystake',
} as const;

export const DEFAULT_SEO_DESCRIPTION =
  'PlayStake lets competitive gamers challenge real players, agree a stake, play live, and settle skill-based matches with protected funds and referee oversight.';

type PublicMetadataOptions = {
  title: string;
  description: string;
  path: `/${string}` | '/';
  absoluteTitle?: boolean;
};

export function createPublicMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: PublicMetadataOptions): Metadata {
  const canonicalUrl = new URL(path, `${SITE_URL}/`).toString();

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'en_GB',
      url: canonicalUrl,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: SOCIAL_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: 'PlayStake competitive gaming platform',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SOCIAL_IMAGE_URL],
    },
  };
}
