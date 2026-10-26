import type { Metadata } from 'next';
import { RecordingView } from './RecordingView';

export const metadata: Metadata = { title: 'Match recording', robots: { index: false, follow: false } };

/**
 * What the recorder captures: both players' and the referee's Kick streams
 * with a live match clock and events panel, laid out at exactly 1920×1080.
 * Opened only by the recorder service, with a signed token.
 */
export default async function RecorderPage({
  params,
  searchParams,
}: {
  params: Promise<{ betId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { betId } = await params;
  const { token } = await searchParams;
  return <RecordingView betId={betId} token={token ?? ''} />;
}
