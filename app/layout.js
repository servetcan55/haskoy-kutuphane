'use client';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CommandPalette from '@/components/CommandPalette';
import './globals.css';

export default function RootLayout({ children }) {
  const pathname = usePathname();

  // Sadece bu özel sayfalarda sol menü (Sidebar) ve arama çubuğu tamamen gizlenir
  const isPublicPage = 
    pathname === '/' || 
    pathname === '/login' || 
    pathname === '/pano' || 
    pathname === '/ogrenci' || 
    pathname.startsWith('/ogrenci/');

  return (
    <html lang="tr">
      <head>
  <title>Hasköy Ortaokulu Kütüphane Otomasyonu</title>
  <meta name="description" content="Hasköy Ortaokulu Kütüphane ve Envanter Takip Sistemi" />
  <link rel="icon" href="/favicon.ico" />
</head>
      <body className="bg-slate-50 text-slate-800 min-h-screen antialiased">
        {isPublicPage ? (
          // Halka açık sayfalar (Tam ekran, Sidebar yok)
          children
        ) : (
          // YÖNETİCİ SAYFALARI: Sol menü ve sağ içerik yan yana sabit grid yapısı
          <div className="flex h-screen overflow-hidden bg-slate-900/5">
            <CommandPalette />
            <div className="w-64 flex-shrink-0 h-full">
              <Sidebar />
            </div>
            <main className="flex-1 h-full overflow-y-auto p-6 lg:p-8">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}