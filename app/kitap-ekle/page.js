'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function AddBookPage() {
  const router = useRouter();

  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [shelfLocation, setShelfLocation] = useState('');
  const [category, setCategory] = useState('Roman'); // Kitap Türü State'i
  const [pageCount, setPageCount] = useState('');
  const [availableCopies, setAvailableCopies] = useState(1);
  const [coverUrl, setCoverUrl] = useState('');

  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // OpenLibrary API üzerinden ISBN ile bilgileri otomatik çekme
  const fetchBookDetailsByISBN = async (targetIsbn = isbn) => {
    const cleanIsbn = targetIsbn.replace(/[-\s]/g, '').trim();
    if (!cleanIsbn) {
      setMessage({ text: 'Lütfen geçerli bir ISBN numarası girin.', type: 'error' });
      return;
    }

    setFetching(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
      const data = await res.json();
      const bookData = data[`ISBN:${cleanIsbn}`];

      if (bookData) {
        setTitle(bookData.title || '');
        setAuthor(bookData.authors?.map((a) => a.name).join(', ') || '');
        setPublisher(bookData.publishers?.map((p) => p.name).join(', ') || '');
        
        if (bookData.number_of_pages) {
          setPageCount(bookData.number_of_pages);
        }

        if (bookData.cover?.medium) {
          setCoverUrl(bookData.cover.medium);
        } else if (bookData.cover?.large) {
          setCoverUrl(bookData.cover.large);
        }
        setMessage({ text: 'Kitap bilgileri, sayfa sayısı ve kapak görseli başarıyla getirildi!', type: 'success' });
      } else {
        setMessage({
          text: 'Bu ISBN numarası ile otomatik kayıt bulunamadı. Lütfen bilgileri manuel giriniz.',
          type: 'error',
        });
      }
    } catch (err) {
      setMessage({ text: 'Bağlantı hatası oluştu: ' + err.message, type: 'error' });
    } finally {
      setFetching(false);
    }
  };

  // Yeni Kitabı Supabase'e Kaydetme
  const handleSaveBook = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setMessage({ text: 'Lütfen en azından kitap adını giriniz.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabase.from('books').insert([
      {
        isbn: isbn.trim(),
        title: title.trim(),
        author: author.trim(),
        publisher: publisher.trim(),
        shelf_location: shelfLocation.trim(),
        category: category.trim(),
        page_count: parseInt(pageCount, 10) || 0,
        available_copies: parseInt(availableCopies, 10) || 1,
        cover_url: coverUrl.trim(),
      },
    ]);

    if (error) {
      setMessage({ text: 'Kitap kaydedilirken hata: ' + error.message, type: 'error' });
      setLoading(false);
    } else {
      setMessage({ text: 'Kitap başarıyla kütüphane envanterine eklendi!', type: 'success' });
      setTimeout(() => {
        router.push('/kitaplar');
      }, 900);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto antialiased">
      {/* Üst Command Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Katalog Ekleme</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-mono text-slate-400">Yeni Eser</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Yeni Kitap Kaydı</h1>
          <p className="text-xs text-slate-400">ISBN taratarak otomatik doldurun veya künye bilgilerini manuel ekleyin</p>
        </div>

        <Link
          href="/kitaplar"
          className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition shadow-2xs flex items-center gap-1.5"
        >
          ← <span>Kitap Envanteri</span>
        </Link>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold border backdrop-blur-md transition-all ${
            message.type === 'error'
              ? 'bg-rose-50/80 text-rose-700 border-rose-200 shadow-rose-100'
              : 'bg-emerald-50/80 text-emerald-800 border-emerald-200 shadow-emerald-100'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 1. Kısım: ISBN Hızlı Getir Bento Kartı */}
      <div className="relative overflow-hidden bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-blue-50 text-blue-600 text-sm">🔍</span>
          <div>
            <h3 className="text-xs font-bold text-slate-900">ISBN & Barkod ile Hızlı Doldur</h3>
            <p className="text-[11px] text-slate-400">Barkod okutucuyu kutuya odaklayıp basın veya numarayı yazın</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs font-mono">
              #
            </span>
            <input
              type="text"
              placeholder="Örn: 9789750719387"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  fetchBookDetailsByISBN();
                }
              }}
              className="w-full pl-8 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white font-mono transition"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchBookDetailsByISBN()}
            disabled={fetching}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-2xl transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:bg-blue-300"
          >
            <span>⚡</span>
            <span>{fetching ? 'Aranıyor...' : 'Bilgileri Getir'}</span>
          </button>
        </div>
      </div>

      {/* 2. Kısım: Detaylı Bilgiler ve Kapak Bento Kartı */}
      <form
        onSubmit={handleSaveBook}
        className="bg-white/80 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-6"
      >
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Sol: Kapak Görseli Önizleme Kutusu */}
          <div className="w-full md:w-44 shrink-0 flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Kapak Önizleme</span>
            <div className="w-36 h-48 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner relative group">
              {coverUrl ? (
                <img src={coverUrl} alt="Kapak" className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform" />
              ) : (
                <div className="text-center p-3 text-slate-400">
                  <span className="text-2xl block mb-1">📖</span>
                  <span className="text-[10px] font-medium leading-tight block">Kapak Görseli Yok</span>
                </div>
              )}
            </div>
          </div>

          {/* Sağ: Kitap Künye Alanları */}
          <div className="flex-1 w-full space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Kitap Adı *</label>
              <input
                type="text"
                placeholder="Örn: Küçük Prens"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Yazar</label>
                <input
                  type="text"
                  placeholder="Örn: Antoine de Saint-Exupéry"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full p-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Yayınevi</label>
                <input
                  type="text"
                  placeholder="Örn: Can Çocuk"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="w-full p-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Raf Konumu - Kitap Türü */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Raf Konumu</label>
                <input
                  type="text"
                  placeholder="Örn: A-2, B-4"
                  value={shelfLocation}
                  onChange={(e) => setShelfLocation(e.target.value)}
                  className="w-full p-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">📚 Kitap Türü / Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition"
                >
                  <option value="Roman">Roman</option>
                  <option value="Hikaye">Hikaye</option>
                  <option value="Şiir">Şiir</option>
                  <option value="Bilim Kurgu / Fantastik">Bilim Kurgu / Fantastik</option>
                  <option value="Tarih">Tarih</option>
                  <option value="Biyografi">Biyografi</option>
                  <option value="Bilim / Araştırma">Bilim / Araştırma</option>
                  <option value="Çocuk Kitabı">Çocuk Kitabı</option>
                  <option value="Din / Felsefe">Din / Felsefe</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>
            </div>

            {/* Sayfa Sayısı - Stok (2'li Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">📄 Sayfa Sayısı</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Örn: 160"
                  value={pageCount}
                  onChange={(e) => setPageCount(e.target.value)}
                  className="w-full p-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white font-mono transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Mevcut Adet (Stok)</label>
                <input
                  type="number"
                  min="1"
                  value={availableCopies}
                  onChange={(e) => setAvailableCopies(e.target.value)}
                  className="w-full p-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white font-mono transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Kapak Görsel Bağlantısı (URL)</label>
              <input
                type="text"
                placeholder="https://covers.openlibrary.org/..."
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className="w-full p-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white font-mono transition"
              />
            </div>
          </div>
        </div>

        {/* Kaydetme Butonu */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-8 py-3.5 rounded-2xl transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:bg-emerald-300"
          >
            <span>✓</span>
            <span>{loading ? 'Kaydediliyor...' : 'Kütüphaneye Kaydet'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}