'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAcademicInfo } from '@/lib/academic';

export default function RootLandingPage() {
  const [savedStudent, setSavedStudent] = useState(null);
  const currentAcademic = getAcademicInfo();

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

        {/* 🎓 ÖĞRENCİ GİRİŞİ */}
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

        {/* 🔐 PERSONEL GİRİŞİ BUTONU */}
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