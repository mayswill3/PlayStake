import { z } from "zod";

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
    .length(6, "2FA code must be 6 digits")
    .regex(/^\d{6}$/, "2FA code must be 6 digits")
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
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminDisputeListQuery = z.infer<typeof adminDisputeListQuerySchema>;
export type AdminResolveDisputeInput = z.infer<typeof adminResolveDisputeSchema>;
export type AdminAnomalyListQuery = z.infer<typeof adminAnomalyListQuerySchema>;
