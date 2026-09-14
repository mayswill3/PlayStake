import { BetMatchType, BetStatus, UserRole, type User } from "../../../generated/prisma/client";
import { prisma } from "@/lib/db/client";
import {
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";

// Spectator chat for refereed stream matches (STREAM_VS_STREAM) — one room per
// bet, readable by any signed-in user on /watch and by the players on their bet
// page. The two players can read but never post: the room is for the audience
// (plus the referee and staff for official notes), not a channel between the
// players. Other bet types have no chat. Rooms go read-only once the bet ends.

export const CHAT_MAX_LENGTH = 280;
/** Minimum gap between one user's messages, across all rooms. */
export const CHAT_COOLDOWN_MS = 2_000;
const INITIAL_PAGE = 100;

const CLOSED_STATUSES: BetStatus[] = [
  BetStatus.SETTLED,
  BetStatus.VOIDED,
  BetStatus.CANCELLED,
];

export type ChatRole = "PLAYER" | "REFEREE" | "STAFF" | "SPECTATOR";

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string; role: ChatRole };
}

export interface ChatRoomState {
  messages: ChatMessage[];
  /** IDs of messages removed by a moderator since `after` — drop them client-side. */
  removedIds: string[];
  /** Pass back as `after` on the next poll. */
  cursor: string;
  canPost: boolean;
  /** Why the viewer can't post, when they can't. */
  readOnlyReason: "CLOSED" | "PLAYER" | null;
  closed: boolean;
  isModerator: boolean;
  /** The requesting user — lets the client highlight their own messages. */
  viewerId: string;
}

type Viewer = Pick<User, "id" | "role">;

async function loadRoom(betId: string) {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      id: true,
      status: true,
      matchType: true,
      playerAId: true,
      playerBId: true,
      refereeAssignment: { select: { refereeProfile: { select: { userId: true } } } },
    },
  });
  if (!bet) throw new NotFoundError("Match not found");
  const refereeUserId = bet.refereeAssignment?.refereeProfile?.userId ?? null;
  return { bet, refereeUserId };
}

type Room = Awaited<ReturnType<typeof loadRoom>>;

function access(room: Room, viewer: Viewer) {
  const isModerator = viewer.role === UserRole.ADMIN;
  const canRead = room.bet.matchType === BetMatchType.STREAM_VS_STREAM;
  const isPlayer = viewer.id === room.bet.playerAId || viewer.id === room.bet.playerBId;
  const closed = CLOSED_STATUSES.includes(room.bet.status);
  const readOnlyReason = closed ? ("CLOSED" as const) : isPlayer ? ("PLAYER" as const) : null;
  return { canRead, canPost: canRead && readOnlyReason === null, readOnlyReason, closed, isModerator };
}

function authorRole(room: Room, author: { id: string; role: UserRole }): ChatRole {
  if (author.id === room.refereeUserId) return "REFEREE";
  if (author.id === room.bet.playerAId || author.id === room.bet.playerBId) return "PLAYER";
  if (author.role === UserRole.ADMIN) return "STAFF";
  return "SPECTATOR";
}

const messageSelect = {
  id: true,
  body: true,
  createdAt: true,
  user: { select: { id: true, displayName: true, role: true } },
} as const;

function toChatMessage(
  room: Room,
  row: { id: string; body: string; createdAt: Date; user: { id: string; displayName: string; role: UserRole } },
): ChatMessage {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: { id: row.user.id, displayName: row.user.displayName, role: authorRole(room, row.user) },
  };
}

/**
 * Messages for a room. Without `after`: the latest page. With `after` (a
 * previous `cursor`): only messages newer than it, plus anything a moderator
 * removed since — so a polling client can stay in sync cheaply.
 */
export async function getChatRoom(betId: string, viewer: Viewer, after?: Date): Promise<ChatRoomState> {
  const room = await loadRoom(betId);
  const rights = access(room, viewer);
  if (!rights.canRead) throw new NotFoundError("Match not found");

  // Captured before querying so nothing committed mid-request is skipped. The
  // `after` bounds are inclusive — a change in the same millisecond as the
  // cursor must not be lost — and the client de-duplicates by id (it also
  // rewinds its cursor a few seconds for extra overlap).
  const cursor = new Date();
  const [rows, removed] = await Promise.all([
    after
      ? prisma.matchChatMessage.findMany({
          where: { betId, deletedAt: null, createdAt: { gte: after } },
          select: messageSelect,
          orderBy: { createdAt: "asc" },
          take: INITIAL_PAGE,
        })
      : prisma.matchChatMessage
          .findMany({
            where: { betId, deletedAt: null },
            select: messageSelect,
            orderBy: { createdAt: "desc" },
            take: INITIAL_PAGE,
          })
          .then((latest) => latest.reverse()),
    after
      ? prisma.matchChatMessage.findMany({
          where: { betId, deletedAt: { gte: after } },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    messages: rows.map((row) => toChatMessage(room, row)),
    removedIds: removed.map((row) => row.id),
    cursor: cursor.toISOString(),
    ...rights,
    viewerId: viewer.id,
  };
}

export async function postChatMessage(betId: string, viewer: Viewer, rawBody: string): Promise<ChatMessage> {
  // Collapse runs of whitespace so a message can't be padded into a wall.
  const body = rawBody.replace(/\s+/g, " ").trim();
  if (!body) throw new ValidationError("Message can't be empty");
  if (body.length > CHAT_MAX_LENGTH) {
    throw new ValidationError(`Messages are limited to ${CHAT_MAX_LENGTH} characters`);
  }

  const room = await loadRoom(betId);
  const rights = access(room, viewer);
  if (!rights.canRead) throw new NotFoundError("Match not found");
  if (rights.readOnlyReason === "CLOSED") throw new AuthorizationError("Chat is closed — this match has ended");
  if (rights.readOnlyReason === "PLAYER") throw new AuthorizationError("Players can't post in match chat");

  const recent = await prisma.matchChatMessage.findFirst({
    where: { userId: viewer.id, createdAt: { gt: new Date(Date.now() - CHAT_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) throw new RateLimitError("You're sending messages too quickly");

  const row = await prisma.matchChatMessage.create({
    data: { betId, userId: viewer.id, body },
    select: messageSelect,
  });
  return toChatMessage(room, row);
}

/** Moderator removal. Soft delete: the row stays for audit. */
export async function removeChatMessage(betId: string, messageId: string, viewer: Viewer): Promise<void> {
  if (viewer.role !== UserRole.ADMIN) throw new AuthorizationError("Only moderators can remove messages");
  const { count } = await prisma.matchChatMessage.updateMany({
    where: { id: messageId, betId, deletedAt: null },
    data: { deletedAt: new Date(), deletedById: viewer.id },
  });
  if (count === 0) throw new NotFoundError("Message not found");
}
