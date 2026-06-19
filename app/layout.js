import './globals.css';

export const metadata = {
  title: 'MineArchive',
  description: 'Mining Area Directory & Archive',
  keywords: ['mining', 'archive', 'KML', 'directory', 'nodes'],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
