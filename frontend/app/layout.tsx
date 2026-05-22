import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Resume Assistant — Agentic AI Hiring Platform',
  description:
    'AI-powered intelligent resume assistant. Upload resumes, extract structured data, and get grounded answers from an agentic AI system.',
  keywords: ['AI', 'resume', 'hiring', 'recruiter', 'assistant', 'LLM'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(15,23,42,0.95)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#e2e8f0',
            },
          }}
        />
      </body>
    </html>
  );
}
