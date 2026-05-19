import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LabManager — Gestão de Laboratórios',
  description:
    'Sistema de gestão e monitoramento de computadores nos laboratórios de informática do CCI.',
  keywords: ['laboratório', 'gestão', 'manutenção', 'computadores', 'CCI'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
