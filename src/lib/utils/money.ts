import { Decimal } from "@prisma/client/runtime/client";

/**
 * Convert cents (integer) to dollars (Decimal).
 *
 * The database stores monetary values as Decimal(14,2) in dollars.
 * The API layer works in cents (integers) to avoid floating-point issues.
 */
export function centsToDollars(cents: number): Decimal {
  return new Decimal(cents).dividedBy(100);
}

/**
 * Convert dollars (Decimal) to cents (integer).
 *
 * Rounds to the nearest cent to handle any sub-cent precision.
 */
export function dollarsToCents(dollars: Decimal | string | number): number {
  const d = new Decimal(dollars.toString());
  return d.times(100).round().toNumber();
}
