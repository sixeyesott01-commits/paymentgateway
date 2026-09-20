export const metadata = {
  title: 'Payment Gateway',
  description: 'Secure payment links',
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
