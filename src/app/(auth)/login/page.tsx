import { redirect } from 'next/navigation';

interface LegacyLoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyLoginPage({
  searchParams,
}: LegacyLoginPageProps) {
  const values = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  redirect(query.size > 0 ? `/?${query.toString()}` : '/');
}
