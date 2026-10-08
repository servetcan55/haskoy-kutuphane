'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getAcademicInfo } from '@/lib/academic';

export default function StudentPortalPage() {
  const currentAcademic = getAcademicInfo();

  // Oturum State'leri
  const [currentStudent, setCurrentStudent] = useState(null);
  const [inputNo, setInputNo] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Veri State'leri
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState([]);
  const [activeLoans, setActiveLoans] = useState([]);
  const [completedLoans, setCompletedLoans] = useState([]);
  const [favorites, setFavorites] = useState([]); // book_id array

  // Filtreleme & Arama
  const [search, setSearch] = useState('');
  const [filterShelf, setFilterShelf] = useState('all'); // 'all', 'available'
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog', 'history', 'favorites'

  // "Bana Kitap Öner" Modal State'i
  const [recommendedBook, setRecommendedBook] = useState(null);
  const [showRecommendModal, setShowRecommendModal] = useState(false);

  // 1. Tarayıcıda Kayıtlı Öğrenci Var mı Kontrol Et
  useEffect(() => {
    const saved = localStorage.getItem('haskoy_student_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id) {
          fetchStudentProfile(parsed.id);
        }
      } catch (e) {
        localStorage.removeItem('haskoy_student_session');
      }
    }
  }, []);

  // 2. Öğrenci Profilini ve Verilerini Getir
  const fetchStudentProfile = async (studentId) => {
    setLoading(true);

    const [studentRes, booksRes, loansRes, favRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).single(),
      supabase.from('books').select('*'),
      supabase.from('loans').select('*'),
      supabase.from('student_favorites').select('book_id').eq('student_id', studentId),
    ]);

    if (studentRes.data) {
      setCurrentStudent(studentRes.data);
      localStorage.setItem('haskoy_student_session', JSON.stringify(studentRes.data));
    }

    const allBooks = booksRes.data || [];
    const rawLoans = loansRes.data || [];
    const favIds = (favRes.data || []).map((f) => f.book_id);
    setFavorites(favIds);

    const isReturned = (status, returnDate) => {
      if (returnDate) return true;
      if (!status) return false;
      const s = String(status).toLowerCase().trim();
      return (s.includes('iade') || s.includes('return') || s.includes('teslim') || s.includes('tamam')) && !s.includes('kayıp');
    };

    // Hangi kitaplar şu an emanette? (İade edilmemiş tüm loan kayıtları)
    const activeLoanBookIds = new Set(
      rawLoans.filter((l) => !isReturned(l.status, l.return_date)).map((l) => String(l.book_id))
    );

    // Kitapların sayfa sayısını destekleyen güvenli okuma (page_count veya sayfa_sayisi)
    const processedBooks = allBooks.map((b) => ({
      ...b,
      page_count: Number(b.page_count || b.sayfa_sayisi || 0),
      isAvailable: !activeLoanBookIds.has(String(b.id)),
    }));
    setBooks(processedBooks);

    // Öğrencinin kendi hareketleri
    const myRawLoans = rawLoans.filter((l) => String(l.student_id) === String(studentId));

    const myLoans = myRawLoans.map((l) => {
      const foundBook = processedBooks.find((b) => String(b.id) === String(l.book_id));
      return { ...l, book: foundBook || null };
    });

    // Öğrencinin elindekiler
    const currentActive = myLoans.filter((l) => !isReturned(l.status, l.return_date));
    setActiveLoans(currentActive);

    // Öğrencinin tamamladığı okumalar (Geçmiş)
    const completed = myLoans.filter((l) => isReturned(l.status, l.return_date));
    setCompletedLoans(completed);

    setLoading(false);
  };

  // 3. Okul Numarasıyla Giriş Yap
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!inputNo.trim()) return;

    setAuthLoading(true);
    setLoginError('');

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('student_number', inputNo.trim())
      .maybeSingle();

    setAuthLoading(false);

    if (error || !data) {
      setLoginError('Bu okul numarasıyla kayıtlı öğrenci bulunamadı. Lütfen kütüphaneciye danışın.');
    } else {
      fetchStudentProfile(data.id);
    }
  };

  // 4. Çıkış Yap
  const handleLogout = () => {
    localStorage.removeItem('haskoy_student_session');
    setCurrentStudent(null);
    setInputNo('');
  };

  // 5. Favoriye Ekle / Çıkar
  const toggleFavorite = async (bookId) => {
    if (!currentStudent) return;

    const isFav = favorites.includes(bookId);
    if (isFav) {
      setFavorites((prev) => prev.filter((id) => id !== bookId));
      await supabase
        .from('student_favorites')
        .delete()
        .eq('student_id', currentStudent.id)
        .eq('book_id', bookId);
    } else {
      setFavorites((prev) => [...prev, bookId]);
      await supabase.from('student_favorites').insert([
        { student_id: currentStudent.id, book_id: bookId },
      ]);
    }
  };

  // 6. ⭐ "Bana Kitap Öner!" Algoritması
  const handleRecommendBook = () => {
    const readBookIds = new Set(completedLoans.map((l) => String(l.book_id)));
    const availableBooks = books.filter(
      (b) => b.isAvailable && !readBookIds.has(String(b.id))
    );

    const pool = availableBooks.length > 0 ? availableBooks : books.filter((b) => b.isAvailable);

    if (pool.length === 0) {
      alert('Şu an kütüphane rafında uygun kitap bulunamadı.');
      return;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    setRecommendedBook(pool[randomIndex]);
    setShowRecommendModal(true);
  };

  // Öğrencinin toplam okuduğu sayfa hesabı
  const totalReadPages = completedLoans.reduce(
    (acc, curr) => acc + (Number(curr.book?.page_count) || 0),
    0
  );

  // Arama & Filtreleme Listesi
  const filteredBooks = books.filter((b) => {
    const matchSearch =
      b.title?.toLowerCase().includes(search.toLowerCase()) ||
      b.author?.toLowerCase().includes(search.toLowerCase());
    const matchShelf = filterShelf === 'available' ? b.isAvailable : true;
    return matchSearch && matchShelf;
  });

  // =========================================================================
  // GİRİŞ EKRANI (Öğrenci Giriş Yapmamışsa)
  // =========================================================================
  if (!currentStudent) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 antialiased selection:bg-indigo-500 selection:text-white">
        <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-7 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-indigo-500/30">
            📖
          </div>

          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-indigo-400">
              Hasköy Ortaokulu Kütüphanesi
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">Öğrenci Okur Portalı</h1>
            <p className="text-xs text-slate-400 mt-1">
              Kütüphane kataloğunda kitap arayın, elinizdeki iade gününü ve okuma geçmişinizi takip edin.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Okul Numaranız
              </label>
              <input
                type="number"
                placeholder="Örn: 125"
                value={inputNo}
                onChange={(e) => setInputNo(e.target.value)}
                required
                className="w-full text-base font-bold p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition font-mono"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {authLoading ? 'Giriş Yapılıyor...' : 'Kitaplığıma Giriş Yap 🚀'}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-700/60">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
              ← Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ÖĞRENCİ ANA PANELİ
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 antialiased">
      {/* 1. ÜST COMMAND BAR */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xl shadow-2xs shrink-0">
              {currentStudent.gender === 'kiz' ? '👧' : currentStudent.gender === 'erkek' ? '👦' : '🎓'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900">{currentStudent.full_name}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {currentStudent.grade_class}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">No: {currentStudent.student_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRecommendBook}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>⭐</span>
              <span className="hidden sm:inline">Bana Kitap Öner</span>
            </button>

            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        
        {/* 2. KİŞİSEL OKUMA MASASI & İSTATİSTİK ÖZETİ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Şu An Elimde</span>
            <p className="text-2xl font-black text-blue-600 mt-1">{activeLoans.length} Kitap</p>
            <span className="text-[11px] text-slate-500">Okumakta olduğun</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bitirdiğim Kitap</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{completedLoans.length} Kitap</p>
            <span className="text-[11px] text-emerald-600">Başarıyla iade edilen</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white shadow-2xs">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
              <span>📄</span> Toplam Sayfam
            </span>
            <p className="text-2xl font-black text-amber-600 mt-1 font-mono">
              {totalReadPages.toLocaleString('tr-TR')} sf.
            </p>
            <span className="text-[11px] text-amber-700">Devirdiğin toplam sayfa</span>
          </div>
        </div>

        {/* 3. ŞU AN ELİNDE OLAN KİTAP VE İADE TAKİBİ */}
        {activeLoans.length > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⏳</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-100">
                Şu An Elindeki Kitap(lar) & İade Takibi
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeLoans.map((al) => (
                <div key={al.id} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4">
                  {al.book?.cover_url ? (
                    <img src={al.book.cover_url} alt="" className="w-12 h-16 object-cover rounded-xl shadow-md shrink-0" />
                  ) : (
                    <div className="w-12 h-16 bg-white/20 rounded-xl flex items-center justify-center text-2xl shrink-0">
                      📖
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-white truncate">{al.book?.title}</h3>
                    <p className="text-xs text-blue-200 truncate">{al.book?.author}</p>
                    <div className="mt-2 text-[11px] font-medium bg-white/20 px-2.5 py-1 rounded-lg inline-block">
                      Alış Tarihi: <strong>{al.loan_date || '-'}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. MODÜL SEKMELERİ */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            📚 Kitap Kataloğu ({books.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            📜 Okuma Geçmişim ({completedLoans.length})
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            ❤️ Favorilerim ({favorites.length})
          </button>
        </div>

        {/* 5. TAB 1: KİTAP KATALOĞU */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Kitap veya yazar ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setFilterShelf('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filterShelf === 'all' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setFilterShelf('available')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filterShelf === 'available' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  🟢 Sadece Raftakiler
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredBooks.map((b) => {
                const isFav = favorites.includes(b.id);
                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between group hover:shadow-md transition relative"
                  >
                    <button
                      onClick={() => toggleFavorite(b.id)}
                      className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm transition shadow-2xs cursor-pointer ${
                        isFav ? 'bg-rose-50 text-rose-500' : 'bg-slate-100/80 text-slate-400 hover:text-rose-500'
                      }`}
                    >
                      {isFav ? '❤️' : '🤍'}
                    </button>

                    <div>
                      {b.cover_url ? (
                        <img
                          src={b.cover_url}
                          alt=""
                          className="w-full h-44 object-cover rounded-2xl mb-3 shadow-inner"
                        />
                      ) : (
                        <div className="w-full h-44 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl mb-3 text-slate-300">
                          📖
                        </div>
                      )}

                      <h3 className="font-bold text-xs text-slate-900 truncate" title={b.title}>
                        {b.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{b.author}</p>
                      {b.page_count > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          {b.page_count} sayfa
                        </span>
                      )}
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
                      {b.isAvailable ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Rafta
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                          Emanette
                        </span>
                      )}

                      {b.shelf_location && (
                        <span className="text-[9px] font-mono text-slate-400">
                          📍 {b.shelf_location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. TAB 2: OKUMA GEÇMİŞİM */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Tamamladığın Kitaplar</h3>
            {completedLoans.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">Henüz iade edilmiş kitap kaydınız yok.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {completedLoans.map((cl) => (
                  <div key={cl.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {cl.book?.cover_url ? (
                        <img src={cl.book.cover_url} alt="" className="w-10 h-14 object-cover rounded-xl border shadow-2xs shrink-0" />
                      ) : (
                        <div className="w-10 h-14 bg-slate-100 rounded-xl border flex items-center justify-center text-xs shrink-0">
                          📖
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{cl.book?.title || 'Kitap Adı Bulunamadı'}</h4>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{cl.book?.author || 'Yazar belirtilmemiş'}</p>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          İade Tarihi: {cl.return_date || cl.due_date || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 block">
                        ✓ Tamamlandı
                      </span>
                      {cl.book?.page_count > 0 && (
                        <span className="text-[11px] text-amber-600 font-black font-mono block mt-1">
                          +{cl.book.page_count} sf.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. TAB 3: FAVORİLERİM */}
        {activeTab === 'favorites' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Okumak İstediğin Favori Kitaplar</h3>
            {favorites.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
                Henüz favorilerine kitap eklemedin. Katalogdan ❤️ butonuna basarak ekleyebilirsin!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {books
                  .filter((b) => favorites.includes(b.id))
                  .map((b) => (
                    <div key={b.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-2 relative">
                      <button
                        onClick={() => toggleFavorite(b.id)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-sm transition shadow-2xs cursor-pointer"
                      >
                        ❤️
                      </button>
                      {b.cover_url ? (
                        <img src={b.cover_url} alt="" className="w-full h-36 object-cover rounded-2xl mb-2" />
                      ) : (
                        <div className="w-full h-36 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl mb-2">📖</div>
                      )}
                      <h4 className="font-bold text-xs text-slate-900 truncate">{b.title}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{b.author}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ⭐ BANA KİTAP ÖNER MODALI */}
      {showRecommendModal && recommendedBook && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <span className="text-4xl block animate-bounce">🎁</span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                Kütüphanenin Sana Özel Önerisi
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1">{recommendedBook.title}</h3>
              <p className="text-xs text-slate-500">{recommendedBook.author}</p>
            </div>

            {recommendedBook.cover_url && (
              <img
                src={recommendedBook.cover_url}
                alt=""
                className="w-24 h-36 object-cover rounded-xl mx-auto shadow-md border"
              />
            )}

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
              ✓ Şu an kütüphane rafında boşta duruyor, teneffüste gidip alabilirsin!
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleRecommendBook}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                🔄 Başka Öner
              </button>
              <button
                onClick={() => setShowRecommendModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}