'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getAcademicInfo, matchesPeriod } from '@/lib/academic';

function ClassReportContent() {
  const searchParams = useSearchParams();
  const urlGrade = searchParams.get('grade');
  const currentAcademic = getAcademicInfo();

  const [loading, setLoading] = useState(true);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState(urlGrade || '');
  const [students, setStudents] = useState([]);
  const [schoolDirector, setSchoolDirector] = useState('');
  const [libraryTeacher, setLibraryTeacher] = useState('');

  const [classStats, setClassStats] = useState({
    totalStudents: 0,
    totalBooks: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const fetchClassData = async () => {
      setLoading(true);

      const [studentsRes, loansRes, booksRes, badgesRes, directorRes, teacherRes] = await Promise.all([
        supabase.from('students').select('*').order('student_number', { ascending: true }),
        supabase.from('loans').select('id, book_id, student_id, status, loan_date, return_date'),
        supabase.from('books').select('id, title, author, page_count, category'),
        supabase.from('student_badges').select('*'), 
        supabase.from('settings').select('value').eq('id', 'school_director').maybeSingle(),
        supabase.from('settings').select('value').eq('id', 'library_teacher').maybeSingle(),
      ]);

      if (directorRes.data?.value) setSchoolDirector(directorRes.data.value);
      if (teacherRes.data?.value) setLibraryTeacher(teacherRes.data.value);

      const allStudents = studentsRes.data || [];
      const allLoans = loansRes.data || [];
      const allBooks = booksRes.data || [];
      const allBadges = badgesRes.data || [];

      const classesSet = new Set(
        allStudents.map((s) => s.grade_class?.trim()).filter(Boolean)
      );
      const sortedClasses = Array.from(classesSet).sort();
      setAvailableClasses(sortedClasses);

      let activeGrade = urlGrade;
      if (!activeGrade && sortedClasses.length > 0) {
        activeGrade = sortedClasses[0];
        setSelectedGrade(activeGrade);
      } else if (activeGrade) {
        setSelectedGrade(activeGrade);
      }

      const isReturned = (status) => {
        if (!status) return false;
        const s = String(status).toLowerCase().trim();
        return (s.includes('iade') || s.includes('return') || s.includes('teslim') || s.includes('tamam')) && !s.includes('kayıp');
      };

      const targetStudents = allStudents.filter(
        (s) => s.grade_class?.trim().toUpperCase() === (activeGrade || '').trim().toUpperCase()
      );

      const periodCompletedLoans = allLoans.filter(
        (l) => isReturned(l.status) && matchesPeriod(l.return_date || l.loan_date, 'term')
      );

      let classTotalBooks = 0;
      let classTotalPages = 0;

      const processedStudents = targetStudents.map((st) => {
        const studentLoans = periodCompletedLoans.filter(
          (l) => String(l.student_id) === String(st.id)
        );

        let studentPages = 0;
        let sciFiCount = 0;

        const readBooksList = studentLoans.map((l) => {
          const b = allBooks.find((bk) => String(bk.id) === String(l.book_id));
          const p = Number(b?.page_count) || 0;
          const cat = String(b?.category || '').toLowerCase();
          
          studentPages += p;
          if (cat.includes('bilim kurgu') || cat.includes('fantastik') || cat.includes('sci-fi')) {
            sciFiCount += 1;
          }

          return {
            title: b?.title || 'Bilinmeyen Eser',
            author: b?.author || 'Yazar Belirtilmedi',
            page_count: p,
            return_date: l.return_date || l.loan_date,
          };
        });

        classTotalBooks += studentLoans.length;
        classTotalPages += studentPages;

        const studentBadges = allBadges.filter(b => String(b.student_id) === String(st.id));

        return {
          ...st,
          readCount: studentLoans.length,
          totalPages: studentPages,
          sciFiCount: sciFiCount,
          books: readBooksList,
          badges: studentBadges, 
        };
      });

      processedStudents.sort((a, b) => Number(a.student_number || 0) - Number(b.student_number || 0));

      setStudents(processedStudents);
      setClassStats({
        totalStudents: targetStudents.length,
        totalBooks: classTotalBooks,
        totalPages: classTotalPages,
      });

      setLoading(false);
    };

    fetchClassData();
  }, [urlGrade]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* KESİN ÇÖZÜMLÜ YAZDIRMA CSS BLOĞU */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0; 
          }
          
          html, body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
          }

          body, main, div {
            position: static !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          .print-full-width-container {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
            z-index: 999999 !important;
          }

          .print\\:break-before-page {
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      `}</style>

      <div className="bg-slate-100 min-h-screen text-slate-900 font-sans print-full-width-container">
        
        {/* 1. ÜST ARAÇ ÇUBUĞU (Yazdırmada / PDF'te Gizlenir) */}
        <div className="print:hidden p-4 bg-white border-b border-slate-200 shadow-xs sticky top-0 z-50">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/istatistikler" className="text-xs text-slate-500 hover:text-slate-800">
                ← İstatistikler
              </Link>
              <span className="text-slate-300">|</span>
              <label className="text-xs font-bold text-slate-700">Şube Seçin:</label>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  window.location.href = `/sinif-karne?grade=${encodeURIComponent(e.target.value)}`;
                }}
                className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-blue-500"
              >
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls} Sınıfı
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                Toplam <strong>{students.length}</strong> Öğrenci ({students.length > 0 ? students.length + 1 : 0} Sayfa PDF)
              </span>
              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>🖨️</span>
                <span>Sınıfı PDF / Yazdır</span>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-xs font-mono text-slate-400">
            {selectedGrade ? `${selectedGrade} sınıfının` : 'Sınıfların'} karneleri ve okuma geçmişleri hazırlanıyor...
          </div>
        ) : (
          <div className="max-w-4xl mx-auto py-8 px-4 print:p-0 print:max-w-none space-y-8 print:space-y-0">
            
            {/* 1. BÖLÜM: SINIFIN GENEL KARNESİ & OKUMA ÇİZELGESİ */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:rounded-none print:p-10 print:min-h-[297mm] flex flex-col justify-between box-border">
              <div>
                {/* Başlık Anteti ve Okul Logosu */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                  <img src="/okul-logo.png" alt="Hasköy Ortaokulu Logo" className="w-14 h-14 object-contain" />
                  <div className="text-center flex-1 mx-4">
                    <h3 className="text-sm font-bold tracking-widest uppercase">T.C. MİLLÎ EĞİTİM BAKANLIĞI</h3>
                    <h2 className="text-lg font-black tracking-tight text-slate-950 mt-0.5">HASKÖY ORTAOKULU MÜDÜRLÜĞÜ</h2>
                    <h1 className="text-base font-bold text-blue-900 tracking-wide mt-1 uppercase">
                      {selectedGrade} ŞUBESİ KÜTÜPHANE OKUMA VE GELİŞİM KARNESİ
                    </h1>
                    <p className="text-xs font-mono text-slate-600 mt-0.5">
                      {currentAcademic.academicYear} Eğitim-Öğretim Yılı • {currentAcademic.term}
                    </p>
                  </div>
                  <img src="/okul-logo.png" alt="Hasköy Ortaokulu Logo" className="w-14 h-14 object-contain" />
                </div>

                <div className="grid grid-cols-3 gap-3 my-5">
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mevcut</span>
                    <p className="text-xl font-black text-slate-900">{classStats.totalStudents} Öğrenci</p>
                  </div>
                  <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 text-center">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Toplam Kitap</span>
                    <p className="text-xl font-black text-blue-700">{classStats.totalBooks} Eser</p>
                  </div>
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-center">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Toplam Sayfa</span>
                    <p className="text-xl font-black text-amber-700 font-mono">
                      {classStats.totalPages.toLocaleString('tr-TR')} sf.
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Şube Öğrencileri Okuma Başarı Sıralaması
                  </h4>
                  <table className="w-full text-xs text-left border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800">
                        <th className="border border-slate-300 p-1.5 w-12 text-center">No</th>
                        <th className="border border-slate-300 p-1.5">Öğrenci Adı Soyadı</th>
                        <th className="border border-slate-300 p-1.5 text-center w-24">Okunan Kitap</th>
                        <th className="border border-slate-300 p-1.5 text-center w-28">Okunan Sayfa</th>
                        <th className="border border-slate-300 p-1.5 text-center w-24">Başarı Durumu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="border border-slate-300 p-1.5 text-center font-mono font-bold">
                            {st.student_number || '-'}
                          </td>
                          <td className="border border-slate-300 p-1.5 font-bold text-slate-900">
                            {st.full_name}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-center font-mono font-bold">
                            {st.readCount} Kitap
                          </td>
                          <td className="border border-slate-300 p-1.5 text-center font-mono font-bold text-slate-700">
                            {st.totalPages.toLocaleString('tr-TR')} sf.
                          </td>
                          <td className="border border-slate-300 p-1.5 text-center">
                            {st.readCount >= 5 ? (
                              <span className="text-[10px] font-bold text-emerald-700">⭐ Kitap Kurdu</span>
                            ) : st.readCount > 0 ? (
                              <span className="text-[10px] font-medium text-slate-600">Aktif Okur</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Henüz Okumadı</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 pt-8 text-center text-xs border-t border-slate-200 mt-6 print:mt-10">
                <div>
                  <p className="font-bold text-slate-900">Kütüphane Rehber Öğretmeni</p>
                  <p className="mt-1 text-slate-800 font-semibold">{libraryTeacher || '....................................'}</p>
                  <p className="mt-7 text-slate-400">İmza</p>
                </div>
                <div>
                  <p className="font-bold text-slate-900">Okul Müdürü</p>
                  <p className="mt-1 text-slate-800 font-semibold">{schoolDirector || '....................................'}</p>
                  <p className="mt-7 text-slate-400">İmza / Mühür</p>
                </div>
              </div>
            </div>

            {/* 2. BÖLÜM: BİREYSEL KARNELER */}
            {students.map((student, sIdx) => (
              <div
                key={student.id}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:rounded-none print:p-10 print:h-[297mm] flex flex-col justify-between box-border print:break-before-page"
              >
                <div>
                  {/* Öğrenci Karne Anteti ve Okul Logosu */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                    <img src="/okul-logo.png" alt="Hasköy Ortaokulu Logo" className="w-12 h-12 object-contain" />
                    <div className="text-center flex-1 mx-3">
                      <h3 className="text-xs font-bold tracking-widest uppercase">T.C. MİLLÎ EĞİTİM BAKANLIĞI</h3>
                      <h2 className="text-base font-black tracking-tight text-slate-950 mt-0.5">
                        HASKÖY ORTAOKULU MÜDÜRLÜĞÜ
                      </h2>
                      <h1 className="text-sm font-bold text-blue-900 tracking-wide mt-0.5 uppercase">
                        ÖĞRENCİ KÜTÜPHANE OKUMA VE GELİŞİM KARNESİ
                      </h1>
                      <span className="text-[11px] font-mono text-slate-500 block">
                        {currentAcademic.academicYear} • {currentAcademic.term}
                      </span>
                    </div>
                    <img src="/okul-logo.png" alt="Hasköy Ortaokulu Logo" className="w-12 h-12 object-contain" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-300 py-3 my-2">
                    <div>
                      <p className="text-sm">
                        <strong>Öğrenci:</strong> <span className="font-bold text-slate-900">{student.full_name}</span>
                      </p>
                      <p className="mt-1">
                        <strong>Okul No:</strong> <span className="font-mono font-bold">{student.student_number || '-'}</span>
                      </p>
                      <p className="mt-0.5">
                        <strong>Sınıfı:</strong> <span className="font-bold text-indigo-700">{student.grade_class}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-800">
                        Toplam Eser: <span className="text-sm font-mono text-blue-700">{student.readCount} Kitap</span>
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        Toplam Sayfa: <span className="text-sm font-mono text-amber-700">{student.totalPages.toLocaleString('tr-TR')} Sayfa</span>
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Karne Sırası: {sIdx + 1} / {students.length}
                      </span>
                    </div>
                  </div>

                  <div className="border border-slate-300 p-2.5 rounded bg-slate-50 text-xs space-y-1 mb-4 mt-2">
                    <p className="font-bold uppercase tracking-wider text-[11px]">Kazanılan Rozetler ve Başarılar:</p>
                    {student.badges && student.badges.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {student.badges.map(b => (
                          <span key={b.id} className="font-semibold px-2 py-0.5 bg-white border border-slate-300 rounded text-[10px]">
                            {b.badge_icon} {b.badge_title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic mt-1">Henüz başarı rozeti kazanılmamıştır.</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Dönem İçinde Başarıyla Tamamlanan Kitaplar
                    </h4>
                    {student.books.length === 0 ? (
                      <div className="p-8 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400 italic">
                        Bu dönem kütüphaneden henüz kitap ödünç alımı kaydedilmemiştir.
                      </div>
                    ) : (
                      <table className="w-full text-xs text-left border-collapse border border-slate-300">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800">
                            <th className="border border-slate-300 p-1.5 w-8 text-center">#</th>
                            <th className="border border-slate-300 p-1.5">Eser Adı</th>
                            <th className="border border-slate-300 p-1.5">Yazar</th>
                            <th className="border border-slate-300 p-1.5 text-center w-20">Sayfa</th>
                            <th className="border border-slate-300 p-1.5 text-center w-24">Teslim Tarihi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {student.books.map((b, bIdx) => (
                            <tr key={bIdx}>
                              <td className="border border-slate-300 p-1.5 text-center font-mono">{bIdx + 1}</td>
                              <td className="border border-slate-300 p-1.5 font-bold text-slate-900">{b.title}</td>
                              <td className="border border-slate-300 p-1.5 text-slate-600">{b.author}</td>
                              <td className="border border-slate-300 p-1.5 text-center font-mono font-bold">
                                {b.page_count} sf.
                              </td>
                              <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-500">
                                {b.return_date || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="mt-5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-xs">
                    <span className="font-bold text-slate-800 block mb-0.5">Kütüphane Kulübü Değerlendirmesi:</span>
                    <p className="text-[11px] text-slate-600 italic">
                      {student.readCount >= 5
                        ? 'Tebrikler! Okuma alışkanlığı ve kütüphane ilgisiyle dönem boyunca örnek bir okur performansı sergiledi.'
                        : student.readCount > 0
                        ? 'Dönem boyunca kütüphanemizden faydalandı; okuma temposunun ve sayfa sayısının artarak devam etmesini dileriz.'
                        : 'Yeni dönemde kütüphanemizi daha sık ziyaret etmesini ve kitapların zengin dünyasıyla buluşmasını temenni ederiz.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 pt-6 text-center text-xs border-t border-slate-200 mt-6">
                  <div>
                    <p className="font-bold text-slate-900">Kütüphane Rehber Öğretmeni</p>
                    <p className="mt-1 text-slate-800 font-semibold">{libraryTeacher || '....................................'}</p>
                    <p className="mt-7 text-slate-400">İmza</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Okul Müdürü</p>
                    <p className="mt-1 text-slate-800 font-semibold">{schoolDirector || '....................................'}</p>
                    <p className="mt-7 text-slate-400">İmza / Mühür</p>
                  </div>
                </div>
              </div>
            ))}

          </div>
        )}
      </div>
    </>
  );
}

export default function ClassReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-mono">Yükleniyor...</div>}>
      <ClassReportContent />
    </Suspense>
  );
}