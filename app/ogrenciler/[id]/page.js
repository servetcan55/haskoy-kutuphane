'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getAcademicInfo } from '@/lib/academic';

export default function StudentDetailPage({ params }) {
  const unwrappedParams = use(params);
  const studentId = unwrappedParams.id;

  const currentAcademic = getAcademicInfo();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [loans, setLoans] = useState([]);
  const [badges, setBadges] = useState([]);
  const [schoolDirector, setSchoolDirector] = useState('');
  const [libraryTeacher, setLibraryTeacher] = useState('');

  const [stats, setStats] = useState({
    readBooks: 0,
    totalPages: 0,
    activeLoans: 0,
    damagedReturns: 0,
    lostBooks: 0,
  });

  useEffect(() => {
    const fetchStudentData = async () => {
      setLoading(true);

      const [studentRes, directorRes, teacherRes, badgesRes] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId).single(),
        supabase.from('settings').select('value').eq('id', 'school_director').maybeSingle(),
        supabase.from('settings').select('value').eq('id', 'library_teacher').maybeSingle(),
        supabase.from('student_badges').select('*').eq('student_id', studentId),
      ]);

      if (studentRes.data) setStudent(studentRes.data);
      if (directorRes.data?.value) setSchoolDirector(directorRes.data.value);
      if (teacherRes.data?.value) setLibraryTeacher(teacherRes.data.value);
      if (badgesRes.data) setBadges(badgesRes.data);

      const loansRes = await supabase
        .from('loans')
        .select('*')
        .eq('student_id', studentId);

      const rawLoans = loansRes.data || [];

      const enrichedLoans = await Promise.all(
        rawLoans.map(async (l) => {
          if (l.book_id) {
            const { data: bData } = await supabase.from('books').select('*').eq('id', l.book_id).single();
            return { ...l, books: bData || null };
          }
          return { ...l, books: null };
        })
      );

      enrichedLoans.sort((a, b) => b.id - a.id);
      setLoans(enrichedLoans);

      let completedBooks = 0;
      let totalPages = 0;
      let activeCount = 0;
      let damagedCount = 0;
      let lostCount = 0;
      let sciFiCount = 0;

      enrichedLoans.forEach((l) => {
        const s = String(l.status || '').toLowerCase().trim();
        const pages = Number(l.books?.page_count) || 0;
        const category = String(l.books?.category || '').toLowerCase();

        if (s.includes('kayıp')) {
          lostCount += 1;
        } else if (s.includes('hasar')) {
          damagedCount += 1;
          completedBooks += 1;
          totalPages += pages;
        } else if (l.return_date || s.includes('iade') || s.includes('return') || s.includes('teslim') || s.includes('tamam')) {
          completedBooks += 1;
          totalPages += pages;
          if (category.includes('bilim kurgu') || category.includes('fantastik') || category.includes('sci-fi')) {
            sciFiCount += 1;
          }
        } else {
          activeCount += 1;
        }
      });

      setStats({
        readBooks: completedBooks,
        totalPages,
        activeLoans: activeCount,
        damagedReturns: damagedCount,
        lostBooks: lostCount,
      });

      // Otomatik Rozet Kontrolü & Ekleme Mantığı
      const earnedKeys = new Set(badgesRes.data?.map(b => b.badge_key) || []);
      const newBadgesToInsert = [];

      const checkAndAddBadge = (key, title, icon, condition) => {
        if (condition && !earnedKeys.has(key)) {
          newBadgesToInsert.push({
            student_id: studentId,
            badge_key: key,
            badge_title: title,
            badge_icon: icon,
          });
        }
      };

      checkAndAddBadge('pages_1000', '1.000 Sayfa Kaşifi', '📄', totalPages >= 1000);
      checkAndAddBadge('pages_10000', '10.000 Sayfa Kulübü', '👑', totalPages >= 10000);
      checkAndAddBadge('books_5', 'Aktif Kitap Kurdu', '📚', completedBooks >= 5);
      checkAndAddBadge('scifi_lover', 'Bilim Kurgu Meraklısı', '🚀', sciFiCount >= 1);

      if (newBadgesToInsert.length > 0) {
        await supabase.from('student_badges').upsert(newBadgesToInsert, { onConflict: 'student_id,badge_key' });
        const updatedBadgesRes = await supabase.from('student_badges').select('*').eq('student_id', studentId);
        if (updatedBadgesRes.data) setBadges(updatedBadgesRes.data);
      }

      setLoading(false);
    };

    if (studentId) {
      fetchStudentData();
    }
  }, [studentId]);

  const handlePrint = () => {
    if (student) {
      const originalTitle = document.title;
      document.title = `${student.student_number}_${student.full_name}_Kutuphane_Karnesi`;
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    } else {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-slate-400">
        Öğrenci karnesi ve rozetler yükleniyor...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm font-bold text-slate-700">Öğrenci kaydı bulunamadı.</p>
        <Link href="/ogrenciler" className="text-xs text-blue-600 hover:underline">
          ← Öğrenci Listesine Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 lg:p-8 antialiased">
      {/* 
        BU CSS BLOĞU: Menü (sidebar) boşluklarını yoksayarak 
        yazdırma sayfasını A4 kağıdının sol üst köşesine (0,0) çiviler.
      */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0; /* Tarayıcının URL ve Tarih kısmını yok eder */
          }
          
          html, body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          /* Ana layout'taki tüm hizalamaları (sidebar boşluğu dahil) sıfırlar */
          body, main, div {
            position: static !important;
          }

          /* Normal web arayüzünü tamamen görünmez yapar */
          .web-ui-content {
            display: none !important;
          }

          /* Yazdırma alanı: Kağıdın sınırlarına %100 hükmeder */
          #print-section {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            min-height: 100vh !important;
            margin: 0 !important;
            padding: 10mm !important;
            background-color: white !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* =========================================
          WEB ARAYÜZÜ (Ekranda görünür, baskıda gizlenir)
          ========================================= */}
      <div className="web-ui-content space-y-6">
        
        {/* 1. ÜST NAVİGASYON */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/ogrenciler" className="hover:text-blue-600 transition">
              ← Öğrenci Listesi
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-800">No: {student.student_number || '-'}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/odunc-ver`}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <span>📖</span> Kitap Ver
            </Link>
            <button
              onClick={handlePrint}
              className="text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>🖨️</span> Karnesi Yazdır
            </button>
          </div>
        </div>

        {/* 2. ÖĞRENCİ KİMLİK KARTI */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-2xl shadow-inner shrink-0">
              {student.photo_url ? (
                <img src={student.photo_url} alt="" className="w-full h-full object-cover rounded-2xl" />
              ) : student.gender === 'kiz' ? '👧' : student.gender === 'erkek' ? '👦' : '🎓'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{student.full_name}</h1>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                  {student.grade_class || '-'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Okul No: <strong className="text-slate-700 font-mono">{student.student_number || '-'}</strong> • 
                Cinsiyet: <span className="capitalize">{student.gender || 'Belirtilmedi'}</span>
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Kayıtlı Kurum</span>
            <p className="text-xs font-bold text-slate-800">Hasköy Ortaokulu Kütüphanesi</p>
            <span className="text-[10px] text-blue-600 font-medium">
              {currentAcademic.academicYear} • {currentAcademic.term}
            </span>
          </div>
        </div>

        {/* 3. ROZETLER / OYUNLAŞTIRMA ALANI */}
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-pink-500/10 rounded-3xl border border-indigo-200/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🏆</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-950">Başarı & Okur Rozetleri</h2>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-mono">
              {badges.length} Rozet Kazanıldı
            </span>
          </div>
          {badges.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Henüz rozet kazanılmadı. Kitap okudukça rozetler otomatik açılacaktır!</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {badges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 bg-white/90 border border-indigo-200 px-3 py-1.5 rounded-2xl shadow-2xs">
                  <span className="text-base">{b.badge_icon || '🏅'}</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">{b.badge_title}</h4>
                    <span className="text-[9px] text-slate-400 font-mono">Kazanıldı</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. METRİK SAYAÇ KARTLARI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Okunan Kitap</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{stats.readBooks}</p>
            <span className="text-[10px] text-slate-400">Sağlam tamamlanan</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/40 to-white shadow-2xs">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
              <span>📄</span> Okunan Sayfa
            </span>
            <p className="text-2xl font-black text-amber-600 mt-1 font-mono">
              {stats.totalPages.toLocaleString('tr-TR')}
            </p>
            <span className="text-[10px] text-amber-600/80 font-medium">Toplam sayfa hacmi</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Şu An Emanette</span>
            <p className="text-2xl font-black text-blue-600 mt-1">{stats.activeLoans}</p>
            <span className="text-[10px] text-slate-400">Öğrencinin elinde</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hasarlı İade</span>
            <p className="text-2xl font-black text-slate-700 mt-1">{stats.damagedReturns}</p>
            <span className="text-[10px] text-slate-400">Yıpranmış teslim</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kayıp Kitap</span>
            <p className="text-2xl font-black text-rose-600 mt-1">{stats.lostBooks}</p>
            <span className="text-[10px] text-slate-400">Kayıp kaydı</span>
          </div>
        </div>

        {/* 5. OKUMA GEÇMİŞİ LİSTESİ */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h2 className="text-sm font-bold text-slate-900">Kütüphane Dolaşım & Okuma Geçmişi</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400 font-mono">
              Toplam {loans.length} Hareket
            </span>
          </div>
          {loans.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">Henüz kitap hareket kaydı bulunmamaktadır.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {loans.map((l) => {
                const b = l.books;
                const isRet = l.return_date || l.status?.toLowerCase().includes('iade') || l.status?.toLowerCase().includes('return') || l.status?.toLowerCase().includes('teslim');
                return (
                  <div key={l.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {b?.cover_url ? (
                        <img src={b.cover_url} alt="" className="w-9 h-12 object-cover rounded-lg border shrink-0" />
                      ) : (
                        <div className="w-9 h-12 rounded-lg bg-slate-100 border flex items-center justify-center text-base shrink-0">
                          📖
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900 truncate">{b?.title || 'Bilinmeyen Kitap'}</h3>
                        <p className="text-[11px] text-slate-400 truncate">
                          {b?.author || 'Yazar Belirtilmedi'} {b?.page_count ? `• ${b.page_count} Sayfa` : ''}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Alış: {l.loan_date || '-'} {l.return_date ? `• Teslim: ${l.return_date}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg inline-block ${
                          isRet
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : l.status?.toLowerCase().includes('kayıp')
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isRet ? '✓ Sağlam Teslim Edildi' : l.status || 'Emanette'}
                      </span>
                      {b?.page_count && (
                        <span className="text-[10px] font-mono text-slate-400 block mt-1 font-semibold">
                          +{b.page_count} sf.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =========================================
          ÖZEL YAZDIRMA ŞABLONU (Yalnızca Baskıda Çalışır)
          ========================================= */}
      <div id="print-section" className="hidden font-serif bg-white text-slate-900">
        
        {/* RESMİ MEB BAŞLIĞI */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <h2 className="text-sm font-bold tracking-wider uppercase">T.C. MİLLÎ EĞİTİM BAKANLIĞI</h2>
          <h3 className="text-lg font-black mt-0.5">HASKÖY ORTAOKULU MÜDÜRLÜĞÜ</h3>
          <h4 className="text-xs font-bold tracking-wide mt-1.5 uppercase text-slate-900 bg-slate-100 py-1.5 inline-block px-5 rounded border border-slate-300">
            KÜTÜPHANE OKUMA VE BAŞARI KARNESİ
          </h4>
          <span className="text-xs font-mono block mt-1.5 text-slate-700 font-bold">
            {currentAcademic.academicYear} Eğitim-Öğretim Yılı • {currentAcademic.term}
          </span>
        </div>

        {/* KİMLİK VE ÖZET */}
        <div className="grid grid-cols-2 gap-4 text-xs border-b-2 border-slate-300 pb-4 mb-6">
          <div className="space-y-1">
            <p><strong>Öğrenci Adı Soyadı:</strong> <span className="font-extrabold text-sm">{student.full_name}</span></p>
            <p><strong>Okul Numarası:</strong> <span className="font-mono">{student.student_number || '-'}</span></p>
            <p><strong>Sınıfı / Şubesi:</strong> {student.grade_class || '-'}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="font-bold text-slate-900">
              Toplam Okunan Eser: <span className="text-sm font-mono">{stats.readBooks} Kitap</span>
            </p>
            <p className="font-bold text-slate-900">
              Toplam Okunan Sayfa: <span className="text-sm font-mono">{stats.totalPages.toLocaleString('tr-TR')} Sayfa</span>
            </p>
          </div>
        </div>

        {/* YAZDIRILABİLİR ROZET ÖZETİ (Her Zaman Görünür) */}
        <div className="border border-slate-300 p-2.5 rounded bg-slate-50 text-xs space-y-1 mb-6">
          <p className="font-bold uppercase tracking-wider text-[11px]">Kazanılan Rozetler ve Başarılar:</p>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.map(b => (
                <span key={b.id} className="font-semibold px-2 py-0.5 bg-white border border-slate-300 rounded text-[10px]">
                  {b.badge_icon} {b.badge_title}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-500 italic mt-1">Henüz başarı rozeti kazanılmamıştır.</p>
          )}
        </div>

        {/* DÖNEM OKUMALARI */}
        <div className="space-y-2 mb-16">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">Dönem Boyunca Okunan Kitaplar</h5>
          <table className="w-full text-xs text-left border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-2 w-8 text-center">#</th>
                <th className="border border-slate-400 p-2">Kitap Adı</th>
                <th className="border border-slate-400 p-2">Yazarı</th>
                <th className="border border-slate-400 p-2 text-center w-20">Sayfa</th>
                <th className="border border-slate-400 p-2 text-center w-24">Teslim Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {loans
                .filter(l => l.return_date || l.status?.toLowerCase().includes('iade') || l.status?.toLowerCase().includes('return') || l.status?.toLowerCase().includes('teslim'))
                .map((l, idx) => (
                  <tr key={l.id}>
                    <td className="border border-slate-400 p-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-400 p-1.5 font-bold">{l.books?.title || '-'}</td>
                    <td className="border border-slate-400 p-1.5">{l.books?.author || '-'}</td>
                    <td className="border border-slate-400 p-1.5 text-center font-mono">{l.books?.page_count || '-'}</td>
                    <td className="border border-slate-400 p-1.5 text-center">{l.return_date || '-'}</td>
                  </tr>
                ))}
              {loans.filter(l => l.return_date || l.status?.toLowerCase().includes('iade') || l.status?.toLowerCase().includes('return') || l.status?.toLowerCase().includes('teslim')).length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-slate-400 p-6 text-center text-slate-500 italic">
                    Dönem içinde tamamlanan kitap bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* İMZA BLOĞU */}
        <div className="grid grid-cols-2 text-center text-xs">
          <div>
            <p className="font-bold text-slate-900">Kütüphane Rehber Öğretmeni</p>
            <p className="mt-1 text-slate-800 font-semibold">{libraryTeacher || '....................................'}</p>
            <p className="mt-8 text-slate-400">İmza</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Okul Müdürü</p>
            <p className="mt-1 text-slate-800 font-semibold">{schoolDirector || '....................................'}</p>
            <p className="mt-8 text-slate-400">İmza / Mühür</p>
          </div>
        </div>

      </div>
    </div>
  );
}