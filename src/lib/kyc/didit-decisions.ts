// =============================================================================
// PlayStake — Applying Didit's results
// =============================================================================
// A finished Didit session becomes a KYC submission like an uploaded one, so
// the same safeguards run: the document's date of birth against the one given
// at sign-up, the same identity on another account, GAMSTOP. Then:
//
//   - Didit Approved, 18+ on the document, no open identity case
//       → verified automatically
//   - Didit Declined → rejected, with Didit's reasons; the player can retry
//   - Didit In Review, or approved but an identity case is open
//       → left for staff in the ID checks queue
//
// Once staff have decided a submission, a later change in Didit doesn't
// overturn it; Didit's latest status is still recorded.
// =============================================================================

import {
  KycDocumentType,
  KycProvider,
  KycStatus,
  KycSubmissionStatus,
  Prisma,
} from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { hasBlockingIdentityCase, screenKycSubmission } from "../compliance/identity-checks";
import { emailKycSubmitted } from "../email/events";
import { sendKycDecisionEmail } from "../email/resend";
import { MINIMUM_AGE_YEARS, ageInYears } from "./constants";
import { DIDIT_FINAL_STATUSES, type DiditDecision, type DiditFinalStatus } from "./didit";

export type DiditOutcome = "ignored" | "approved" | "rejected" | "pending" | "unchanged";

const ISO3_TO_ISO2: Record<string, string> = {
  GBR: "GB", IRL: "IE", USA: "US", CAN: "CA", AUS: "AU", NZL: "NZ", FRA: "FR", DEU: "DE", ESP: "ES",
  PRT: "PT", ITA: "IT", NLD: "NL", BEL: "BE", POL: "PL", ROU: "RO", BGR: "BG", LTU: "LT", LVA: "LV",
  EST: "EE", SWE: "SE", NOR: "NO", DNK: "DK", FIN: "FI", AUT: "AT", CHE: "CH", CZE: "CZ", SVK: "SK",
  HUN: "HU", GRC: "GR", CYP: "CY", MLT: "MT", HRV: "HR", SVN: "SI", IND: "IN", PAK: "PK", BGD: "BD",
  NGA: "NG", GHA: "GH", ZAF: "ZA", KEN: "KE", ZWE: "ZW", JAM: "JM", CHN: "CN", HKG: "HK", PHL: "PH",
  BRA: "BR", TUR: "TR", UKR: "UA", ARE: "AE", SGP: "SG", MYS: "MY", LKA: "LK",
};

function countryCode(...candidates: Array<string | null | undefined>): string {
  for (const raw of candidates) {
    const value = raw?.trim().toUpperCase();
    if (!value) continue;
    if (value.length === 2) return value;
    if (ISO3_TO_ISO2[value]) return ISO3_TO_ISO2[value];
    if (value === "UNITED KINGDOM" || value === "GREAT BRITAIN") return "GB";
  }
  return "ZZ";
}

function documentType(raw: string | null | undefined): KycDocumentType {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("passport")) return KycDocumentType.PASSPORT;
  if (value.includes("driv")) return KycDocumentType.DRIVERS_LICENCE;
  if (value.includes("residen")) return KycDocumentType.RESIDENCE_PERMIT;
  return KycDocumentType.NATIONAL_ID;
}

const clip = (value: string | null | undefined, max: number) => (value ?? "").trim().slice(0, max);

/** Reasons Didit gave, worded for the player. */
function reasons(decision: DiditDecision): string[] {
  const all = [
    ...(decision.id_verifications ?? []),
    ...(decision.liveness_checks ?? []),
    ...(decision.face_matches ?? []),
    ...(decision.poa_verifications ?? []),
    ...(decision.aml_screenings ?? []),
  ].flatMap((step) => step.warnings ?? []);
  return [...new Set(all.map((warning) => warning.short_description?.trim()).filter((text): text is string => Boolean(text)))];
}

/** What staff see about Didit's check. No images, no document numbers. */
function summarise(decision: DiditDecision): Prisma.InputJsonValue {
  const id = decision.id_verifications?.[0];
  const poa = decision.poa_verifications?.[0];
  return {
    status: decision.status,
    document: id ? { type: id.document_type ?? null, issuingState: id.issuing_state ?? null, expires: id.expiration_date ?? null, status: id.status } : null,
    liveness: decision.liveness_checks?.map((check) => ({ status: check.status, score: check.score ?? null, ageEstimate: check.age_estimation ?? null })) ?? [],
    faceMatch: decision.face_matches?.map((match) => ({ status: match.status, score: match.score ?? null })) ?? [],
    proofOfAddress: poa ? { status: poa.status, type: poa.document_type ?? null, issued: poa.issue_date ?? null, address: poa.poa_formatted_address ?? null } : null,
    aml: decision.aml_screenings?.map((screen) => ({ status: screen.status, hits: screen.total_hits ?? 0, score: screen.score ?? null })) ?? [],
    reasons: reasons(decision),
  };
}

