import { AppError } from "../errors";
import { KycStatus } from "../../../generated/prisma/client";

/**
 * Raised when a money path is reached by a player who has not cleared identity
 * verification. Carries the current status so the client can route the user to
 * the right screen (start, wait, or fix a rejection).
 */
export class KycRequiredError extends AppError {
  public readonly kycStatus: KycStatus;

  constructor(kycStatus: KycStatus) {
    super(messageFor(kycStatus), 403, "KYC_REQUIRED");
    this.name = "KycRequiredError";
    this.kycStatus = kycStatus;
  }
}

function messageFor(kycStatus: KycStatus): string {
  switch (kycStatus) {
    case KycStatus.PENDING:
      return "Your identity verification is still under review. You will be emailed once it is approved.";
    case KycStatus.REJECTED:
      return "Your identity verification was declined. Submit new documents to continue.";
    default:
      return "Verify your identity before moving money on PlayStake.";
  }
}

/**
 * Gate for every path that moves real money. Deliberately fails closed: any
 * status other than VERIFIED blocks.
 */
export function assertKycVerified(user: { kycStatus: KycStatus }): void {
  if (user.kycStatus !== KycStatus.VERIFIED) {
    throw new KycRequiredError(user.kycStatus);
  }
}

export function isKycVerified(user: { kycStatus: KycStatus }): boolean {
  return user.kycStatus === KycStatus.VERIFIED;
}
