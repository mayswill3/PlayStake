// =============================================================================
// PlayStake — Didit API client
// =============================================================================
// Didit runs the hosted identity check: ID document, liveness, face match,
// proof of address and AML screening. We create a session per player, send
// them to Didit's page, and read the decision back, either from a signed
// webhook or when the player returns. The decision is always fetched from
// Didit's API with our key, so we never act on data we haven't confirmed.
//
// Configured by DIDIT_API_KEY and DIDIT_WORKFLOW_ID; webhooks also need
// DIDIT_WEBHOOK_SECRET. Without the first two, the upload form is used.
// =============================================================================

import { createHmac, timingSafeEqual } from "crypto";

const API_BASE = () => process.env.DIDIT_API_BASE ?? "https://verification.didit.me";

/** Didit session statuses that end a check. */
export const DIDIT_FINAL_STATUSES = ["Approved", "Declined", "In Review"] as const;
export type DiditFinalStatus = (typeof DIDIT_FINAL_STATUSES)[number];

/** Reject webhooks older than this, so a captured one can't be replayed. */
export const WEBHOOK_MAX_AGE_SECONDS = 300;

export function isDiditEnabled(): boolean {
  return Boolean(process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID);
}

export class DiditApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "DiditApiError";
  }
}

async function diditFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey) throw new DiditApiError("DIDIT_API_KEY is not set", 500);
  const response = await fetch(`${API_BASE()}${path}`, {
    ...init,
    headers: { "x-api-key": apiKey, "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new DiditApiError(`Didit ${init.method ?? "GET"} ${path} returned ${response.status}: ${body.slice(0, 300)}`, response.status);
  }
  return (await response.json()) as T;
}

export interface CreateSessionInput {
  userId: string;
  email: string;
  callbackUrl: string;
  /** Declared at sign-up; Didit flags it if the document disagrees. */
  dateOfBirth?: string | null;
  /** Sandbox applications only: a deterministic test outcome. */
  sandboxScenario?: string;
}

export async function createDiditSession(input: CreateSessionInput): Promise<{ sessionId: string; url: string }> {
  const session = await diditFetch<{ session_id: string; url: string }>("/v3/session/", {
    method: "POST",
    body: JSON.stringify({
      workflow_id: process.env.DIDIT_WORKFLOW_ID,
      // Our user id: Didit uses it to spot one person behind several sessions,
      // and hands it back so we know whose result it is.
      vendor_data: input.userId,
      callback: input.callbackUrl,
      language: "en",
      contact_details: { email: input.email, send_notification_emails: false, email_lang: "en" },
      ...(input.dateOfBirth ? { expected_details: { date_of_birth: input.dateOfBirth } } : {}),
      ...(input.sandboxScenario ? { sandbox_scenario: input.sandboxScenario } : {}),
    }),
  });
  return { sessionId: session.session_id, url: session.url };
}

interface Warning {
  risk?: string;
  short_description?: string;
}

/** The parts of Didit's decision PlayStake reads. Images are never stored. */
export interface DiditDecision {
  session_id: string;
  status: string;
  vendor_data: string | null;
  id_verifications?: Array<{
    status: string;
    document_type?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    date_of_birth?: string | null;
    age?: number | null;
    issuing_state?: string | null;
    expiration_date?: string | null;
    warnings?: Warning[];
  }>;
  poa_verifications?: Array<{
    status: string;
    document_type?: string | null;
    issue_date?: string | null;
    poa_formatted_address?: string | null;
    poa_parsed_address?: {
      street_1?: string | null;
      street_2?: string | null;
      city?: string | null;
      region?: string | null;
      country?: string | null;
      postal_code?: string | null;
    } | null;
    warnings?: Warning[];
  }>;
  liveness_checks?: Array<{ status: string; score?: number | null; age_estimation?: number | null; warnings?: Warning[] }>;
  face_matches?: Array<{ status: string; score?: number | null; warnings?: Warning[] }>;
  aml_screenings?: Array<{ status: string; total_hits?: number | null; score?: number | null; warnings?: Warning[] }>;
}

export function getDiditDecision(sessionId: string): Promise<DiditDecision> {
  return diditFetch<DiditDecision>(`/v3/session/${encodeURIComponent(sessionId)}/decision/`);
}

// ---------------------------------------------------------------------------
// Webhook signatures
// ---------------------------------------------------------------------------

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

/** Didit's canonical JSON for X-Signature-V2: whole floats as ints, keys sorted. */
function canonicalJson(value: unknown): string {
  const normalise = (data: unknown): unknown => {
    if (Array.isArray(data)) return data.map(normalise);
    if (data && typeof data === "object") {
      return Object.keys(data as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = normalise((data as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return data;
  };
  return JSON.stringify(normalise(value));
}

/**
 * Check a webhook really came from Didit and isn't a replay. Accepts the
 * raw-body signature, or the canonical-JSON one if a proxy re-encoded the body.
 */
export function verifyDiditWebhook(
  rawBody: string,
  headers: { signature?: string | null; signatureV2?: string | null; timestamp?: string | null },
  now: number = Date.now(),
): boolean {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) return false;

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > WEBHOOK_MAX_AGE_SECONDS) return false;

  if (headers.signature) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (safeEqualHex(headers.signature, expected)) return true;
  }
  if (headers.signatureV2) {
    try {
      const expected = createHmac("sha256", secret).update(canonicalJson(JSON.parse(rawBody)), "utf8").digest("hex");
      if (safeEqualHex(headers.signatureV2, expected)) return true;
    } catch {
      return false;
    }
  }
  return false;
}
