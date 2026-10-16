'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { getAcademicInfo, matchesPeriod } from '@/lib/academic';

export default function StatisticsPage() {
  const [period, setPeriod] = useState('month'); // Varsayılan olarak 'Bu Ay' seçili başlar
  const currentAcademic = getAcademicInfo();

  const [loading, setLoading] = useState(true);
  const [studentTab, setStudentTab] = useState('books'); 
  const [classTab, setClassTab] = useState('books'); 

  const [topStudentsByBooks, setTopStudentsByBooks] = useState([]);
  const [topStudentsByPages, setTopStudentsByPages] = useState([]);
  const [topBooks, setTopBooks] = useState([]);
  const [classStatsByBooks, setClassStatsByBooks] = useState([]);
  const [classStatsByPages, setClassStatsByPages] = useState([]);

  const [allStudentsData, setAllStudentsData] = useState([]);
  const [allLoansData, setAllLoansData] = useState([]);
  const [allBooksData, setAllBooksData] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedPrintGrade, setSelectedPrintGrade] = useState('');

  const [termGoal, setTermGoal] = useState(500);
  const [termPageGoal, setTermPageGoal] = useState(100000);

  const [overview, setOverview] = useState({
    totalBooks: 0,
    totalStudents: 0,
    activeLoans: 0,
    periodRead: 0,
    periodPages: 0,
    activeReadersCount: 0,
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
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
            .select('id, title, author, cover_url, page_count')
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

        const [studentsRes, loansRes, goalRes, pageGoalRes] = await Promise.all([
          supabase.from('students').select('id, student_number, full_name, grade_class'),
          supabase.from('loans').select('id, book_id, student_id, status, loan_date, return_date'),
          supabase.from('settings').select('value').eq('id', 'term_goal').maybeSingle(),
          supabase.from('settings').select('value').eq('id', 'term_page_goal').maybeSingle(),
        ]);

        if (goalRes.data?.value) {
          const parsed = parseInt(goalRes.data.value, 10);
          if (!isNaN(parsed) && parsed > 0) setTermGoal(parsed);
        }
        if (pageGoalRes.data?.value) {
          const parsedPages = parseInt(pageGoalRes.data.value, 10);
          if (!isNaN(parsedPages) && parsedPages > 0) setTermPageGoal(parsedPages);
        }

        const books = allBooks;
        const students = studentsRes.data || [];
        const loans = loansRes.data || [];

        setAllBooksData(books);
        setAllStudentsData(students);
        setAllLoansData(loans);

        // Şube Listesini Dinamik Topla ve İlkini Varsayılan Yap
        const uniqueGrades = Array.from(
          new Set(students.map((s) => s.grade_class?.trim()).filter(Boolean))
        ).sort();
        setAvailableClasses(uniqueGrades);
        
        if (uniqueGrades.length > 0 && (!selectedPrintGrade || !uniqueGrades.includes(selectedPrintGrade))) {
          setSelectedPrintGrade(uniqueGrades[0]);
        }

        const isReturned = (status) => {
          if (!status) return false;
          const s = String(status).toLowerCase().trim();
          return (s.includes('iade') || s.includes('return')) && !s.includes('kayıp');
        };

        const periodCompleted = loans.filter(
          (l) => isReturned(l.status) && matchesPeriod(l.return_date || l.loan_date, period)
        );

        const activeLoans = loans.filter((l) => !isReturned(l.status));

        let totalPages = 0;
        const studentMetrics = {};
        const classMetrics = {};
        const uniqueReaders = new Set();

        periodCompleted.forEach((l) => {
          const bookObj = books.find((b) => String(b.id) === String(l.book_id));
          const pages = Number(bookObj?.page_count) || 0;
          totalPages += pages;
          uniqueReaders.add(String(l.student_id));

          if (!studentMetrics[l.student_id]) {
            studentMetrics[l.student_id] = { bookCount: 0, pageCount: 0 };
          }
          studentMetrics[l.student_id].bookCount += 1;
          studentMetrics[l.student_id].pageCount += pages;

          const studentObj = students.find((s) => String(s.id) === String(l.student_id));
          const className = studentObj?.grade_class?.trim() || 'Belirtilmedi';
          if (!classMetrics[className]) {
            classMetrics[className] = { bookCount: 0, pageCount: 0 };
          }
          classMetrics[className].bookCount += 1;
          classMetrics[className].pageCount += pages;
        });

        setOverview({
          totalBooks: books.length,
          totalStudents: students.length,
          activeLoans: activeLoans.length,
          periodRead: periodCompleted.length,
          periodPages: totalPages,
          activeReadersCount: uniqueReaders.size,
        });

        const studentsList = Object.entries(studentMetrics).map(([studentId, data]) => {
          const studentObj = students.find((s) => String(s.id) === String(studentId));
          return {
            id: studentId,
            name: studentObj ? studentObj.full_name : 'Bilinmeyen Öğrenci',
            student_number: studentObj?.student_number || '-',
            grade_class: studentObj?.grade_class || '-',
            bookCount: data.bookCount,
            pageCount: data.pageCount,
          };
        });

        setTopStudentsByBooks(
          [...studentsList].sort((a, b) => b.bookCount - a.bookCount || b.pageCount - a.pageCount).slice(0, 5)
        );
        setTopStudentsByPages(
          [...studentsList].sort((a, b) => b.pageCount - a.pageCount || b.bookCount - a.bookCount).slice(0, 5)
        );

        const periodAllLoans = loans.filter((l) => matchesPeriod(l.loan_date, period));
        const bookReadMap = {};
        periodAllLoans.forEach((l) => {
          bookReadMap[l.book_id] = (bookReadMap[l.book_id] || 0) + 1;
        });

        const bookRanking = Object.entries(bookReadMap)
          .map(([bookId, count]) => {
            const bookObj = books.find((b) => String(b.id) === String(bookId));
            return {
              id: bookId,
              title: bookObj ? bookObj.title : 'Bilinmeyen Kitap',
              author: bookObj?.author || 'Yazar Yok',
              cover_url: bookObj?.cover_url || null,
              page_count: bookObj?.page_count || 0,
              count,
            };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setTopBooks(bookRanking);

        const classesList = Object.entries(classMetrics).map(([grade, data]) => ({
          grade,
          bookCount: data.bookCount,
          pageCount: data.pageCount,
        }));

        setClassStatsByBooks(
          [...classesList].sort((a, b) => b.bookCount - a.bookCount || b.pageCount - a.pageCount)
        );
        setClassStatsByPages(
          [...classesList].sort((a, b) => b.pageCount - a.pageCount || b.bookCount - a.bookCount)
        );
      } catch (err) {
        console.error('İstatistik verileri yüklenirken hata:', err);
      }
      setLoading(false);
    };

    fetchAnalytics();
  }, [period]);

  const bookGoalPercent = Math.min(100, Math.round((overview.periodRead / (termGoal || 1)) * 100));
  const pageGoalPercent = Math.min(100, Math.round((overview.periodPages / (termPageGoal || 1)) * 100));
  const activeReaderPercent = overview.totalStudents > 0
    ? Math.round((overview.activeReadersCount / overview.totalStudents) * 100)
    : 0;

  const exportEOkulReport = () => {
    const isReturned = (status) => {
      if (!status) return false;
      const s = String(status).toLowerCase().trim();
      return (s.includes('iade') || s.includes('return')) && !s.includes('kayıp');
    };

    const periodCompleted = allLoansData.filter(
      (l) => isReturned(l.status) && matchesPeriod(l.return_date || l.loan_date, period)
    );

    const reportRows = allStudentsData.map((st) => {
      const studentLoans = periodCompleted.filter((l) => String(l.student_id) === String(st.id));
      let studentTotalPages = 0;

      const bookTitles = studentLoans
        .map((l) => {
          const b = allBooksData.find((bk) => String(bk.id) === String(l.book_id));
          studentTotalPages += Number(b?.page_count) || 0;
          return b?.title || 'Kitap';
        })
        .join(', ');

      return {
        'Okul No': st.student_number || '',
        'Adı Soyadı': st.full_name || '',
        'Sınıf / Şube': st.grade_class || '',
        'Okuduğu Kitap Sayısı': studentLoans.length,
        'Toplam Okunan Sayfa': studentTotalPages,
        'Okunan Eserler': bookTitles || '-',
        'Dönem': `${currentAcademic.academicYear} ${currentAcademic.term}`,
      };
    });

    reportRows.sort((a, b) => Number(a['Okul No']) - Number(b['Okul No']));

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'e-Okul Raporu');
    XLSX.writeFile(wb, `Haskoy_Kutuphane_eOkul_Raporu_${currentAcademic.academicYear}_${currentAcademic.term}.xlsx`);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto antialiased">
      {/* Üst Command Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Hasköy Ortaokulu</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-mono">
              {currentAcademic.academicYear} {currentAcademic.term}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Kütüphane İstatistik & Raporları</h1>
          <p className="text-xs text-slate-400">Kitap & sayfa liderlik tabloları, hedef gerçekleşme oranları ve resmi e-Okul raporları</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Şube Karnesi Yazdır / PDF Alanı */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <select
              value={selectedPrintGrade}
              onChange={(e) => setSelectedPrintGrade(e.target.value)}
              className="text-xs font-bold bg-white text-slate-700 rounded-xl px-2.5 py-1.5 outline-none border border-slate-200 shadow-2xs mr-1"
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            <Link
              href={`/sinif-karne?grade=${encodeURIComponent(selectedPrintGrade || availableClasses[0] || '5A')}`}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <span>🎓</span>
              <span>Şube Karnesi (PDF)</span>
            </Link>
          </div>

          {/* e-Okul Excel İndir */}
          <button
            onClick={exportEOkulReport}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-2xl transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>📥</span>
            <span>e-Okul Raporu (Excel)</span>
          </button>

          <Link
            href="/"
            className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-2xl transition shadow-2xs flex items-center gap-1.5"
          >
            ← <span>Ana Sayfa</span>
          </Link>
        </div>
      </div>

      {/* Dönem Filtresi */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span>Aktif Okur Oranı:</span>
          <span className="font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
            %{activeReaderPercent} ({overview.activeReadersCount} / {overview.totalStudents} Öğrenci)
          </span>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setPeriod('month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              period === 'month' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Bu Ay
          </button>
          <button
            onClick={() => setPeriod('term')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              period === 'term' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Bu Dönem
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              period === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tüm Zamanlar
          </button>
        </div>
      </div>

      {/* 5'li Metrik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Kitap</span>
          <p className="text-3xl font-black text-slate-900 mt-2">{overview.totalBooks}</p>
          <span className="text-[11px] text-slate-400">Envanter mevcudu</span>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kayıtlı Öğrenci</span>
          <p className="text-3xl font-black text-indigo-950 mt-2">{overview.totalStudents}</p>
          <span className="text-[11px] text-slate-400">Kayıtlı okur sayısı</span>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Şu An Emanette</span>
          <p className="text-3xl font-black text-amber-900 mt-2">{overview.activeLoans}</p>
          <span className="text-[11px] text-amber-700">Öğrencideki kitap</span>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {period === 'month' ? 'Aylık Okunan' : period === 'term' ? 'Dönemlik Okunan' : 'Toplam Okunan'}
          </span>
          <p className="text-3xl font-black text-emerald-700 mt-2">{overview.periodRead}</p>
          <span className="text-[11px] text-emerald-600">İade edilen kitap</span>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {period === 'month' ? 'Aylık Sayfa' : period === 'term' ? 'Dönemlik Sayfa' : 'Toplam Sayfa'}
          </span>
          <p className="text-3xl font-black text-amber-600 mt-2 font-mono">
            {overview.periodPages.toLocaleString('tr-TR')}
          </p>
          <span className="text-[11px] text-amber-600">Tamamlanan sayfa</span>
        </div>
      </div>

      {/* Dönemlik Hedef İlerleme Çubukları */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <div className="space-y-2 lg:pr-6">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>🎯</span> Dönemlik Kitap Hedefi
              </span>
              <span className="font-mono font-bold text-blue-600">
                {period === 'term' ? overview.periodRead : '-'} / {termGoal} Kitap
              </span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-700"
                style={{ width: `${bookGoalPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-2 pt-4 lg:pt-0 lg:pl-6">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>🚀</span> Dönemlik Sayfa Rekoru Hedefi
              </span>
              <span className="font-mono font-bold text-amber-600">
                {overview.periodPages.toLocaleString('tr-TR')} / {termPageGoal.toLocaleString('tr-TR')} sf. (%{pageGoalPercent})
              </span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${pageGoalPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 3'lü Bento Tablolar */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs font-mono">İstatistikler hesaplanıyor...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 1. Sütun: Kitap Kurtları */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <span>🏆</span>
                  <span>{studentTab === 'books' ? 'Kitap Kurtları' : 'Sayfa Şampiyonları'}</span>
                </h3>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setStudentTab('books')}
                    className={`px-2 py-0.5 rounded-lg transition ${
                      studentTab === 'books' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Kitap
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentTab('pages')}
                    className={`px-2 py-0.5 rounded-lg transition ${
                      studentTab === 'pages' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Sayfa
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 mt-2">
                {(studentTab === 'books' ? topStudentsByBooks : topStudentsByPages).length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">Bu periyotta tamamlanan okuma henüz yok.</p>
                ) : (
                  (studentTab === 'books' ? topStudentsByBooks : topStudentsByPages).map((st, idx) => (
                    <div key={st.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-amber-950'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-800'
                              : idx === 2
                              ? 'bg-amber-600/30 text-amber-900'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/ogrenciler/${st.id}`}
                            className="font-bold text-xs text-slate-900 hover:text-blue-600 hover:underline truncate block"
                          >
                            {st.name}
                          </Link>
                          <p className="text-[10px] text-slate-400">
                            No: {st.student_number} • <strong className="text-indigo-600">{st.grade_class}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-lg block ${
                            studentTab === 'books'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                          }`}
                        >
                          {studentTab === 'books' ? `${st.bookCount} Kitap` : `${st.pageCount.toLocaleString('tr-TR')} sf.`}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          {studentTab === 'books' ? `${st.pageCount.toLocaleString('tr-TR')} sf.` : `${st.bookCount} Kitap`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 2. Sütun: Sınıf Okuma Oranları */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <span>📊</span> Sınıf Okuma Oranları
              </h3>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setClassTab('books')}
                  className={`px-2 py-0.5 rounded-lg transition ${
                    classTab === 'books' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Kitap
                </button>
                <button
                  type="button"
                  onClick={() => setClassTab('pages')}
                  className={`px-2 py-0.5 rounded-lg transition ${
                    classTab === 'pages' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Sayfa
                </button>
              </div>
            </div>

            <div className="space-y-4 mt-3">
              {(classTab === 'books' ? classStatsByBooks : classStatsByPages).length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">Bu periyotta sınıf okuma verisi bulunamadı.</p>
              ) : (
                (classTab === 'books' ? classStatsByBooks : classStatsByPages).map((cs) => {
                  const maxVal =
                    classTab === 'books'
                      ? classStatsByBooks[0]?.bookCount || 1
                      : classStatsByPages[0]?.pageCount || 1;
                  const currentVal = classTab === 'books' ? cs.bookCount : cs.pageCount;
                  const percentage = Math.round((currentVal / maxVal) * 100);

                  return (
                    <div key={cs.grade} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">{cs.grade} Sınıfı</span>
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md border ${
                            classTab === 'books'
                              ? 'text-indigo-600 bg-indigo-50 border-indigo-100'
                              : 'text-amber-600 bg-amber-50 border-amber-100'
                          }`}
                        >
                          {classTab === 'books'
                            ? `${cs.bookCount} Kitap`
                            : `${cs.pageCount.toLocaleString('tr-TR')} sf.`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            classTab === 'books'
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. Sütun: En Çok Okunanlar */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <span>📚</span> En Çok Okunanlar
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Top 5
              </span>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {topBooks.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">Bu periyotta ödünç alınan kitap yok.</p>
              ) : (
                topBooks.map((bk, idx) => (
                  <div key={bk.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {bk.cover_url ? (
                        <img src={bk.cover_url} alt="" className="w-8 h-11 object-cover rounded-md border shrink-0" />
                      ) : (
                        <div className="w-8 h-11 bg-slate-100 rounded-md flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0 border">
                          {idx + 1}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-xs truncate">{bk.title}</h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {bk.author} {bk.page_count ? `• ${bk.page_count} sf.` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded-lg shrink-0">
                      {bk.count} Kez
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}