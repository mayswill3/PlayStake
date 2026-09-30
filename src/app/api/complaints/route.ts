import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ComplaintCategory } from "../../../../generated/prisma/client";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors";
import { complaintRateLimit } from "@/lib/middleware/rate-limit";
import { fileComplaint, listCustomerComplaints } from "@/lib/complaints/service";

const complaintSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  category: z.nativeEnum(ComplaintCategory),
  description: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(5000),
  betId: z.string().uuid().optional().nullable(),
});

async function currentUser(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) return null;
  return (await validateSession(token))?.user ?? null;
}

/**
 * POST /api/complaints — file a complaint. Signed-in customers are linked to
 * their account; anyone else (e.g. someone who can't sign in) gives a name
 * and email.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = complaintRateLimit(request);
    if (limited) return limited;

    const parsed = complaintSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Please check the form", parsed.error.flatten().fieldErrors);
    }
    const user = await currentUser(request);
    const name = parsed.data.name ?? user?.displayName;
    const email = parsed.data.email ?? user?.email;
    if (!name || !email) {
      throw new ValidationError("Give your name and email so we can reply");
    }

    const complaint = await fileComplaint({
      userId: user?.id ?? null,
      name,
      email,
      category: parsed.data.category,
      description: parsed.data.description,
      betId: parsed.data.betId ?? null,
    });
    return NextResponse.json(
      {
        reference: complaint.reference,
        finalResponseDueAt: complaint.finalResponseDueAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET /api/complaints — the signed-in customer's complaints. */
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser(request);
    if (!user) throw new AuthenticationError();
    return NextResponse.json({ complaints: await listCustomerComplaints(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
