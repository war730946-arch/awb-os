import './globals.css';

export const metadata = {
  title: 'AWB-OS | AI WhatsApp Business OS',
  description: 'AI-powered WhatsApp Business Management Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
