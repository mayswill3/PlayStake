'use client';

import { OPEN_COOKIE_SETTINGS_EVENT } from '@/lib/analytics';

/** Footer link that reopens the cookie choices. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))}
    >
      Cookie settings
    </button>
  );
}
