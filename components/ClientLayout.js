'use client';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CommandPalette from '@/components/CommandPalette';

export default function ClientLayout({ children }) {
  const pathname = usePathname();

  const isPublicPage = 
    pathname === '/' || 
    pathname === '/login' || 
    pathname === '/pano' || 
    pathname === '/ogrenci' || 
    pathname.startsWith('/ogrenci/');

  return (
    <>
      {isPublicPage ? (
        children
      ) : (
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
    </>
  );
}