import { getAvatar } from "@/lib/avatars/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/avatars/:userId — a user's profile photo. Public, like any avatar.
 * The profile links here with ?v=<updated time>, so each version can be cached
 * for good and a new upload gets a new URL.
 */
export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  if (!UUID.test(userId)) return new Response(null, { status: 404 });

  const avatar = await getAvatar(userId);
  if (!avatar) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
