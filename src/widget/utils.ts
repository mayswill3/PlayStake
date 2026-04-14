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
 *
 * Theme defaults to "auto" — the widget will follow the user's OS
 * preference via prefers-color-scheme. Hosts can override by passing
 * theme="dark" or theme="light" in PlayStake.init().
 */
export function parseWidgetParams(): {
  token: string;
  gameId: string;
  theme: "dark" | "light" | "auto";
  instanceId: string;
} {
  const params = new URLSearchParams(window.location.search);
  const rawTheme = params.get("theme");
  const theme: "dark" | "light" | "auto" =
    rawTheme === "dark" || rawTheme === "light" || rawTheme === "auto"
      ? rawTheme
      : "auto";

  return {
    token: params.get("token") || "",
    gameId: params.get("gameId") || "",
    theme,
    instanceId: params.get("instanceId") || "",
  };
}

/**
 * Resolve "auto" to a concrete dark/light theme using the host OS
 * preference. Accepts "dark" or "light" as passthrough.
 */
export function resolveTheme(
  themeParam: "dark" | "light" | "auto"
): "dark" | "light" {
  if (themeParam === "dark" || themeParam === "light") return themeParam;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Map from the internal lowercase gameType enum to a human-readable
 * display name. Used everywhere the widget might otherwise leak a raw
 * gameType value to end users.
 */
export const GAME_DISPLAY_NAMES: Record<string, string> = {
  tictactoe: "Tic-Tac-Toe",
  cards: "Higher / Lower",
};

export function getGameDisplayName(
  gameType: string | null | undefined
): string | null {
  if (!gameType) return null;
  return (
    GAME_DISPLAY_NAMES[gameType] ??
    GAME_DISPLAY_NAMES[gameType.toLowerCase()] ??
    null
  );
}
