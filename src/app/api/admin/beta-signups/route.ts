import { withRoleGuard } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/client';
import { adminBetaSignupListQuerySchema } from '@/lib/validation/schemas';
import { Prisma, UserRole } from '../../../../../generated/prisma/client';

export const GET = withRoleGuard([UserRole.ADMIN], async (request) => {
  const url = new URL(request.url);
  const parsed = adminBetaSignupListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { page, limit, playerType, game, search } = parsed.data;
  const where: Prisma.BetaSignupWhereInput = {};

  if (playerType) where.playerType = playerType;
  if (game) where.game = game;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [signups, total] = await Promise.all([
    prisma.betaSignup.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        game: true,
        playerType: true,
        consentedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.betaSignup.count({ where }),
  ]);

  return Response.json({
    data: signups,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
