import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('workflow');

export default function WorkflowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
