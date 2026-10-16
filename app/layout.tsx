import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { FileViewerProvider } from '@/context/FileViewerContext';
import { FileViewerModal } from '@/app/components/FileViewerModal';
import { PwaRegister } from '@/app/components/PwaRegister';
import { Toaster } from '@/app/components/ui/sonner';
import { EmailInboxWidget } from '@/app/components/dev/EmailInboxWidget';
import { emailInboxEnabled } from '@/lib/email';

export const metadata: Metadata = {
  title: 'Proplity — Smart Property Management Platform',
  description:
    'Proplity — property management platform for managers, landlords, tenants, and service providers.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Proplity',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <FileViewerProvider>
            {children}
            <FileViewerModal />
          </FileViewerProvider>
        </AuthProvider>
        <PwaRegister />
        <Toaster position="top-right" richColors closeButton />
        {emailInboxEnabled() && <EmailInboxWidget />}
      </body>
    </html>
  );
}

