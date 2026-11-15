import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('drama');

export default function DramaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
