import './globals.css';
import ClientLayout from '@/components/ClientLayout'; // Birazdan oluşturacağımız sarmalayıcı

export const metadata = {
  title: 'Hasköy Ortaokulu Kütüphane Otomasyonu',
  description: 'Hasköy Ortaokulu Kütüphane ve Envanter Takip Sistemi',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body className="bg-slate-50 text-slate-800 min-h-screen antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}