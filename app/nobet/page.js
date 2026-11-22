'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

const AYLAR = {
  ocak: 1,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  eylul: 9,
  ekim: 10,
  kasim: 11,
  aralik: 12,
};

function normalizeTr(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
    .trim();
}

function excelSerialToISO(serial) {
  const num = Number(serial);
  if (!Number.isFinite(num) || num < 20000 || num > 100000) return '';
  const utcDays = Math.floor(num - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  if (isNaN(date.getTime())) return '';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseExcelDateToISO(rawDate) {
  if (rawDate === null || rawDate === undefined || rawDate === '') return '';

  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, '0');
    const d = String(rawDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof rawDate === 'number') {
    return excelSerialToISO(rawDate);
  }

  const str = String(rawDate).normalize('NFKC').trim();
  if (!str) return '';

  if (/^\d{5}(\.\d+)?$/.test(str)) {
    return excelSerialToISO(str);
  }

  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const dotMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (dotMatch) {
    const year = dotMatch[3].length === 2 ? `20${dotMatch[3]}` : dotMatch[3];
    return `${year}-${dotMatch[2].padStart(2, '0')}-${dotMatch[1].padStart(2, '0')}`;
  }

  const parts = str.split(/[\s,.-]+/).filter(Boolean);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthKey = normalizeTr(parts[1]);
    const monthNum = AYLAR[monthKey];
    const year = parseInt(parts[2], 10);
    if (day >= 1 && day <= 31 && monthNum && year >= 2000) {
      return `${String(year).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return '';
}

function formatDisplayDate(rawDate, isoDate) {
  if (typeof rawDate === 'string' && rawDate.trim() && !/^\d{5}/.test(rawDate.trim()) && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) {
    return rawDate.trim();
  }
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  const monthNames = [
    '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  return `${d} ${monthNames[parseInt(m, 10)] || m} ${y}`;
}

export default function NobetYonetimPage() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadDuties = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('library_duties')
      .select('*')
      .order('duty_date', { ascending: true });

    if (error) {
      setMessage({ text: 'Nöbet listesi yüklenirken hata: ' + error.message, type: 'error' });
    } else {
      setDuties(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      loadDuties();
    }
  }, [user]);

  const handleDownloadSampleExcel = () => {
    const sampleRows = [
      ['HASKÖY ORTAOKULU KÜTÜPHANE NÖBET TABLOSU'],
      ['Örnek Şablon — Tarih, Gün ve Nöbetçi sütunlarını doldurup sisteme yükleyebilirsiniz.'],
      [],
      ['Sıra', 'Hafta', 'Tarih', 'Gün', '5. Sınıf Nöbetçisi', '6. Sınıf Nöbetçisi', '7. Sınıf Nöbetçisi'],
      [1, '1. Hafta', '30 Kasım 2026', 'Pazartesi', 'Ömer Emin Toprak (5A)', 'Bilal Eymen Çilingir (6A)', 'Hilal Kara (7A)'],
      [2, '1. Hafta', '01 Aralık 2026', 'Salı', 'Yağız Marap (5A)', 'Sare Gün (6A)', 'Ali Arhan Çakır (7A)'],
      [3, '1. Hafta', '02 Aralık 2026', 'Çarşamba', 'İkra Kaya (5B)', 'Poyraz Emir Göz (6A)', 'Zehra Dildar Çakır (7A)'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sampleRows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 18 },
      { wch: 14 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nöbet Çizelgesi');
    XLSX.writeFile(workbook, 'Ornek_Kutuphane_Nobet_Sablonu.xlsx');
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage({ text: '', type: '' });

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      const sheetName =
        workbook.SheetNames.find((name) => normalizeTr(name).includes('cizelge')) ||
        workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
      const formattedRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

      // Gerçek tablo başlık satırını bul: "tarih" sütunu ve en az bir sınıf/nöbetçi sütunu içermeli
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
        const normalizedCells = (formattedRows[i] || rawRows[i] || []).map((c) => normalizeTr(c));
        const hasTarihCol = normalizedCells.some((c) => c === 'tarih' || c.startsWith('tarih'));
        const hasGradeCol = normalizedCells.some(
          (c) => c.includes('5.') || c.includes('6.') || c.includes('7.') || c.includes('sinif')
        );
        if (hasTarihCol && hasGradeCol) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        throw new Error('Excel dosyasında "Tarih" ve sınıf/nöbetçi sütunlarını içeren başlık satırı bulunamadı.');
      }

      const headers = (formattedRows[headerIdx] || rawRows[headerIdx]).map((h) => normalizeTr(h));
      const colIndex = {
        sira: headers.findIndex((h) => h === 'sira' || h.includes('sira')),
        hafta: headers.findIndex((h) => h === 'hafta' || h.includes('hafta')),
        tarih: headers.findIndex((h) => h === 'tarih' || h.startsWith('tarih')),
        gun: headers.findIndex((h) => h === 'gun' || h.includes('gun')),
        sinif_5: headers.findIndex((h) => h.includes('5.') || h.startsWith('5 ')),
        sinif_6: headers.findIndex((h) => h.includes('6.') || h.startsWith('6 ')),
        sinif_7: headers.findIndex((h) => h.includes('7.') || h.startsWith('7 ')),
      };

      const parsedRecords = [];
      let sampleUnparsedDate = '';

      for (let r = headerIdx + 1; r < rawRows.length; r++) {
        const rawRow = rawRows[r] || [];
        const fmtRow = formattedRows[r] || rawRow;
        if (fmtRow.every((cell) => String(cell ?? '').trim() === '')) continue;

        const rawTarih = colIndex.tarih >= 0 ? rawRow[colIndex.tarih] : '';
        const fmtTarih = colIndex.tarih >= 0 ? fmtRow[colIndex.tarih] : '';

        // Tekrarlayan alt başlık satırlarını atla
        const normTarih = normalizeTr(fmtTarih);
        if (!normTarih || normTarih === 'tarih' || normTarih === 'sira') continue;

        const dutyDateISO = parseExcelDateToISO(fmtTarih) || parseExcelDateToISO(rawTarih);
        if (!dutyDateISO) {
          if (!sampleUnparsedDate) {
            sampleUnparsedDate = `"${fmtTarih || rawTarih}"`;
          }
          continue;
        }

        const sinif5 = colIndex.sinif_5 >= 0 ? String(fmtRow[colIndex.sinif_5] ?? '').trim() : '';
        const sinif6 = colIndex.sinif_6 >= 0 ? String(fmtRow[colIndex.sinif_6] ?? '').trim() : '';
        const sinif7 = colIndex.sinif_7 >= 0 ? String(fmtRow[colIndex.sinif_7] ?? '').trim() : '';

        if (!sinif5 && !sinif6 && !sinif7) continue;

        parsedRecords.push({
          sira: colIndex.sira >= 0 && Number(rawRow[colIndex.sira]) ? Number(rawRow[colIndex.sira]) : parsedRecords.length + 1,
          hafta: colIndex.hafta >= 0 ? String(fmtRow[colIndex.hafta] ?? '').trim() : '',
          tarih_metin: formatDisplayDate(fmtTarih || rawTarih, dutyDateISO),
          duty_date: dutyDateISO,
          gun: colIndex.gun >= 0 ? String(fmtRow[colIndex.gun] ?? '').trim() : '',
          sinif_5: sinif5,
          sinif_6: sinif6,
          sinif_7: sinif7,
        });
      }

      if (parsedRecords.length === 0) {
        throw new Error(
          `Excel dosyasında geçerli tarih ve nöbetçi kaydı bulunamadı.${
            sampleUnparsedDate ? ` (Okunan örnek tarih hücresi: ${sampleUnparsedDate})` : ''
          }`
        );
      }

      if (replaceExisting) {
        const { error: delError } = await supabase.from('library_duties').delete().neq('id', 0);
        if (delError) throw delError;
      }

      const { error: insError } = await supabase.from('library_duties').insert(parsedRecords);
      if (insError) throw insError;

      setMessage({
        text: `✓ Excel başarıyla içe aktarıldı! Toplam ${parsedRecords.length} nöbet günü güncellendi ve Pano TV ile senkronize edildi.`,
        type: 'success',
      });
      loadDuties();
    } catch (err) {
      setMessage({ text: 'Excel yükleme hatası: ' + err.message, type: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (authChecking) {
    return <div className="p-8 text-center text-xs text-slate-400">Yetki kontrol ediliyor...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-3 shadow-xs">
          <span className="text-3xl">🔒</span>
          <h1 className="text-lg font-black text-slate-900">Yönetici / Personel Alanı</h1>
          <p className="text-xs text-slate-500">
            Kütüphane nöbet çizelgesi yalnızca yetkili personel tarafından yönetilebilir.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
              Yönetim Girişi
            </Link>
            <Link href="/pano" className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
              Pano TV
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto antialiased">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Personel Paneli</span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Kütüphane Nöbet Çizelgesi</h1>
          <p className="text-xs text-slate-400">Excel dosyasından nöbet listesi yükleyin, Pano TV o günün 3 nöbetçisini otomatik göstersin</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/pano" className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2.5 rounded-xl">
            📺 Pano TV
          </Link>
          <Link href="/dashboard" className="text-xs font-semibold bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl">
            ← Panele Dön
          </Link>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl text-xs font-bold border ${
          message.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-sm font-black text-slate-900">Excel ile Nöbet Listesi Yükle / Güncelle</h2>
          <p className="text-xs text-slate-500">
            Hazırladığınız <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">.xlsx</code> dosyasını yüklediğinizde tüm tarihler otomatik eşleştirilir.
          </p>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            <span>Yüklemeden önce mevcut eski nöbet listesini temizle (Önerilen)</span>
          </label>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadSampleExcel}
            className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl transition cursor-pointer flex items-center gap-1.5"
          >
            📥 <span>Örnek Excel İndir</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelUpload}
            className="hidden"
          />

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl transition shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            📤 <span>{uploading ? 'Excel Yükleniyor...' : 'Excel Verisi Yükle'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Aktif Nöbet Çizelgesi ({duties.length} Gün)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="p-3">#</th>
                <th className="p-3">Hafta</th>
                <th className="p-3">Tarih</th>
                <th className="p-3">Gün</th>
                <th className="p-3">5. Sınıf Nöbetçisi</th>
                <th className="p-3">6. Sınıf Nöbetçisi</th>
                <th className="p-3">7. Sınıf Nöbetçisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">Yükleniyor...</td>
                </tr>
              ) : duties.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-10 text-center text-slate-400">
                    Henüz nöbet listesi yüklenmemiş. Yukarıdaki <strong>"Excel Verisi Yükle"</strong> butonuyla dosyanızı yükleyebilirsiniz.
                  </td>
                </tr>
              ) : (
                duties.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="p-3 font-mono text-slate-400">{d.sira}</td>
                    <td className="p-3 text-slate-500">{d.hafta}</td>
                    <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{d.tarih_metin || d.duty_date}</td>
                    <td className="p-3 text-slate-600">{d.gun}</td>
                    <td className="p-3 font-medium text-blue-700">{d.sinif_5}</td>
                    <td className="p-3 font-medium text-emerald-700">{d.sinif_6}</td>
                    <td className="p-3 font-medium text-amber-700">{d.sinif_7}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}