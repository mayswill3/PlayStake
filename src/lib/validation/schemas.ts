import { z } from "zod";
import {
  BETA_APPLICANT_TYPES,
  BETA_FAVOURITE_GAMES,
  STREAM_GAME_TYPES,
} from "@/lib/games/catalogue";

// ---------------------------------------------------------------------------
// Public early-access signup
// ---------------------------------------------------------------------------

export const betaSignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(255, "Email must be at most 255 characters"),
  game: z.enum(BETA_FAVOURITE_GAMES),
  playerType: z.enum(BETA_APPLICANT_TYPES),
  consent: z
    .boolean()
    .refine((value) => value, "Consent is required to join the beta list"),
});

// ---------------------------------------------------------------------------
// Auth schemas (A1)
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must be at most 255 characters")
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(100, "Display name must be at most 100 characters")
    .trim(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
  twoFactorCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(
      (value) =>
        /^\d{6}$/.test(value) ||
        /^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/.test(value),
      "Enter a 6-digit code or a valid backup code",
    )
    .optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required").max(500),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((v) => v.toLowerCase().trim()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required").max(500),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export const enable2FASchema = z.object({});

export const confirm2FASchema = z.object({
  code: z
    .string()
    .length(6, "2FA code must be 6 digits")
    .regex(/^\d{6}$/, "2FA code must be 6 digits"),
});

// ---------------------------------------------------------------------------
// User Profile schemas (A2)
// ---------------------------------------------------------------------------

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(100, "Display name must be at most 100 characters")
    .trim()
    .optional(),
  avatarUrl: z
    .string()
    .url("Invalid URL")
    .max(500, "Avatar URL must be at most 500 characters")
    .optional()
    .nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

// ---------------------------------------------------------------------------
// Wallet schemas (A3)
// ---------------------------------------------------------------------------

export const depositSchema = z.object({
  amount: z
    .number()
    .int("Amount must be an integer (cents)")
    .min(500, "Minimum deposit is $5.00 (500 cents)")
    .max(100_000, "Maximum deposit is $1,000.00 (100000 cents)"),
  idempotencyKey: z
    .string()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key must be at most 255 characters"),
});

export const withdrawSchema = z.object({
  amount: z
    .number()
    .int("Amount must be an integer (cents)")
    .min(1000, "Minimum withdrawal is $10.00 (1000 cents)"),
  idempotencyKey: z
    .string()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key must be at most 255 characters"),
});

export const transactionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z
    .enum([
      "DEPOSIT",
      "WITHDRAWAL",
      "BET_ESCROW",
      "BET_ESCROW_RELEASE",
      "BET_ESCROW_REFUND",
      "PLATFORM_FEE",
      "DEVELOPER_SHARE",
      "ADJUSTMENT",
    ])
    .optional(),
  status: z
    .enum(["PENDING", "COMPLETED", "FAILED", "REVERSED"])
    .optional(),
});

export const betListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      "PENDING_CONSENT",
      "OPEN",
      "MATCHED",
      "RESULT_REPORTED",
      "SETTLED",
      "CANCELLED",
      "DISPUTED",
      "VOIDED",
    ])
    .optional(),
  gameId: z.string().uuid("Invalid game ID").optional(),
});

// ---------------------------------------------------------------------------
// Streamer schemas — declared game + viewer challenge
// ---------------------------------------------------------------------------

/**
 * Set (or clear) the streamer's currently-declared game. `gameType` is one of
 * the supported streaming games; `null` clears the declaration. The API speaks
 * gameType; the route resolves it to a real Game row (FK) server-side.
 */
export const setDeclaredGameSchema = z.object({
  gameType: z.enum(STREAM_GAME_TYPES).nullable(),
});

/**
 * A viewer's challenge payload carries ONLY the stake amount (integer cents).
 * The game is taken from the streamer's declared game server-side — never trust
 * a game sent by the client.
 */
export const challengeSchema = z.object({
  amount: z
    .number()
    .int("Amount must be an integer (cents)")
    .min(100, "Minimum stake is $1.00 (100 cents)")
    .max(50_000, "Maximum stake is $500.00 (50000 cents)"),
});

// ---------------------------------------------------------------------------
// Dispute schema (A4)
// ---------------------------------------------------------------------------

export const disputeSchema = z.object({
  reason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(2000, "Reason must be at most 2000 characters")
    .trim(),
});

// ---------------------------------------------------------------------------
// Developer schemas (A6)
// ---------------------------------------------------------------------------

export const developerRegisterSchema = z.object({
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(255, "Company name must be at most 255 characters")
    .trim(),
  websiteUrl: z
    .string()
    .url("Invalid URL")
    .max(500, "Website URL must be at most 500 characters")
    .optional()
    .nullable(),
  contactEmail: z
    .string()
    .email("Invalid email address")
    .max(255, "Contact email must be at most 255 characters")
    .transform((v) => v.toLowerCase().trim()),
});

