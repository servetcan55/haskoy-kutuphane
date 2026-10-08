'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import JsBarcode from 'jsbarcode';
import { supabase } from '@/lib/supabase';

function StudentBarcode({ value }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, String(value), {
          format: 'CODE128',
          width: 1.3,
          height: 30,
          displayValue: true,
          fontSize: 10,
          margin: 0,
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [value]);

  return <svg ref={svgRef} className="max-w-full h-auto"></svg>;
}

export default function StudentCardsPage() {
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('students')
        .select('*')
        .order('student_number', { ascending: true });
      setStudents(data || []);
      setLoading(false);
    };
    fetchStudents();
  }, []);

  const classes = Array.from(new Set(students.map((s) => s.grade_class).filter(Boolean))).sort();

  const filteredStudents = selectedClass === 'ALL'
    ? students
    : students.filter((s) => s.grade_class === selectedClass);

  return (
    <>
      {/* 
        BU CSS BLOĞU YAZDIRMA SORUNLARINI KÖKÜNDEN ÇÖZER:
        - Yan menü boşluklarını sıfırlar
        - Sayfayı kâğıdın tam sol-üst köşesine (0,0) sabitler
        - Dikey kaydırma çubuğunu (scrollbar) zorla yok eder
        - Tarayıcının URL ve Tarih eklemesini (header/footer) kaldırır
      */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm; /* Header ve footer'ı yok ederken güvenli baskı payı bırakır */
          }
          
          /* Tüm ekran kısıtlamalarını ve kaydırma çubuklarını yıkıyoruz */
          html, body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important; /* Dikey scroll'u kaldırır */
          }

          /* Ana layout'taki tüm hizalamaları (sidebar boşluğu dahil) sıfırlarız */
          body, main, div {
            position: static !important;
          }

          /* Yazdırma Kapsayıcısı: Kâğıdın sınırlarına %100 hükmeder */
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

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* Ana Kapsayıcıya Yazdırma İçin Özel Sınıf (print-full-width-container) Ekliyoruz */}
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto antialiased print-full-width-container">
        
        {/* Yazdırmada Gizlenecek Kontrol Alanı (Üst Başlık ve Filtreler) */}
        <div className="print:hidden space-y-4 pb-4 border-b border-slate-200/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Öğrenci Portfolyosu</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-mono text-slate-400">A4 Baskı Şablonu</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Barkodlu Öğrenci Kimlik Kartları</h1>
              <p className="text-xs text-slate-400">Ödünç masasında tek tıkla okutulmak üzere sınıflara dağıtılacak kartlar</p>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/ogrenciler"
                className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition shadow-2xs"
              >
                ← Öğrenci Listesi
              </Link>
              <button
                onClick={() => window.print()}
                className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>🖨️</span>
                <span>Kartları Yazdır</span>
              </button>
            </div>
          </div>

          {/* Sınıf Filtresi */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-bold text-slate-600 mr-1">Sınıf Filtrele:</span>
            <button
              onClick={() => setSelectedClass('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedClass === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tüm Okul ({students.length})
            </button>
            {classes.map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedClass === cls ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        {/* YAZDIRILACAK A4 ALANI (Kartların Listelendiği Bölüm) */}
        {loading ? (
          <p className="p-12 text-center text-xs text-slate-400">Öğrenci kartları hazırlanıyor...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
            {filteredStudents.map((st) => (
              <div
                key={st.id}
                className="bg-white border-2 border-slate-300 rounded-3xl p-4 flex flex-col justify-between h-52 relative overflow-hidden shadow-xs print:shadow-none print:border-slate-400 break-inside-avoid"
              >
                {/* Kart Üst Başlık & Okul İsmi */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                      H
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[11px] text-slate-900 leading-tight">HASKÖY ORTAOKULU</h3>
                      <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Kütüphane Üye Kartı</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {st.grade_class || 'Genel'}
                  </span>
                </div>

                {/* Öğrenci Bilgileri */}
                <div className="flex items-center gap-3 my-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center font-black text-slate-600 text-base shrink-0">
                    {st.full_name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-sm text-slate-900 truncate">{st.full_name}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Okul No: <strong className="text-slate-800">{st.student_number}</strong>
                    </p>
                  </div>
                </div>

                {/* Barkod */}
                <div className="border-t border-slate-100 pt-1.5 flex flex-col items-center justify-center">
                  <StudentBarcode value={st.student_number} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}