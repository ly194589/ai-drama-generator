import { Metadata } from 'next';
import { getPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = getPageMetadata('chat');

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