export const createGameSchema = z.object({
  name: z
    .string()
    .min(2, "Game name must be at least 2 characters")
    .max(255, "Game name must be at most 255 characters")
    .trim(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(255, "Slug must be at most 255 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens"
    ),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .nullable(),
  logoUrl: z
    .string()
    .url("Invalid URL")
    .max(500, "Logo URL must be at most 500 characters")
    .optional()
    .nullable(),
  webhookUrl: z
    .string()
    .url("Invalid URL")
    .max(500, "Webhook URL must be at most 500 characters")
    .optional()
    .nullable(),
  minBetAmount: z
    .number()
    .int("Min bet amount must be an integer (cents)")
    .min(100, "Minimum bet amount is $1.00 (100 cents)")
    .optional(),
  maxBetAmount: z
    .number()
    .int("Max bet amount must be an integer (cents)")
    .max(10_000_000, "Maximum bet amount is $100,000.00")
    .optional(),
});

export const updateGameSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(255)
    .trim()
    .optional(),
  description: z.string().max(5000).optional().nullable(),
  logoUrl: z.string().url().max(500).optional().nullable(),
  webhookUrl: z.string().url().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  minBetAmount: z.number().int().min(100).optional(),
  maxBetAmount: z.number().int().max(10_000_000).optional(),
});

export const createApiKeySchema = z.object({
  label: z
    .string()
    .min(1, "Label is required")
    .max(100, "Label must be at most 100 characters")
    .trim(),
  permissions: z
    .array(z.string().max(50))
    .min(1, "At least one permission is required")
    .default(["bet:create", "bet:read", "result:report"]),
});

// ---------------------------------------------------------------------------
// Developer API schemas (B1 - Widget Auth)
// ---------------------------------------------------------------------------

export const widgetAuthSchema = z.object({
  gameId: z.string().uuid("Invalid game ID"),
  playerId: z.string().uuid("Invalid player ID"),
  idempotencyKey: z
    .string()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key must be at most 255 characters"),
});

// ---------------------------------------------------------------------------
// Developer API schemas (B2 - Bet Lifecycle)
// ---------------------------------------------------------------------------

export const createBetSchema = z.object({
  gameId: z.string().uuid("Invalid game ID").optional(),
  playerAId: z.string().uuid("Invalid player A ID").optional(),
  amount: z
    .number()
    .int("Amount must be an integer (cents)")
    .positive("Amount must be positive"),
  currency: z.string().length(3, "Currency must be a 3-letter code").default("USD"),
  externalId: z
    .string()
    .max(255, "External ID must be at most 255 characters")
    .optional(),
  gameMetadata: z.record(z.string(), z.unknown()).optional(),
  expiresInSeconds: z
    .number()
    .int()
    .min(1, "Expires must be at least 1 second")
    .max(86400, "Expires must be at most 86400 seconds")
    .default(1800),
  consentTimeoutSeconds: z
    .number()
    .int()
    .min(1, "Consent timeout must be at least 1 second")
    .max(1800, "Consent timeout must be at most 1800 seconds")
    .default(600),
  idempotencyKey: z
    .string()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key must be at most 255 characters"),
});

export const consentBetSchema = z.object({
  idempotencyKey: z
    .string()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key must be at most 255 characters"),
});

export const acceptBetSchema = z.object({
  idempotencyKey: z
    .string()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key must be at most 255 characters"),
});

export const reportResultSchema = z.object({
  outcome: z.enum(["PLAYER_A_WIN", "PLAYER_B_WIN", "DRAW"]),
  resultPayload: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z
    .string()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key must be at most 255 characters"),
});

export const widgetResultSchema = z.object({
  outcome: z.enum(["PLAYER_A_WIN", "PLAYER_B_WIN", "DRAW"]),
});

export const cancelBetSchema = z.object({
  reason: z
    .string()
    .max(500, "Reason must be at most 500 characters")
    .optional(),
  idempotencyKey: z
    .string()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key must be at most 255 characters"),
});

// ---------------------------------------------------------------------------
// Developer API schemas (B2 - Bet List for V1 API)
// ---------------------------------------------------------------------------

