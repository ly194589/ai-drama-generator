import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('solution');

export default function SolutionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
