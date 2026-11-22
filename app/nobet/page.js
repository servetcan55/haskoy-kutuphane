'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

const AYLAR = {
  ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4, mayıs: 5, mayis: 5,
  haziran: 6, temmuz: 7, ağustos: 8, agustos: 8, eylül: 9, eylul: 9,
  ekim: 10, kasım: 11, kasim: 11, aralık: 12, aralik: 12,
};

function parseExcelDateToISO(rawDate) {
  if (!rawDate) return '';

  // Excel seri numarasıysa (örn: 46356)
  if (typeof rawDate === 'number') {
    const parsed = XLSX.SSF.parse_date_code(rawDate);
    if (parsed) {
      return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }

  const str = String(rawDate).trim();

  // YYYY-AA-GG formatıysa
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // GG.AA.YYYY veya GG/AA/YYYY formatıysa
  const dotMatch = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dotMatch) {
    return `${dotMatch[3]}-${dotMatch[2].padStart(2, '0')}-${dotMatch[1].padStart(2, '0')}`;
  }

  // "30 Kasım 2026" Türkçe metin formatıysa
  const parts = str.split(/\s+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthNum = AYLAR[parts[1].toLocaleLowerCase('tr-TR')];
    const year = parseInt(parts[2], 10);
    if (day && monthNum && year) {
      return `${String(year).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return '';
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

  // Örnek Excel Şablonu İndirme
  const handleDownloadSampleExcel = () => {
    const sampleRows = [
      ['HASKÖY ORTAOKULU KÜTÜPHANE NÖBET TABLOSU'],
      ['Örnek Şablon — Tarih, Gün ve Nöbetçi sütunlarını doldurup sisteme yükleyebilirsiniz.'],
      [],
      ['Sıra', 'Hafta', 'Tarih', 'Gün', '5. Sınıf Nöbetçisi', '6. Sınıf Nöbetçisi', '7. Sınıf Nöbetçisi'],
      [1, '1. Hafta', '30 Kasım 2026', 'Pazartesi', 'Örnek Öğrenci 1 (5A - 101)', 'Örnek Öğrenci 2 (6A - 202)', 'Örnek Öğrenci 3 (7A - 303)'],
      [2, '1. Hafta', '01 Aralık 2026', 'Salı', 'Örnek Öğrenci 4 (5B - 104)', 'Örnek Öğrenci 5 (6B - 205)', 'Örnek Öğrenci 6 (7B - 306)'],
      [3, '1. Hafta', '02 Aralık 2026', 'Çarşamba', 'Örnek Öğrenci 7 (5C - 107)', 'Örnek Öğrenci 8 (6C - 208)', 'Örnek Öğrenci 9 (7C - 309)'],
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

  // Excel Dosyasından Veri Yükleme
  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage({ text: '', type: '' });

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      // "Nöbet Çizelgesi" sayfası varsa onu, yoksa ilk sayfayı al
      const sheetName =
        workbook.SheetNames.find((name) => name.toLocaleLowerCase('tr-TR').includes('çizelge')) ||
        workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Başlık satırını otomatik tespit et ("Tarih" ve "5. Sınıf" / "Nöbetçisi" içeren satır)
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
        const rowText = rawRows[i].map((c) => String(c).toLocaleLowerCase('tr-TR')).join(' ');
        if (rowText.includes('tarih') && (rowText.includes('5.') || rowText.includes('nöbet'))) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        throw new Error('Excel dosyasında "Tarih" ve nöbetçi sütunlarını içeren başlık satırı bulunamadı.');
      }

      const headers = rawRows[headerIdx].map((h) => String(h).toLocaleLowerCase('tr-TR').trim());
      const colIndex = {
        sira: headers.findIndex((h) => h.includes('sıra')),
        hafta: headers.findIndex((h) => h.includes('hafta')),
        tarih: headers.findIndex((h) => h.includes('tarih')),
        gun: headers.findIndex((h) => h.includes('gün')),
        sinif_5: headers.findIndex((h) => h.includes('5.')),
        sinif_6: headers.findIndex((h) => h.includes('6.')),
        sinif_7: headers.findIndex((h) => h.includes('7.')),
      };

      const parsedRecords = [];
      for (let r = headerIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.every((cell) => String(cell).trim() === '')) continue;

        const rawTarih = colIndex.tarih >= 0 ? row[colIndex.tarih] : '';
        const dutyDateISO = parseExcelDateToISO(rawTarih);
        if (!dutyDateISO) continue; // Tarih olmayan dipnot/toplam satırlarını atla

        const sinif5 = colIndex.sinif_5 >= 0 ? String(row[colIndex.sinif_5] ?? '').trim() : '';
        const sinif6 = colIndex.sinif_6 >= 0 ? String(row[colIndex.sinif_6] ?? '').trim() : '';
        const sinif7 = colIndex.sinif_7 >= 0 ? String(row[colIndex.sinif_7] ?? '').trim() : '';

        if (!sinif5 && !sinif6 && !sinif7) continue;

        parsedRecords.push({
          sira: colIndex.sira >= 0 && Number(row[colIndex.sira]) ? Number(row[colIndex.sira]) : parsedRecords.length + 1,
          hafta: colIndex.hafta >= 0 ? String(row[colIndex.hafta] ?? '').trim() : '',
          tarih_metin: typeof rawTarih === 'number' ? dutyDateISO : String(rawTarih).trim(),
          duty_date: dutyDateISO,
          gun: colIndex.gun >= 0 ? String(row[colIndex.gun] ?? '').trim() : '',
          sinif_5: sinif5,
          sinif_6: sinif6,
          sinif_7: sinif7,
        });
      }

      if (parsedRecords.length === 0) {
        throw new Error('Excel dosyasında geçerli tarih ve nöbetçi kaydı bulunamadı.');
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
      {/* Üst Başlık */}
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

      {/* Excel Yükleme & Örnek Şablon Kartı */}
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

      {/* Yüklü Nöbet Çizelgesi Önizleme */}
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