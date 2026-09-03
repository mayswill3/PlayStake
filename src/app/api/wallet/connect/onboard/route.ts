import { withSessionAuth } from '@/lib/middleware/auth';
import { assertTestPaymentsEnabled } from '@/lib/payments/policy';
import { createConnectAccountLink } from '@/lib/payments/connect';
import { isKycVerified } from '@/lib/kyc/policy';

export const POST = withSessionAuth(async (_request, _context, auth) => {
  if (!auth.user.emailVerified) {
    return Response.json(
      { error: 'Verify your email before setting up withdrawals' },
      { status: 403 },
    );
  }

  if (!isKycVerified(auth.user)) {
    return Response.json(
      {
        error: 'Verify your identity before setting up withdrawals',
        code: 'KYC_REQUIRED',
      },
      { status: 403 },
    );
  }

  try {
    assertTestPaymentsEnabled();
    const link = await createConnectAccountLink(auth.userId);
    return Response.json({ url: link.url });
  } catch (error) {
    console.error('[Connect] Could not start onboarding:', error);
    return Response.json(
      { error: 'Withdrawal setup is currently unavailable' },
      { status: 503 },
    );
  }
});
