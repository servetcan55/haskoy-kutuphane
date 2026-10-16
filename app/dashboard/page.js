'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getAcademicInfo, matchesPeriod } from '@/lib/academic';
import { useStaffAuth } from '@/lib/useStaffAuth';

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useStaffAuth();
  const [savedStudent, setSavedStudent] = useState(null);

  const [period, setPeriod] = useState('term'); // 'term', 'month', 'all'
  const [leaderTab, setLeaderTab] = useState('month'); // 'month' (Bu Ay) | 'term' (Bu Dönem)
  const [leaderMetric, setLeaderMetric] = useState('books'); // 'books' (Kitap) | 'pages' (Sayfa)
  const currentAcademic = getAcademicInfo();

  const [stats, setStats] = useState({
    totalBooks: 0,
    totalStudents: 0,
    activeLoans: 0,
    overdueLoans: 0,
    periodCompleted: 0,
  });
  const [impendingReturns, setImpendingReturns] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  
  // İlk 3 Öğrenci & İlk 3 Sınıf Listeleri
  const [leaders, setLeaders] = useState({
    monthTopStudentsBooks: [],
    monthTopStudentsPages: [],
    monthTopClassesBooks: [],
    monthTopClassesPages: [],
    termTopStudentsBooks: [],
    termTopStudentsPages: [],
    termTopClassesBooks: [],
    termTopClassesPages: [],
  });

  const [loading, setLoading] = useState(true);

  // Cihazda kayıtlı öğrenci oturumu varsa yakala
  useEffect(() => {
    const studentSession = localStorage.getItem('haskoy_student_session');
    if (studentSession) {
      try {
        const parsed = JSON.parse(studentSession);
        if (parsed?.full_name) {
          setSavedStudent(parsed);
        }
      } catch (e) {}
    }
  }, []);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1000 kayıt sınırını aşarak tüm kitapları (2576+) döngüyle çekiyoruz
      let allBooks = [];
      let step = 1000;
      let from = 0;
      let to = 999;
      let keepFetching = true;

      while (keepFetching) {
        const { data, error } = await supabase
          .from('books')
          .select('id, title, author, cover_url, available_copies, page_count')
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allBooks = [...allBooks, ...data];
          if (data.length < step) {
            keepFetching = false;
          } else {
            from += step;
            to += step;
          }
        } else {
          keepFetching = false;
        }
      }

      const [studentsRes, loansRes] = await Promise.all([
        supabase.from('students').select('id, student_number, full_name, grade_class, gender, photo_url'),
        supabase.from('loans').select(`
          id,
          loan_date,
          due_date,
          return_date,
          status,
          student_id,
          book_id,
          books:book_id ( id, title, author, cover_url, available_copies, page_count ),
          students:student_id ( id, full_name, student_number, grade_class, gender, photo_url )
        `).order('id', { ascending: false }),
      ]);

      const books = allBooks;
      const students = studentsRes.data || [];
      const loans = loansRes.data || [];

      const isReturned = (status) => {
        if (!status) return false;
        const s = String(status).toLowerCase();
        return (s.includes('iade') || s.includes('return')) && !s.includes('kayıp');
      };

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const active = loans.filter((l) => !isReturned(l.status));
      const overdue = active.filter((l) => l.due_date && new Date(l.due_date) < now);

      const pendingList = active
        .map((loan) => {
          let diffDays = null;
          if (loan.due_date) {
            const due = new Date(loan.due_date);
            due.setHours(0, 0, 0, 0);
            diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
          }
          return { ...loan, diffDays };
        })
        .filter((loan) => loan.diffDays !== null && loan.diffDays <= 3)
        .sort((a, b) => a.diffDays - b.diffDays);

      setImpendingReturns(pendingList);

      const periodCompletedLoans = loans.filter(
        (l) => isReturned(l.status) && matchesPeriod(l.return_date || l.loan_date, period)
      );

      // Toplam fiziksel kitap (kopya) sayısını hesapla
      const totalPhysicalBooks = books.reduce((sum, b) => sum + (Number(b.available_copies) || 1), 0);

      setStats({
        totalBooks: totalPhysicalBooks || books.length,
        totalStudents: students.length,
        activeLoans: active.length,
        overdueLoans: overdue.length,
        periodCompleted: periodCompletedLoans.length,
      });

      setRecentActivities(loans.slice(0, 6));

      const monthlyReturned = loans.filter((l) => isReturned(l.status) && matchesPeriod(l.return_date || l.loan_date, 'month'));
      const termReturned = loans.filter((l) => isReturned(l.status) && matchesPeriod(l.return_date || l.loan_date, 'term'));

      const calculateRankings = (returnedLoans) => {
        const studentMap = {};
        const classMap = {};

        returnedLoans.forEach((l) => {
          const sId = l.student_id;
          const pages = Number(l.books?.page_count) || 0;

          if (!studentMap[sId]) {
            studentMap[sId] = { bookCount: 0, pageCount: 0 };
          }
          studentMap[sId].bookCount += 1;
          studentMap[sId].pageCount += pages;

          const st = students.find((s) => String(s.id) === String(sId));
          const grade = st?.grade_class?.trim();
          if (grade) {
            if (!classMap[grade]) {
              classMap[grade] = { bookCount: 0, pageCount: 0 };
            }
            classMap[grade].bookCount += 1;
            classMap[grade].pageCount += pages;
          }
        });

        const studentList = Object.entries(studentMap).map(([sId, data]) => {
          const found = students.find((s) => String(s.id) === String(sId));
          return { ...found, bookCount: data.bookCount, pageCount: data.pageCount };
        });

        const topStudentsBooks = [...studentList]
          .sort((a, b) => b.bookCount - a.bookCount || b.pageCount - a.pageCount)
          .slice(0, 3);

        const topStudentsPages = [...studentList]
          .sort((a, b) => b.pageCount - a.pageCount || b.bookCount - a.bookCount)
          .slice(0, 3);

        const classList = Object.entries(classMap).map(([name, data]) => ({
          name,
          bookCount: data.bookCount,
          pageCount: data.pageCount,
        }));

        const topClassesBooks = [...classList]
          .sort((a, b) => b.bookCount - a.bookCount || b.pageCount - a.pageCount)
          .slice(0, 3);

        const topClassesPages = [...classList]
          .sort((a, b) => b.pageCount - a.pageCount || b.bookCount - a.bookCount)
          .slice(0, 3);

        return {
          topStudentsBooks,
          topStudentsPages,
          topClassesBooks,
          topClassesPages,
        };
      };

      const monthRanks = calculateRankings(monthlyReturned);
      const termRanks = calculateRankings(termReturned);

      setLeaders({
        monthTopStudentsBooks: monthRanks.topStudentsBooks,
        monthTopStudentsPages: monthRanks.topStudentsPages,
        monthTopClassesBooks: monthRanks.topClassesBooks,
        monthTopClassesPages: monthRanks.topClassesPages,
        termTopStudentsBooks: termRanks.topStudentsBooks,
        termTopStudentsPages: termRanks.topStudentsPages,
        termTopClassesBooks: termRanks.topClassesBooks,
        termTopClassesPages: termRanks.topClassesPages,
      });
    } catch (err) {
      console.error('Dashboard veri yükleme hatası:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, period]);

  const handleQuickReturn = async (loan) => {
    if (!confirm(`"${loan.books?.title}" kitabını teslim almak istiyor musunuz?`)) return;

    const today = new Date().toISOString().split('T')[0];
    await supabase.from('loans').update({ return_date: today, status: 'iade edildi (sağlam)' }).eq('id', loan.id);

    const currentCopies = loan.books?.available_copies ?? 0;
    await supabase.from('books').update({ available_copies: currentCopies + 1 }).eq('id', loan.book_id);

    loadDashboardData();
  };

  const isReturnedStatus = (status) => {
    if (!status) return false;
    const s = String(status).toLowerCase();
    return s.includes('iade') || s.includes('return');
  };

  const activeStudents =
    leaderTab === 'month'
      ? leaderMetric === 'books'
        ? leaders.monthTopStudentsBooks
        : leaders.monthTopStudentsPages
      : leaderMetric === 'books'
      ? leaders.termTopStudentsBooks
      : leaders.termTopStudentsPages;

  const activeClasses =
    leaderTab === 'month'
      ? leaderMetric === 'books'
        ? leaders.monthTopClassesBooks
        : leaders.monthTopClassesPages
      : leaderMetric === 'books'
      ? leaders.termTopClassesBooks
      : leaders.termTopClassesPages;

  // Yükleme durumu
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-mono text-slate-400">Oturum doğrulanıyor...</p>
      </div>
    );
  }

  // =========================================================================
  // OTURUM YOKSA: ÇİFT KAPILI KARŞILAMA VE GİRİŞ PORTALI
  // =========================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 antialiased selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 sm:p-8 shadow-2xl space-y-6 z-10 text-center">
          <div className="space-y-1.5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-xl shadow-blue-500/25 mx-auto">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-2xl text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-cyan-300">
                H
              </div>
            </div>
            <span className="text-[11px] font-black tracking-widest uppercase text-cyan-400 block pt-1">
              Canik / Samsun • {currentAcademic.academicYear}
            </span>
            <h1 className="text-xl font-black text-white tracking-tight">Hasköy Ortaokulu Kütüphanesi</h1>
            <p className="text-xs text-slate-400">Lütfen giriş yapmak istediğiniz portalı seçin</p>
          </div>

          {/* 🎓 ÖĞRENCİ GİRİŞİ BÖLÜMÜ */}
          {savedStudent ? (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg text-left">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Cihazda Kayıtlı Öğrenci
                </span>
                <p className="text-xs font-black text-white truncate mt-0.5">
                  {savedStudent.full_name} ({savedStudent.grade_class})
                </p>
              </div>
              <Link
                href="/ogrenci"
                className="py-2.5 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shrink-0 transition shadow-md active:scale-95"
              >
                Kitaplığıma Gir →
              </Link>
            </div>
          ) : (
            <Link
              href="/ogrenci"
              className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs text-center shadow-lg shadow-emerald-500/20 transition flex items-center justify-between gap-3 cursor-pointer active:scale-95 group"
            >
              <span className="text-2xl group-hover:scale-125 transition-transform">🎒</span>
              <div className="text-left leading-tight flex-1">
                <span className="block font-black text-slate-950 text-sm">ÖĞRENCİ PORTALI (GİRİŞ)</span>
                <span className="text-[10px] text-emerald-950 font-bold block mt-0.5">
                  Kitap ara, iade gününü ve sayfalarını gör
                </span>
              </div>
              <span className="font-black text-lg text-slate-950 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          )}

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-slate-900 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
              Yönetim ve Personel
            </span>
            <div className="border-t border-slate-800 w-full"></div>
          </div>

          {/* 🔐 PERSONEL & YÖNETİCİ GİRİŞ BUTONU */}
          <div className="space-y-3">
            <Link
              href="/login"
              className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🔐</span>
              <span>Yönetici & Öğretmen Giriş Paneli</span>
            </Link>

            <div>
              <Link
                href="/pano"
                className="text-slate-500 hover:text-slate-300 transition text-[11px] font-semibold inline-flex items-center gap-1.5"
              >
                <span>📺</span> TV Canlı Kiosk Panosunu Aç (/pano)
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // OTURUM AÇIKSA: YÖNETİCİ & ÖĞRETMEN DASHBOARD'U
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-900/5 antialiased text-slate-800">
      {/* Üst Command Bar */}
      <header className="h-16 bg-white/70 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">Kontrol Merkezi</span>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <h2 className="text-sm font-bold text-slate-900">
              {currentAcademic.academicYear} Eğitim-Öğretim Yılı
            </h2>
            <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
              {currentAcademic.term}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Personel Durum Rozeti & Çıkış */}
          {user && (
            <div className="flex items-center gap-2 bg-white/90 border border-slate-200/90 px-3 py-1.5 rounded-2xl shadow-2xs">
              <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs shadow-inner">
                {user.role === 'admin' ? '👑' : '📚'}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">{user.full_name}</span>
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                      user.role === 'admin'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}
                  >
                    {user.role === 'admin' ? 'Müdür' : 'Kütüphaneci'}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                title="Güvenli Çıkış"
                className="text-xs text-slate-400 hover:text-rose-600 font-bold px-1.5 py-0.5 rounded-lg hover:bg-slate-100 transition cursor-pointer ml-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Dönem Filtre Kapsülleri */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button
              onClick={() => setPeriod('term')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                period === 'term' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bu Dönem
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                period === 'month' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bu Ay
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                period === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tümü
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Gövdesi */}
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
        
        {/* 1. KISIM: 4'lü Bento Metrik Kartları */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative overflow-hidden bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Kitap</span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 text-base">📚</span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalBooks}</span>
              <span className="block text-[11px] font-medium text-slate-400 mt-1">Envanterdeki Eser</span>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kayıtlı Okur</span>
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 text-base">🎓</span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-indigo-950 tracking-tight">{stats.totalStudents}</span>
              <span className="block text-[11px] font-medium text-slate-400 mt-1">Sisteme Kayıtlı Öğrenci</span>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ödünçte</span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600 text-base">⏳</span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-amber-900 tracking-tight">{stats.activeLoans}</span>
              <span className="block text-[11px] font-medium text-amber-700/80 mt-1">Öğrencideki Kitap</span>
            </div>
          </div>

          <div className={`relative overflow-hidden bg-white/80 backdrop-blur-md p-5 rounded-3xl border transition-all ${
            stats.overdueLoans > 0 ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
          }`}>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gecikenler</span>
              <span className={`p-2 rounded-xl text-base ${stats.overdueLoans > 0 ? 'bg-rose-100 text-rose-600 animate-bounce' : 'bg-slate-50 text-slate-400'}`}>
                ⚠️
              </span>
            </div>
            <div className="mt-3">
              <span className={`text-3xl font-black tracking-tight ${stats.overdueLoans > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {stats.overdueLoans}
              </span>
              <span className={`block text-[11px] font-medium mt-1 ${stats.overdueLoans > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                {stats.overdueLoans > 0 ? 'Teslim Süresi Aşılmış!' : 'Tüm Teslimler Zamanında'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. KISIM: 4'LÜ HIZLI İŞLEMLER MENÜSÜ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href="/odunc-ver"
            className="bg-white/80 hover:bg-white backdrop-blur-md p-4 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center gap-3.5 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center text-xl transition-all shadow-2xs">
              🔄
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition">Ödünç Masası</h4>
              <p className="text-[11px] text-slate-400">Kitap Ver / İade Al</p>
            </div>
          </Link>

          <Link
            href="/kitaplar"
            className="bg-white/80 hover:bg-white backdrop-blur-md p-4 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center gap-3.5 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center text-xl transition-all shadow-2xs">
              ➕
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 group-hover:text-emerald-600 transition">Kitaplar</h4>
              <p className="text-[11px] text-slate-400">Envanter & Yeni Ekle</p>
            </div>
          </Link>

          <Link
            href="/ogrenciler"
            className="bg-white/80 hover:bg-white backdrop-blur-md p-4 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center gap-3.5 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-purple-50 group-hover:bg-purple-600 text-purple-600 group-hover:text-white flex items-center justify-center text-xl transition-all shadow-2xs">
              🎓
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 group-hover:text-purple-600 transition">Öğrenciler</h4>
              <p className="text-[11px] text-slate-400">Okurlar & Karneler</p>
            </div>
          </Link>

          <Link
            href="/etiketler"
            className="bg-white/80 hover:bg-white backdrop-blur-md p-4 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center gap-3.5 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-amber-50 group-hover:bg-amber-600 text-amber-600 group-hover:text-white flex items-center justify-center text-xl transition-all shadow-2xs">
              🏷️
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 group-hover:text-amber-600 transition">Barkod Bas</h4>
              <p className="text-[11px] text-slate-400">Kitap & Sırt Etiketi</p>
            </div>
          </Link>
        </div>

        {/* 3. KISIM: İadesi Yaklaşan & Geciken Kitaplar */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-rose-50 text-rose-600 text-sm">⏰</span>
              <div>
                <h3 className="font-bold text-sm text-slate-900">İadesi Yaklaşan & Geciken Kitaplar</h3>
                <p className="text-[11px] text-slate-400">Gecikenler veya teslimine 3 gün kalanlar</p>
              </div>
            </div>
            <Link href="/emanetler" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">
              Tüm Emanetler →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {impendingReturns.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                <span>🎉</span>
                <span>Şu an acil teslim edilmesi gereken veya geciken kitap bulunmuyor!</span>
              </div>
            ) : (
              impendingReturns.map((item) => {
                const isOverdue = item.diffDays < 0;
                const isToday = item.diffDays === 0;
                return (
                  <div key={item.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-2xl transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {item.books?.cover_url ? (
                        <img src={item.books.cover_url} alt="" className="w-10 h-14 object-cover rounded-xl shadow-2xs border shrink-0" />
                      ) : (
                        <div className="w-10 h-14 rounded-xl bg-slate-100 border flex items-center justify-center text-xs text-slate-400 font-bold shrink-0">
                          📖
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{item.books?.title || 'Kitap'}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          <Link href={`/ogrenciler/${item.students?.id}`} className="hover:text-blue-600 hover:underline font-semibold text-slate-700">
                            {item.students?.full_name}
                          </Link>
                          {' '}• <span className="font-mono text-slate-400">No: {item.students?.student_number}</span>
                          {' '}• <span className="text-indigo-600 font-medium">{item.students?.grade_class}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                        isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200/80 animate-pulse' :
                        isToday ? 'bg-amber-50 text-amber-700 border-amber-200/80' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                      }`}>
                        {isOverdue ? `${Math.abs(item.diffDays)} Gün Gecikti!` : isToday ? 'Bugün Son Gün' : `${item.diffDays} Gün Kaldı`}
                      </span>
                      <button
                        onClick={() => handleQuickReturn(item)}
                        className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                      >
                        İade Al
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 4. KISIM: Canlı Akış & LİDERLİK PANOSU */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SOL: Canlı Kütüphane Akışı */}
          <div className="lg:col-span-7 bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h3 className="font-bold text-sm text-slate-900">Canlı Kütüphane Akışı</h3>
              </div>
              <Link href="/emanetler" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">
                Tümünü Gör →
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {recentActivities.map((act) => {
                const returned = isReturnedStatus(act.status);
                return (
                  <div key={act.id} className="py-3.5 flex items-center justify-between gap-3 group hover:bg-slate-50/60 rounded-xl px-2 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      {act.books?.cover_url ? (
                        <img src={act.books.cover_url} alt="" className="w-9 h-12 object-cover rounded-md shadow-2xs border shrink-0" />
                      ) : (
                        <div className="w-9 h-12 bg-slate-100 rounded-md border flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0">
                          📖
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600 transition">
                          {act.books?.title || 'Kitap'}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          {act.students?.full_name || 'Öğrenci'} • <span className="font-medium text-slate-500">{act.students?.grade_class}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        returned ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {returned ? 'İade Edildi' : 'Ödünç Verildi'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                        {act.loan_date ? new Date(act.loan_date).toLocaleDateString('tr-TR') : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SAĞ: LİDERLİK PANOSU */}
          <div className="lg:col-span-5 bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6 flex flex-col justify-between space-y-5">
            
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setLeaderTab('month')}
                  className={`px-2.5 py-1 rounded-xl transition cursor-pointer ${
                    leaderTab === 'month' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Bu Ay
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderTab('term')}
                  className={`px-2.5 py-1 rounded-xl transition cursor-pointer ${
                    leaderTab === 'term' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Bu Dönem
                </button>
              </div>

              <div className="flex items-center gap-1 bg-amber-50/80 border border-amber-200/80 p-1 rounded-2xl text-[11px] font-bold text-amber-900">
                <button
                  type="button"
                  onClick={() => setLeaderMetric('books')}
                  className={`px-2.5 py-1 rounded-xl transition cursor-pointer ${
                    leaderMetric === 'books' ? 'bg-amber-400 text-amber-950 shadow-xs' : 'text-amber-800 hover:text-amber-950'
                  }`}
                >
                  📚 Kitap
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderMetric('pages')}
                  className={`px-2.5 py-1 rounded-xl transition cursor-pointer ${
                    leaderMetric === 'pages' ? 'bg-emerald-500 text-white shadow-xs' : 'text-amber-800 hover:text-amber-950'
                  }`}
                >
                  📄 Sayfa
                </button>
              </div>
            </div>

            {/* 1. BLOK: İLK 3 ÖĞRENCİ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {leaderTab === 'month'
                    ? leaderMetric === 'books' ? 'Ayın Kitap Kurtları (İlk 3)' : 'Ayın Sayfa Şampiyonları (İlk 3)'
                    : leaderMetric === 'books' ? 'Dönemin Kitap Kurtları (İlk 3)' : 'Dönemin Sayfa Şampiyonları (İlk 3)'}
                </span>
                <span className="text-[10px] font-bold text-indigo-600">Öğrenci Sıralaması</span>
              </div>

              {activeStudents.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-3 bg-slate-50 rounded-2xl">
                  Seçili periyotta tamamlanan okuma henüz yok.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {activeStudents.map((st, idx) => (
                    <div
                      key={st.id || idx}
                      className={`p-2.5 rounded-2xl border flex items-center justify-between transition ${
                        idx === 0
                          ? 'bg-amber-50/60 border-amber-200/90 shadow-2xs'
                          : 'bg-slate-50/70 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-amber-950 shadow-xs'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-900'
                              : 'bg-amber-700 text-amber-100'
                          }`}
                        >
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </span>

                        {st.photo_url ? (
                          <img src={st.photo_url} alt="" className="w-8 h-8 rounded-xl object-cover border shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs font-bold shrink-0">
                            {st.gender === 'kiz' ? '👧' : st.gender === 'erkek' ? '👦' : st.full_name?.charAt(0)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 truncate">
                            <Link href={`/ogrenciler/${st.id}`} className="hover:text-blue-600 hover:underline">
                              {st.full_name}
                            </Link>
                          </h5>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {st.grade_class} • No: {st.student_number}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-amber-800 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-lg block">
                          {leaderMetric === 'books'
                            ? `${st.bookCount} Kitap`
                            : `${st.pageCount.toLocaleString('tr-TR')} Sayfa`}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                          {leaderMetric === 'books'
                            ? `${st.pageCount.toLocaleString('tr-TR')} sf.`
                            : `${st.bookCount} kitap`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. BLOK: İLK 3 LİDER SINIF */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {leaderTab === 'month'
                    ? leaderMetric === 'books' ? 'Ayın Lider Sınıfları (Kitap)' : 'Ayın Lider Sınıfları (Sayfa)'
                    : leaderMetric === 'books' ? 'Dönemin Lider Sınıfları (Kitap)' : 'Dönemin Lider Sınıfları (Sayfa)'}
                </span>
                <span className="text-[10px] font-bold text-emerald-600">Şube Sıralaması</span>
              </div>

              {activeClasses.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-3 bg-slate-50 rounded-2xl">
                  Seçili periyotta sınıf okuma verisi bulunamadı.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {activeClasses.map((cls, idx) => (
                    <div
                      key={cls.name || idx}
                      className={`p-2.5 rounded-2xl border flex items-center justify-between transition ${
                        idx === 0
                          ? 'bg-emerald-50/60 border-emerald-200/90 shadow-2xs'
                          : 'bg-slate-50/70 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            idx === 0
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">{cls.name} Sınıfı</h5>
                          <span className="text-[10px] text-slate-400">
                            {idx === 0 ? '🥇 En Çok Okuyan Şube' : idx === 1 ? '🥈 İkinci Şube' : '🥉 Üçüncü Şube'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-lg block">
                          {leaderMetric === 'books'
                            ? `${cls.bookCount} Kitap`
                            : `${cls.pageCount.toLocaleString('tr-TR')} Sayfa`}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                          {leaderMetric === 'books'
                            ? `${cls.pageCount.toLocaleString('tr-TR')} sf.`
                            : `${cls.bookCount} kitap`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}