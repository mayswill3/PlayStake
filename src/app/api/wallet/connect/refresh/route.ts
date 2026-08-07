import { NextResponse } from 'next/server';
import { withSessionAuth } from '@/lib/middleware/auth';
import { assertTestPaymentsEnabled } from '@/lib/payments/policy';
import { createConnectAccountLink } from '@/lib/payments/connect';

export const GET = withSessionAuth(async (request, _context, auth) => {
  try {
    assertTestPaymentsEnabled();
    const link = await createConnectAccountLink(auth.userId);
    return NextResponse.redirect(link.url, 303);
  } catch (error) {
    console.error('[Connect] Could not refresh onboarding:', error);
    return NextResponse.redirect(new URL('/wallet/withdraw?connect=error', request.url));
  }
});
