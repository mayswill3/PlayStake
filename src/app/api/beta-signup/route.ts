import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
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

    await prisma.betaSignup.upsert({
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

    return NextResponse.json(
      { message: 'Beta access request saved' },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
