import { withRoleGuard } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/client';
import { adminBetaSignupListQuerySchema } from '@/lib/validation/schemas';
import { buildDemoBetaSignups } from '@/lib/beta/demo-signups';
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

  const [signups, total, realTotal, demoTotal] = await Promise.all([
    prisma.betaSignup.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        game: true,
        playerType: true,
        isDemo: true,
        consentedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.betaSignup.count({ where }),
    prisma.betaSignup.count({ where: { ...where, isDemo: false } }),
    prisma.betaSignup.count({ where: { ...where, isDemo: true } }),
  ]);

  return Response.json({
    data: signups,
    pagination: {
      page,
      limit,
      total,
      realTotal,
      demoTotal,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const POST = withRoleGuard([UserRole.ADMIN], async () => {
  const result = await prisma.betaSignup.createMany({
    data: buildDemoBetaSignups(),
    skipDuplicates: true,
  });
  const demoTotal = await prisma.betaSignup.count({ where: { isDemo: true } });

  return Response.json(
    {
      created: result.count,
      demoTotal,
      message:
        result.count > 0
          ? `${result.count} demo profiles added`
          : 'All demo profiles already exist',
    },
    { status: result.count > 0 ? 201 : 200 },
  );
});

export const DELETE = withRoleGuard([UserRole.ADMIN], async () => {
  const result = await prisma.betaSignup.deleteMany({
    where: { isDemo: true },
  });

  return Response.json({
    deleted: result.count,
    message: `${result.count} demo profiles removed`,
  });
});
