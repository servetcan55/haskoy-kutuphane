'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const router = useRouter();

  // Sabit Sayfa Kısayolları
  const staticNavigation = [
    { title: 'Ana Sayfa (Dashboard)', href: '/', category: 'Sayfalar', icon: '🏠' },
    { title: 'Ödünç Masası (Kitap Ver/Al)', href: '/odunc-ver', category: 'Sayfalar', icon: '📖' },
    { title: 'Kitap Envanteri', href: '/kitaplar', category: 'Sayfalar', icon: '📚' },
    { title: 'Öğrenci Yönetimi', href: '/ogrenciler', category: 'Sayfalar', icon: '🎓' },
    { title: 'Barkodlu Öğrenci Kartları Bas', href: '/ogrenci-kartlari', category: 'Sayfalar', icon: '🪪' },
    { title: 'Emanet Takip & Durum Yönetimi', href: '/emanetler', category: 'Sayfalar', icon: '⏳' },
    { title: 'Barkod & Etiket Basım Masası', href: '/etiketler', category: 'Sayfalar', icon: '🏷️' },
    { title: 'İstatistikler & e-Okul Raporu', href: '/istatistikler', category: 'Sayfalar', icon: '📊' },
    { title: 'Canlı Kiosk TV Panosu', href: '/pano', category: 'Sayfalar', icon: '🖥️' },
  ];

  // Ctrl+K veya Cmd+K Tuş Dinleyicisi
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Açıldığında inputa odaklan
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Arama Sorgusu (Debounce ile Supabase verisi çekme)
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setStudents([]);
      setBooks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const searchTimeout = setTimeout(async () => {
      const q = query.trim();

      const [stRes, bkRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, student_number, full_name, grade_class, gender')
          .or(`full_name.ilike.%${q}%,student_number.ilike.%${q}%,grade_class.ilike.%${q}%`)
          .limit(5),
        supabase
          .from('books')
          .select('id, title, author, cover_url, isbn')
          .or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%`)
          .limit(5),
      ]);

      setStudents(stRes.data || []);
      setBooks(bkRes.data || []);
      setLoading(false);
      setSelectedIndex(0);
    }, 200);

    return () => clearTimeout(searchTimeout);
  }, [query, isOpen]);

  // Filtrelenmiş Statik Sayfalar
  const filteredNav = staticNavigation.filter((nav) =>
    nav.title.toLowerCase().includes(query.toLowerCase())
  );

  // Bütün sonuçları tek bir sırada topluyoruz
  const allResults = [
    ...students.map((s) => ({
      id: `st-${s.id}`,
      type: 'student',
      title: s.full_name,
      subtitle: `No: ${s.student_number} • Sınıf: ${s.grade_class || 'Belirtilmedi'}`,
      href: `/ogrenciler/${s.id}`,
      icon: s.gender === 'kiz' ? '👧' : s.gender === 'erkek' ? '👦' : '🎓',
    })),
    ...books.map((b) => ({
      id: `bk-${b.id}`,
      type: 'book',
      title: b.title,
      subtitle: `Yazar: ${b.author} ${b.isbn ? `• ISBN: ${b.isbn}` : ''}`,
      href: `/kitaplar`,
      icon: '📖',
      cover_url: b.cover_url,
    })),
    ...filteredNav.map((n) => ({
      id: `nav-${n.href}`,
      type: 'page',
      title: n.title,
      subtitle: 'Sistem Sayfası',
      href: n.href,
      icon: n.icon,
    })),
  ];

  // Klavye Yukarı/Aşağı ve Enter Gezinimi
  const handleInputKeyDown = (e) => {
    if (allResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allResults.length) % allResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = allResults[selectedIndex];
      if (selected) {
        navigateTo(selected.href);
      }
    }
  };

  const navigateTo = (href) => {
    setIsOpen(false);
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150 select-none"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Üst Arama Girdisi */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <span className="text-slate-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Öğrenci adı, okul no, kitap ismi veya gitmek istediğiniz sayfa..."
            className="w-full text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          )}
          <span className="text-[10px] font-bold font-mono px-2 py-1 bg-slate-100 text-slate-500 rounded-lg border border-slate-200">
            ESC
          </span>
        </div>

        {/* Sonuç Listesi */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 font-mono">
              Arama yapılıyor...
            </div>
          ) : allResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              "{query}" ile eşleşen öğrenci, kitap veya sayfa bulunamadı.
            </div>
          ) : (
            allResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => navigateTo(item.href)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition ${
                    isSelected ? 'bg-indigo-50 border border-indigo-200/80' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.cover_url ? (
                      <img src={item.cover_url} alt="" className="w-8 h-11 object-cover rounded-md border shrink-0" />
                    ) : (
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.icon}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 capitalize">
                      {item.type === 'student' ? 'Öğrenci' : item.type === 'book' ? 'Kitap' : 'Sayfa'}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-indigo-600 font-mono bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                        Enter ↵
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Alt Bilgi İpuçları Çubuğu */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[9px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[9px]">↓</kbd> Gezin
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[9px]">↵</kbd> Seç
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[9px]">ESC</kbd> Kapat
            </span>
          </div>
          <span className="font-semibold text-indigo-600">Hasköy Hızlı Arama</span>
        </div>
      </div>
    </div>
  );
}