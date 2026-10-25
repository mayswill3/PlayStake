'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import {
  CONSENT_CHANGED_EVENT,
  GA_MEASUREMENT_ID,
  analyticsEnabled,
  isMeasuredPath,
  readConsent,
  type ConsentChoice,
} from '@/lib/analytics';

type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { gtag?: Gtag; dataLayer?: unknown[] } & Record<string, unknown>;

/**
 * Loads Google Analytics only after consent, and sends a page view for each
 * measured page by hand (with no query string). On any other page, or once
 * consent is withdrawn, Analytics is switched off.
 */
export function Analytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentChoice | null>(null);

  useEffect(() => {
    const sync = () => setConsent(readConsent());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const granted = analyticsEnabled() && consent === 'granted';

  useEffect(() => {
    const w = window as unknown as AnalyticsWindow;
    const measured = granted && isMeasuredPath(pathname);
    // Google's documented opt-out flag: when true, gtag sends nothing.
    w[`ga-disable-${GA_MEASUREMENT_ID}`] = !measured;
    if (!measured || !w.gtag) return;
    w.gtag('event', 'page_view', {
      page_location: `${window.location.origin}${pathname}`,
      page_path: pathname,
      page_title: document.title,
    });
  }, [granted, pathname]);

  if (!granted) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: 34128000 });
if (!window['ga-disable-${GA_MEASUREMENT_ID}']) {
  gtag('event', 'page_view', { page_location: location.origin + location.pathname, page_path: location.pathname, page_title: document.title });
}`}
      </Script>
    </>
  );
}
