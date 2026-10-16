'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function TopluKitapYuklePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });

  // CSV dosyasını okuma ve önizleme
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      parseCSV(text);
    };
    reader.readAsText(file, 'utf-8');
  };

  // CSV metnini sütunlara ayırma (Noktalı virgül ve Türkçe Excel uyumlu)
  const parseCSV = (text) => {
    const lines = text.split(/\r\n|\n/);
    const books = [];

    // Başlık satırını atlayıp 1. satırdan itibaren okuyoruz
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Sadece noktalı virgüllerden oluşan boş satırları atla
      if (line.replace(/;/g, '').trim() === '') continue;

      // Sütunları noktalı virgüle göre ayırıyoruz (Excel CSV UTF-8 formatı)
      const cols = line.split(';'); 
      
      if (cols.length >= 2) {
        const title = cols[1]?.replace(/"/g, '').trim();
        if (!title) continue; // Kitap adı yoksa satırı atla

        books.push({
          isbn: cols[0]?.replace(/"/g, '').trim() || '',
          title: title,
          author: cols[2]?.replace(/"/g, '').trim() || '',
          publisher: cols[3]?.replace(/"/g, '').trim() || '',
          page_count: parseInt(cols[5]?.replace(/"/g, '').trim(), 10) || 0,
          category: cols[6]?.replace(/"/g, '').trim() || 'Roman',
          demirbas_no: cols[7]?.replace(/"/g, '').trim() || cols[0]?.replace(/"/g, '').trim() || '',
          available_copies: 1, // Her satır kendi demirbaş numarasına sahip fiziksel kopya
        });
      }
    }

    setPreview(books);
    setMessage({ text: `${books.length} adet geçerli kitap dosyadan okundu ve önizlemeye hazır.`, type: 'success' });
  };

  // Veritabanındaki TÜM ESKİ KİTAPLARI SİLME FONKSİYONU
  const handleClearAllBooks = async () => {
    if (!window.confirm('DİKKAT: Veritabanındaki TÜM kitaplar kalıcı olarak silinecek! Emin misiniz?')) {
      return;
    }

    setLoading(true);
    setMessage({ text: 'Eski kitaplar siliniyor, lütfen bekleyin...', type: 'success' });

    // Önce bağlı emanet kayıtlarını (loans) temizleyelim ki foreign key hatası alınmasın
    await supabase.from('loans').delete().neq('id', 0);
    
    // Sonra kitapları tamamen siliyoruz
    const { error } = await supabase.from('books').delete().neq('id', 0);

    if (error) {
      setMessage({ text: 'Silme hatası: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: 'Veritabanındaki tüm eski kitaplar başarıyla temizlendi! Şimdi yeni listeyi yükleyebilirsiniz.', type: 'success' });
    }
    setLoading(false);
  };

  // Veritabanına toplu kaydetme
  const handleUploadToDatabase = async () => {
    if (preview.length === 0) return;
    setLoading(true);
    setMessage({ text: 'Kitaplar veritabanına yükleniyor, lütfen bekleyin...', type: 'success' });

    const { error } = await supabase.from('books').insert(preview);

    if (error) {
      setMessage({ text: 'Yükleme hatası: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: `Tebrikler! ${preview.length} kitap başarıyla sisteme eklendi.`, type: 'success' });
      setTimeout(() => {
        router.push('/kitaplar');
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto antialiased">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Katalog Yönetimi</span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Excel / CSV ile Toplu Kitap Yükleme</h1>
          <p className="text-xs text-slate-400">Elinizdeki binlerce eseri demirbaş numaralarıyla birlikte tek tıkla aktarın</p>
        </div>
        <Link
          href="/kitaplar"
          className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition"
        >
          ← Kitap Envanterine Dön
        </Link>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl text-xs font-semibold border ${
          message.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* SIFIRLAMA (TEMİZLEME) KUTUSU */}
      <div className="bg-rose-50/60 p-5 rounded-3xl border border-rose-200 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-black text-rose-900">Mevcut Envanteri Temizle</h3>
          <p className="text-[11px] text-rose-700 mt-0.5">Eğer veritabanındaki eski test kayıtlarını silip sıfırdan başlamak istiyorsanız aşağıdaki butonu kullanabilirsiniz.</p>
        </div>
        <button
          onClick={handleClearAllBooks}
          disabled={loading}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer whitespace-nowrap disabled:bg-rose-300"
        >
          Tüm Kitapları Sil / Sıfırla
        </button>
      </div>

      {/* Yükleme Alanı */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <label className="block text-xs font-bold text-slate-700">Excel / CSV Dosyanızı Seçin</label>
        <input
          type="file"
          accept=".csv, .txt"
          onChange={handleFileUpload}
          className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
        />
        <p className="text-[11px] text-slate-400">
          * Not: Excel dosyanızı kaydederken tür olarak <b>CSV UTF-8 (Virgülle ayrılmış)</b> seçtiğinizden emin olun.
        </p>
      </div>

      {/* Önizleme Listesi */}
      {preview.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Yüklenecek Kitaplar Önizlemesi ({preview.length} Eser)</h3>
            <button
              onClick={handleUploadToDatabase}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-md shadow-blue-500/20 cursor-pointer disabled:bg-blue-300"
            >
              {loading ? 'Yükleniyor...' : 'Veritabanına Kaydet'}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="p-3 font-bold">Demirbaş No</th>
                  <th className="p-3 font-bold">Kitap Adı</th>
                  <th className="p-3 font-bold">Yazar</th>
                  <th className="p-3 font-bold">Yayınevi</th>
                  <th className="p-3 font-bold">Sayfa</th>
                  <th className="p-3 font-bold">Tür</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-sky-700 font-bold">{b.demirbas_no}</td>
                    <td className="p-3 font-bold text-slate-900">{b.title}</td>
                    <td className="p-3 text-slate-600">{b.author}</td>
                    <td className="p-3 text-slate-500">{b.publisher}</td>
                    <td className="p-3 font-mono text-amber-600 font-bold">{b.page_count}</td>
                    <td className="p-3 text-indigo-600">{b.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}