import type { Metadata } from 'next';
import { JoinFlow } from './join-flow';

export const metadata: Metadata = { title: 'Join loyalty program' };

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <JoinFlow slug={slug} />;
}
