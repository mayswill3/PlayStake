// =============================================================================
// PlayStake — Profile photos
// =============================================================================
// An upload is decoded and re-encoded as a 256px square WebP before anything
// is stored. That strips EXIF data (including phone GPS), drops anything
// hidden in the original file, and keeps every avatar a few kilobytes, so they
// live in Postgres rather than needing separate file storage.
// =============================================================================

import sharp from "sharp";
import { prisma } from "../db/client";
import { ValidationError } from "../errors";

export const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;
export const AVATAR_SIZE_PX = 256;

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "heif", "avif"]);

export function avatarPath(userId: string, version: Date): string {
  return `/api/avatars/${userId}?v=${version.getTime()}`;
}

/** Decode, square-crop and re-encode an upload. Throws on anything not an image. */
export async function processAvatar(bytes: Buffer): Promise<Buffer> {
  let format: string | undefined;
  try {
    // limitInputPixels stops a tiny file that decodes to a huge image.
    format = (await sharp(bytes, { limitInputPixels: 50_000_000 }).metadata()).format;
  } catch {
    throw new ValidationError("That file isn't an image we can read. Use a JPG, PNG or WebP.");
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new ValidationError("Use a JPG, PNG or WebP image.");
  }

  return sharp(bytes, { limitInputPixels: 50_000_000 })
    .rotate() // honour the phone's orientation before EXIF is dropped
    .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();
}

/** Store a new photo and point the profile at it. Returns the new avatar URL. */
export async function saveAvatar(userId: string, upload: Buffer): Promise<string> {
  const data = new Uint8Array(await processAvatar(upload));
  return prisma.$transaction(async (tx) => {
    const avatar = await tx.userAvatar.upsert({
      where: { userId },
      create: { userId, data },
      update: { data },
      select: { updatedAt: true },
    });
    const url = avatarPath(userId, avatar.updatedAt);
    await tx.user.update({ where: { id: userId }, data: { avatarUrl: url } });
    return url;
  });
}

export async function removeAvatar(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.userAvatar.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } }),
  ]);
}

export async function getAvatar(userId: string) {
  return prisma.userAvatar.findUnique({
    where: { userId },
    select: { data: true, updatedAt: true },
  });
}
