import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('videos');

export default function VideosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
