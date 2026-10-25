// =============================================================================
// PlayStake — Google Analytics, with consent
// =============================================================================
// Nothing is loaded or sent until the visitor accepts analytics cookies
// (PECR / UK GDPR). Even then, only public pages are measured: never the
// wallet, bets, identity checks, settings or admin, and never query strings
// (reset and verification links carry tokens). No balances, stakes or
// personal details are sent; events carry only their name and a few labels.
// =============================================================================

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-S3QN76R9C7';

export type ConsentChoice = 'granted' | 'denied';

const CONSENT_KEY = 'ps-analytics-consent';
/** Bump to ask everyone again, e.g. if what we collect changes. */
const CONSENT_VERSION = 1;
export const CONSENT_CHANGED_EVENT = 'ps:analytics-consent';
export const OPEN_COOKIE_SETTINGS_EVENT = 'ps:cookie-settings';

/** Public pages that may be measured. Everything else never sends a hit. */
const MEASURED_PREFIXES = [
  '/games',
  '/faq',
  '/fair-play',
  '/match-rules',
  '/how-it-works',
  '/learn-more',
  '/investors',
  '/referees',
  '/terms',
  '/privacy',
  '/complaints',
  '/register',
  '/login',
];

export function isMeasuredPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return MEASURED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function analyticsEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && Boolean(GA_MEASUREMENT_ID);
}

export function readConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { choice?: ConsentChoice; v?: number };
    if (parsed.v !== CONSENT_VERSION) return null;
    return parsed.choice === 'granted' || parsed.choice === 'denied' ? parsed.choice : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, v: CONSENT_VERSION, at: new Date().toISOString() }));
  } catch {
    /* private mode: the banner simply asks again next visit */
  }
  if (choice === 'denied') clearAnalyticsCookies();
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: choice }));
}

/** Remove Google Analytics cookies after consent is withdrawn. */
function clearAnalyticsCookies(): void {
  const host = window.location.hostname;
  const domains = ['', host, `.${host}`, `.${host.replace(/^www\./, '')}`];
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (!name || !name.startsWith('_ga')) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
}

type Gtag = (...args: unknown[]) => void;

/**
 * Record an event (a conversion such as a sign-up). Does nothing unless the
 * visitor accepted analytics and is on a measured page.
 */
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}): void {
  if (typeof window === 'undefined' || !analyticsEnabled()) return;
  if (readConsent() !== 'granted' || !isMeasuredPath(window.location.pathname)) return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  gtag?.('event', name, params);
}
