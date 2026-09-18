import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { emailBetaSignup } from '@/lib/email/events';
import { errorResponse } from '@/lib/errors';
import { betaSignupRateLimit } from '@/lib/middleware/rate-limit';
import { validateBody } from '@/lib/middleware/validate';
import { betaSignupSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const rateLimited = betaSignupRateLimit(request);
    if (rateLimited) return rateLimited;

    const input = validateBody(betaSignupSchema, await request.json());
    const consentedAt = new Date();

    const signup = await prisma.betaSignup.upsert({
      where: { email: input.email },
      create: {
        name: input.name,
        email: input.email,
        game: input.game,
        playerType: input.playerType,
        consentedAt,
      },
      update: {
        name: input.name,
        game: input.game,
        playerType: input.playerType,
        consentedAt,
      },
    });

    await emailBetaSignup(input.email, input.name, signup.id);

    return NextResponse.json(
      { message: 'Beta access request saved' },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
