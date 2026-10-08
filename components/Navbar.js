'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  // Kim giriş yaparsa yapsın adını dinamik tespit eder
  const getDisplayName = (u) => {
    if (!u) return '';
    if (u.user_metadata?.full_name) return u.user_metadata.full_name;
    if (u.user_metadata?.name) return u.user_metadata.name;
    if (u.email === 'servetcan08@gmail.com') return 'Servet CAN';

    const prefix = u.email ? u.email.split('@')[0] : 'Yönetici';
    return prefix
      .replace(/[._\d]/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Kütüphane Yetkilisi';
  };

  const displayName = getDisplayName(user);

  const navLinks = [
    { name: 'Ödünç Masası', href: '/', icon: '📖' },
    { name: 'Kitaplar', href: '/kitaplar', icon: '📚' },
    { name: 'Kitap Ekle', href: '/kitap-ekle', icon: '➕' },
    { name: 'Öğrenciler', href: '/ogrenciler', icon: '🎓' },
    { name: 'Emanet Takip', href: '/emanetler', icon: '⏳' },
    { name: 'Barkod & Etiket', href: '/etiketler', icon: '🏷️' },
    { name: 'İstatistikler', href: '/istatistikler', icon: '📊' },
  ];

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 shadow-[0_2px_10px_rgba(0,0,0,0.03)] print:hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Sol: Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
            H
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold tracking-wider uppercase bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Samsun Canik
            </span>
            <span className="text-sm font-bold text-slate-800 tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
              Hasköy Ortaokulu Kütüphanesi
            </span>
          </div>
        </Link>

        {/* Orta: Linkler */}
        <nav className="hidden xl:flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-inner">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-xs shadow-slate-300 font-bold scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span className="text-xs">{link.icon}</span>
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Orta: Küçük Ekranlar */}
        <nav className="flex xl:hidden items-center gap-1 overflow-x-auto py-1 max-w-[45vw] no-scrollbar">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sağ: Giriş Yapan Kişi */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 py-1 px-2.5 rounded-xl shadow-2xs">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                {displayName.charAt(0)}
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-slate-800">
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Kütüphane Yetkilisi
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="ml-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-rose-100"
                title="Oturumu Kapat"
              >
                Çıkış
              </button>
            </div>
          ) : null}
        </div>

      </div>
    </header>
  );
}