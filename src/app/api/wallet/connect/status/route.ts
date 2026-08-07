import { withSessionAuth } from '@/lib/middleware/auth';
import { getPaymentMode } from '@/lib/payments/policy';
import { syncConnectStatus } from '@/lib/payments/connect';

export const GET = withSessionAuth(async (_request, _context, auth) => {
  const mode = getPaymentMode();
  if (mode === 'disabled') {
    return Response.json({
      mode,
      accountId: null,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      currentlyDue: [],
    });
  }

  return Response.json({ mode, ...(await syncConnectStatus(auth.userId)) });
});
