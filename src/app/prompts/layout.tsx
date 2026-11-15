import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('prompts');

export default function PromptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
