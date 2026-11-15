import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('config');

export default function ConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
