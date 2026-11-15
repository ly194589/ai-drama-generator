import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('images');

export default function ImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
