import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('audio');

export default function AudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
