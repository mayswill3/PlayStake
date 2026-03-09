/**
 * Format an integer cents value as a dollar string.
 * Example: 2500 -> "$25.00"
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Returns a human-readable "time remaining" string from an ISO date string.
 * Example: "4m 23s", "1h 12m", "Expired"
 */
export function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Parse URL search params into the widget config.
 */
export function parseWidgetParams(): {
  token: string;
  gameId: string;
  theme: "dark" | "light";
  instanceId: string;
} {
  const params = new URLSearchParams(window.location.search);

  return {
    token: params.get("token") || "",
    gameId: params.get("gameId") || "",
    theme: (params.get("theme") as "dark" | "light") || "dark",
    instanceId: params.get("instanceId") || "",
  };
}
