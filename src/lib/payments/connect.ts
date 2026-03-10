import { stripe } from "./stripe.js";
import { prisma } from "../db/client.js";

// ---------------------------------------------------------------------------
// Stripe Connect helpers (future use)
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Connect Account Link for user onboarding.
 *
 * In a full Connect integration each user who wants to receive payouts
 * would have a connected Stripe account. This function creates the
 * onboarding link that redirects the user through Stripe's hosted
 * identity verification and bank account setup flow.
 *
 * NOTE: This requires the platform to be enrolled in Stripe Connect.
 * Currently this is stubbed for future implementation. The withdraw
 * route uses a simplified Payout approach in the meantime.
 *
 * @param userId  PlayStake user ID.
 * @returns URL to redirect the user to for Stripe Connect onboarding.
 */
export async function createConnectAccountLink(
  userId: string
): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, displayName: true, stripeCustomerId: true },
  });

  // Create or retrieve the connected account
  // In production, store the connected account ID on the User model
  const account = await stripe.accounts.create({
    type: "express",
    email: user.email,
    metadata: { playstakeUserId: userId },
    capabilities: {
      transfers: { requested: true },
    },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/wallet/connect/refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/wallet/connect/complete`,
    type: "account_onboarding",
  });

  return accountLink.url;
}