function isFinal(status: string): status is DiditFinalStatus {
  return (DIDIT_FINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * Record a Didit decision against the player it belongs to (vendor_data).
 * Safe to call more than once for the same session.
 */
export async function applyDiditDecision(decision: DiditDecision): Promise<DiditOutcome> {
  if (!isFinal(decision.status) || !decision.vendor_data) return "ignored";
  const user = await prisma.user.findUnique({
    where: { id: decision.vendor_data },
    select: { id: true, email: true, displayName: true, kycStatus: true },
  });
  if (!user) return "ignored";

  const id = decision.id_verifications?.[0];
  const poa = decision.poa_verifications?.[0];
  const address = poa?.poa_parsed_address;
  const dateOfBirth = id?.date_of_birth ? new Date(`${id.date_of_birth.slice(0, 10)}T00:00:00Z`) : null;
  const summary = summarise(decision);

  const existing = await prisma.kycSubmission.findUnique({
    where: { providerSessionId: decision.session_id },
    select: { id: true, status: true },
  });

  // Already decided here: keep that decision, note what Didit now says.
  if (existing && existing.status !== KycSubmissionStatus.PENDING) {
    await prisma.kycSubmission.update({
      where: { id: existing.id },
      data: { providerStatus: decision.status, providerSummary: summary },
    });
    return "unchanged";
  }
  // A verified player's identity isn't reopened by a stray session.
  if (!existing && user.kycStatus === KycStatus.VERIFIED) return "ignored";

  // Without a name and date of birth there's nothing to screen or approve.
  const hasIdentity = Boolean(id?.first_name && id?.last_name && dateOfBirth);
  const fields = {
    legalFirstName: clip(id?.first_name, 100) || "Unknown",
    legalLastName: clip(id?.last_name, 100) || "Unknown",
    dateOfBirth: dateOfBirth ?? new Date("1900-01-01T00:00:00Z"),
    addressLine1: clip(address?.street_1 ?? poa?.poa_formatted_address, 200),
    addressLine2: clip(address?.street_2, 200) || null,
    city: clip(address?.city, 100),
    region: clip(address?.region, 100) || null,
    postalCode: clip(address?.postal_code, 20),
    country: countryCode(address?.country, id?.issuing_state),
    documentType: documentType(id?.document_type),
    providerStatus: decision.status,
    providerSummary: summary,
  };

  const submission = existing
    ? await prisma.kycSubmission.update({ where: { id: existing.id }, data: fields, select: { id: true } })
    : await prisma.kycSubmission.create({
        data: {
          ...fields,
          userId: user.id,
          provider: KycProvider.DIDIT,
          providerSessionId: decision.session_id,
          status: KycSubmissionStatus.PENDING,
        },
        select: { id: true },
      });

  if (hasIdentity) {
    try {
      await screenKycSubmission(submission.id);
    } catch (error) {
      console.error("[KYC] identity screening failed", { submissionId: submission.id, error });
    }
  }

  const decide = async (approve: boolean, notes: string) => {
    await prisma.$transaction([
      prisma.kycSubmission.update({
        where: { id: submission.id },
        data: {
          status: approve ? KycSubmissionStatus.APPROVED : KycSubmissionStatus.REJECTED,
          reviewedAt: new Date(),
          reviewNotes: notes.slice(0, 1000),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { kycStatus: approve ? KycStatus.VERIFIED : KycStatus.REJECTED },
      }),
    ]);
    try {
      await sendKycDecisionEmail({
        email: user.email,
        displayName: user.displayName,
        submissionId: submission.id,
        approved: approve,
        reviewNotes: approve ? null : notes,
        userId: user.id,
      });
    } catch (error) {
      console.error("[KYC] decision email could not be queued", { submissionId: submission.id, error });
    }
  };

  if (decision.status === "Declined") {
    const why = reasons(decision);
    await decide(false, why.length ? `Didit could not verify you: ${why.join("; ")}.` : "Didit could not verify your identity.");
    return "rejected";
  }

  const ofAge = dateOfBirth !== null && ageInYears(dateOfBirth) >= MINIMUM_AGE_YEARS;
  if (decision.status === "Approved" && hasIdentity && ofAge && !(await hasBlockingIdentityCase(user.id))) {
    await decide(true, `Approved automatically by Didit (session ${decision.session_id}).`);
    return "approved";
  }

  // In Review, or approved but something here needs a person to look.
  await prisma.user.update({ where: { id: user.id }, data: { kycStatus: KycStatus.PENDING } });
  await emailKycSubmitted(user.id, submission.id);
  return "pending";
}
