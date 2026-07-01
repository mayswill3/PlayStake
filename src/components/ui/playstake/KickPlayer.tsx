/**
 * KickPlayer — embeds a channel's live Kick player via the public embed URL.
 *
 * Shared by the stream detail page, the bet detail page, and the dashboard's
 * "your channel" card so the iframe markup (URL format + allow attrs) lives in
 * one place.
 *
 * @example
 * ```tsx
 * <KickPlayer slug="kwasi88" />
 * ```
 */
export function KickPlayer({ slug }: { slug: string }) {
  return (
    <div className="overflow-hidden rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-black">
      <iframe
        src={`https://player.kick.com/${slug}`}
        title={`${slug} on Kick`}
        className="w-full aspect-video"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
      />
    </div>
  );
}
