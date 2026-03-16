import { prisma } from "../db/client";
import { generateRandomToken, sha256Hash } from "../utils/crypto";

const API_KEY_PREFIX = "ps_live_";

/**
 * Generate a new API key for a developer.
 *
 * The raw key is returned exactly once. Only the SHA-256 hash is stored.
 * The key format is: ps_live_ + 32 random bytes (base62 encoded).
 */
export async function generateApiKey(
  developerProfileId: string,
  label: string,
  permissions: string[]
): Promise<{ id: string; key: string; keyPrefix: string }> {
  const randomPart = generateRandomToken(32);
  const rawKey = API_KEY_PREFIX + randomPart;
  const keyHash = sha256Hash(rawKey);
  // Store a short prefix for display/identification (first 8 chars of the raw key)
  // The DB column is VarChar(8), so we store only the first 8 chars of the full key.
  const keyPrefix = rawKey.substring(0, 8);

  const apiKey = await prisma.apiKey.create({
    data: {
      developerProfileId,
      keyPrefix,
      keyHash,
      label,
      permissions,
      isActive: true,
    },
  });

  return {
    id: apiKey.id,
    key: rawKey,
    keyPrefix,
  };
}

/**
 * Validate an API key.
 *
 * Hashes the raw key, looks it up, and checks that the key is active
 * and not expired. Returns the developer profile ID and permissions
 * if valid, or null if invalid.
 */
export async function validateApiKey(
  rawKey: string
): Promise<{
  developerProfileId: string;
  permissions: string[];
  keyId: string;
} | null> {
  const keyHash = sha256Hash(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKey) {
    return null;
  }

  if (!apiKey.isActive) {
    return null;
  }

  // Check expiry if set
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Fire-and-forget lastUsedAt update
  updateLastUsed(apiKey.id).catch(() => {});

  return {
    developerProfileId: apiKey.developerProfileId,
    permissions: apiKey.permissions,
    keyId: apiKey.id,
  };
}

/**
 * Revoke an API key.
 *
 * Sets isActive=false and revokedAt. Verifies that the key belongs
 * to the specified developer to prevent cross-developer revocation.
 *
 * @throws Error if the key does not exist or does not belong to the developer.
 */
export async function revokeApiKey(
  keyId: string,
  developerProfileId: string
): Promise<void> {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
  });

  if (!apiKey) {
    throw new Error("API key not found");
  }

  if (apiKey.developerProfileId !== developerProfileId) {
    throw new Error("API key does not belong to this developer");
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });
}

/**
 * List all API keys for a developer.
 *
 * Never returns the full key or the hash. Only returns metadata
 * safe for display: prefix, label, permissions, timestamps, status.
 */
export async function listApiKeys(
  developerProfileId: string
): Promise<
  Array<{
    id: string;
    keyPrefix: string;
    label: string;
    permissions: string[];
    lastUsedAt: Date | null;
    createdAt: Date;
    isActive: boolean;
  }>
> {
  const keys = await prisma.apiKey.findMany({
    where: { developerProfileId },
    select: {
      id: true,
      keyPrefix: true,
      label: true,
      permissions: true,
      lastUsedAt: true,
      createdAt: true,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return keys;
}

/**
 * Update the lastUsedAt timestamp for an API key.
 *
 * Designed to be called fire-and-forget so it does not
 * add latency to the request path.
 */
export async function updateLastUsed(keyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { lastUsedAt: new Date() },
  });
}
