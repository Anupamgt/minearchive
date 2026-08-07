import './globals.css';
import { ToastProvider } from './components/ToastProvider';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'MineArchive — Mining Area Directory & Spatial Archive',
  description: 'Enterprise spatial archive and encroachment monitoring directory for mining enclosures.',
  keywords: ['mining', 'archive', 'KML', 'directory', 'nodes', 'PostGIS', 'encroachment'],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
