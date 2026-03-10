/**
 * Format cents (integer) to a dollar string.
 * e.g. 2500 -> "$25.00", -500 -> "-$5.00"
 */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toFixed(2);
  return `${negative ? '-' : ''}$${dollars}`;
}

/**
 * Format a date string to relative or absolute time.
 * Shows relative time for dates within the last 7 days,
 * absolute for older dates.
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format a decimal to a percentage string.
 * e.g. 0.567 -> "56.7%"
 */
export function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}

/**
 * Format a number with commas.
 * e.g. 12500 -> "12,500"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Truncate a string with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '\u2026';
}

/**
 * Generate initials from a display name.
 * e.g. "Frag Master" -> "FM", "player1" -> "P"
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
