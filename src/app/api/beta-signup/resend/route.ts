import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { queueEmailSafely } from '@/lib/email/outbox';
import { errorResponse } from '@/lib/errors';
import { betaResendRateLimit } from '@/lib/middleware/rate-limit';
import { validateBody } from '@/lib/middleware/validate';

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(255) });

/** Most confirmation emails one address can get in a day, including the first. */
const MAX_PER_DAY = 3;

/**
 * POST /api/beta-signup/resend { email } — send the beta confirmation again.
 * Always answers the same way, so it can't be used to find out who's on the
 * list; capped per address and per IP.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimited = betaResendRateLimit(request);
    if (rateLimited) return rateLimited;
    const { email } = validateBody(schema, await request.json().catch(() => ({})));

    const signup = await prisma.betaSignup.findUnique({ where: { email }, select: { id: true, name: true } });
    if (signup) {
      const sentToday = await prisma.emailOutbox.count({
        where: { toEmail: email, template: 'beta.signup-received', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
      if (sentToday < MAX_PER_DAY) {
        await queueEmailSafely({
          template: 'beta.signup-received',
          dedupeKey: `beta-signup-${signup.id}-resend-${Date.now()}`,
          toEmail: email,
          payload: { name: signup.name ?? '' },
        });
      }
    }
    return NextResponse.json({ message: "If you're on the list, we've sent your confirmation again." });
  } catch (error) {
    return errorResponse(error);
  }
}
