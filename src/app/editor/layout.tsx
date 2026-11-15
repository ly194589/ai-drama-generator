import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('editor');

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