export const betListV1QuerySchema = z.object({
  gameId: z.string().uuid("gameId is required"),
  status: z
    .enum([
      "PENDING_CONSENT",
      "OPEN",
      "MATCHED",
      "RESULT_REPORTED",
      "SETTLED",
      "CANCELLED",
      "DISPUTED",
      "VOIDED",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------------------------------------------------------------------------
// Developer API schemas (B3 - Webhook Management)
// ---------------------------------------------------------------------------

export const createWebhookSchema = z.object({
  gameId: z.string().uuid("Invalid game ID"),
  url: z
    .string()
    .url("Invalid webhook URL")
    .max(500, "URL must be at most 500 characters"),
  events: z
    .array(
      z.enum([
        "BET_CREATED",
        "BET_MATCHED",
        "BET_RESULT_REPORTED",
        "BET_SETTLED",
        "BET_CANCELLED",
        "BET_DISPUTED",
      ])
    )
    .min(1, "At least one event type is required"),
});

export const updateWebhookSchema = z.object({
  url: z
    .string()
    .url("Invalid webhook URL")
    .max(500, "URL must be at most 500 characters")
    .optional(),
  events: z
    .array(
      z.enum([
        "BET_CREATED",
        "BET_MATCHED",
        "BET_RESULT_REPORTED",
        "BET_SETTLED",
        "BET_CANCELLED",
        "BET_DISPUTED",
      ])
    )
    .min(1, "At least one event type is required")
    .optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Admin schemas (A7)
// ---------------------------------------------------------------------------

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(["PLAYER", "DEVELOPER", "ADMIN"]).optional(),
  search: z.string().max(255).optional(),
});

export const adminBetaSignupListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  playerType: z.enum(BETA_APPLICANT_TYPES).optional(),
  game: z.enum(BETA_FAVOURITE_GAMES).optional(),
  search: z.string().trim().max(255).optional(),
});

export const adminUpdateUserSchema = z.object({
  role: z.enum(["PLAYER", "DEVELOPER", "ADMIN"]).optional(),
  kycStatus: z
    .enum(["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"])
    .optional(),
});

export const adminDisputeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      "OPEN",
      "UNDER_REVIEW",
      "RESOLVED_PLAYER_A",
      "RESOLVED_PLAYER_B",
      "RESOLVED_DRAW",
      "RESOLVED_VOID",
    ])
    .optional(),
});

export const adminResolveDisputeSchema = z.object({
  status: z.enum([
    "RESOLVED_PLAYER_A",
    "RESOLVED_PLAYER_B",
    "RESOLVED_DRAW",
    "RESOLVED_VOID",
  ]),
  resolution: z
    .string()
    .min(5, "Resolution must be at least 5 characters")
    .max(2000, "Resolution must be at most 2000 characters")
    .trim(),
});

export const adminAnomalyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      "DETECTED",
      "INVESTIGATING",
      "CONFIRMED_FRAUD",
      "FALSE_POSITIVE",
      "RESOLVED",
    ])
    .optional(),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type Confirm2FAInput = z.infer<typeof confirm2FASchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
export type BetListQuery = z.infer<typeof betListQuerySchema>;
export type DisputeInput = z.infer<typeof disputeSchema>;
export type SetDeclaredGameInput = z.infer<typeof setDeclaredGameSchema>;
export type ChallengeInput = z.infer<typeof challengeSchema>;
export type DeveloperRegisterInput = z.infer<typeof developerRegisterSchema>;
export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type WidgetAuthInput = z.infer<typeof widgetAuthSchema>;
export type CreateBetInput = z.infer<typeof createBetSchema>;
export type ConsentBetInput = z.infer<typeof consentBetSchema>;
export type AcceptBetInput = z.infer<typeof acceptBetSchema>;
export type ReportResultInput = z.infer<typeof reportResultSchema>;
export type WidgetResultInput = z.infer<typeof widgetResultSchema>;
export type CancelBetInput = z.infer<typeof cancelBetSchema>;
export type BetListV1Query = z.infer<typeof betListV1QuerySchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminBetaSignupListQuery = z.infer<
  typeof adminBetaSignupListQuerySchema
>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminDisputeListQuery = z.infer<typeof adminDisputeListQuerySchema>;
export type AdminResolveDisputeInput = z.infer<typeof adminResolveDisputeSchema>;
export type AdminAnomalyListQuery = z.infer<typeof adminAnomalyListQuerySchema>;

// ---------------------------------------------------------------------------
// KYC / identity verification
// ---------------------------------------------------------------------------

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Text fields of a verification packet. Files are validated separately. */
export const kycSubmissionSchema = z.object({
  legalFirstName: z
    .string()
    .trim()
    .min(1, "Legal first name is required")
    .max(100, "Legal first name must be at most 100 characters"),
  legalLastName: z
    .string()
    .trim()
    .min(1, "Legal last name is required")
    .max(100, "Legal last name must be at most 100 characters"),
  dateOfBirth: z
    .string()
    .regex(isoDate, "Date of birth must be in YYYY-MM-DD format")
    .refine(
      (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
      "Date of birth is not a real date",
    ),
  addressLine1: z
    .string()
    .trim()
    .min(1, "Address is required")
    .max(200, "Address must be at most 200 characters"),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z
    .string()
    .trim()
    .min(1, "City is required")
    .max(100, "City must be at most 100 characters"),
  region: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z
    .string()
    .trim()
    .min(1, "Postal code is required")
    .max(20, "Postal code must be at most 20 characters"),
  country: z
    .string()
    .trim()
    .length(2, "Country must be a two-letter ISO code")
    .transform((value) => value.toUpperCase()),
  documentType: z.enum(["PASSPORT", "DRIVERS_LICENCE", "NATIONAL_ID"]),
});

export const adminKycListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  search: z.string().trim().max(255).optional(),
});

export const adminKycReviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reviewNotes: z
    .string()
    .trim()
    .max(1000, "Notes must be at most 1000 characters")
    .optional(),
});
