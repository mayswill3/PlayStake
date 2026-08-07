import type Stripe from 'stripe';
import { prisma } from '@/lib/db/client';
import { stripe } from '@/lib/payments/stripe';

export type ConnectStatus = {
  accountId: string | null;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  currentlyDue: string[];
};

function publicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.SITE_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

async function createConnectedAccount(userId: string) {
  const country = process.env.STRIPE_CONNECT_COUNTRY;
  if (!country) {
    throw new Error('STRIPE_CONNECT_COUNTRY environment variable is not set');
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  const account = await stripe.accounts.create(
    {
      type: 'express',
      country,
      email: user.email,
      metadata: { playstakeUserId: userId },
      capabilities: { transfers: { requested: true } },
    },
    { idempotencyKey: `connect_account_${userId}` },
  );

  await prisma.user.update({
    where: { id: userId },
    data: { stripeConnectAccountId: account.id },
  });
  return account.id;
}

export async function getOrCreateConnectedAccount(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeConnectAccountId: true },
  });
  return user.stripeConnectAccountId ?? createConnectedAccount(userId);
}

export async function syncConnectStatus(userId: string): Promise<ConnectStatus> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeConnectAccountId: true },
  });

  if (!user.stripeConnectAccountId) {
    return {
      accountId: null,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      currentlyDue: [],
    };
  }

  const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
  if (account.deleted) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeConnectAccountId: null,
        stripeConnectDetailsSubmitted: false,
        stripeConnectPayoutsEnabled: false,
      },
    });
    return {
      accountId: null,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      currentlyDue: [],
    };
  }

  const detailsSubmitted = account.details_submitted;
  const payoutsEnabled = account.payouts_enabled;
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeConnectDetailsSubmitted: detailsSubmitted,
      stripeConnectPayoutsEnabled: payoutsEnabled,
    },
  });

  return {
    accountId: account.id,
    detailsSubmitted,
    payoutsEnabled,
    chargesEnabled: account.charges_enabled,
    currentlyDue: account.requirements?.currently_due ?? [],
  };
}

export async function createConnectAccountLink(userId: string) {
  const account = await getOrCreateConnectedAccount(userId);
  return stripe.accountLinks.create({
    account,
    refresh_url: `${publicAppUrl()}/api/wallet/connect/refresh`,
    return_url: `${publicAppUrl()}/wallet/withdraw?connect=return`,
    type: 'account_onboarding',
  });
}

export async function createConnectedAccountTransfer(input: {
  amount: number;
  destination: string;
  userId: string;
  transactionId: string;
  idempotencyKey: string;
}): Promise<Stripe.Transfer> {
  return stripe.transfers.create(
    {
      amount: input.amount,
      currency: 'usd',
      destination: input.destination,
      metadata: {
        playstakeUserId: input.userId,
        transactionId: input.transactionId,
      },
    },
    { idempotencyKey: `connect_${input.idempotencyKey}` },
  );
}
