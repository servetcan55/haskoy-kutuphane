'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function KitaplarPage() {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  
  // Sıralama tercihini localStorage'dan başlatıyoruz (varsayılan: 'demirbas_asc')
  const [sortBy, setSortBy] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('haskoy_book_sort') || 'demirbas_asc';
    }
    return 'demirbas_asc';
  });

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Düzenleme Modalı State'leri
  const [editingBook, setEditingBook] = useState(null);
  const [editForm, setEditForm] = useState({
    demirbas_no: '',
    title: '',
    author: '',
    publisher: '',
    isbn: '',
    shelf_location: '',
    category: 'Roman',
    page_count: '',
    available_copies: 1,
    cover_url: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sıralama değiştiğinde tarayıcı hafızasına kaydediyoruz
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    if (typeof window !== 'undefined') {
      localStorage.setItem('haskoy_book_sort', newSort);
    }
  };

  const loadBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      setMessage({ text: 'Kitaplar yüklenirken hata: ' + error.message, type: 'error' });
    } else {
      setBooks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleDeleteBook = async (id, title) => {
    if (!confirm(`"${title}" isimli kitabı kütüphaneden kalıcı olarak silmek istediğinize emin misiniz?`)) return;

    await supabase.from('loans').delete().eq('book_id', id);
    const { error } = await supabase.from('books').delete().eq('id', id);

    if (error) {
      setMessage({ text: 'Kitap silinirken hata: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: `"${title}" başarıyla silindi.`, type: 'success' });
      loadBooks();
    }
  };

  const openEditModal = (book) => {
    setEditingBook(book);
    setEditForm({
      demirbas_no: book.demirbas_no || '',
      title: book.title || '',
      author: book.author || '',
      publisher: book.publisher || '',
      isbn: book.isbn || '',
      shelf_location: book.shelf_location || '',
      category: book.category || 'Roman',
      page_count: book.page_count ?? '',
      available_copies: book.available_copies ?? 1,
      cover_url: book.cover_url || '',
    });
  };

  const handleUpdateBook = async (e) => {
    e.preventDefault();
    if (!editingBook) return;

    setSaving(true);
    const { error } = await supabase
      .from('books')
      .update({
        demirbas_no: editForm.demirbas_no.trim(),
        title: editForm.title.trim(),
        author: editForm.author.trim(),
        publisher: editForm.publisher.trim(),
        isbn: editForm.isbn.trim(),
        shelf_location: editForm.shelf_location.trim(),
        category: editForm.category.trim(),
        page_count: parseInt(editForm.page_count, 10) || 0,
        available_copies: parseInt(editForm.available_copies, 10) || 0,
        cover_url: editForm.cover_url.trim(),
      })
      .eq('id', editingBook.id);

    if (error) {
      setMessage({ text: 'Güncelleme hatası: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: `"${editForm.title}" başarıyla güncellendi.`, type: 'success' });
      setEditingBook(null);
      loadBooks();
    }
    setSaving(false);
  };

  // Filtreleme ve Sıralama Mantığı
  const filteredBooks = books.filter((b) =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase()) ||
    b.isbn?.includes(search) ||
    b.demirbas_no?.toLowerCase().includes(search.toLowerCase()) ||
    b.shelf_location?.toLowerCase().includes(search.toLowerCase()) ||
    b.category?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'demirbas_asc') {
      return (a.demirbas_no || '').localeCompare(b.demirbas_no || '', 'tr', { numeric: true });
    } else if (sortBy === 'demirbas_desc') {
      return (b.demirbas_no || '').localeCompare(a.demirbas_no || '', 'tr', { numeric: true });
    } else if (sortBy === 'title_asc') {
      return (a.title || '').localeCompare(b.title || '', 'tr');
    } else if (sortBy === 'newest') {
      return b.id - a.id;
    } else if (sortBy === 'oldest') {
      return a.id - b.id;
    }
    return 0;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto antialiased">
      {/* Üst Command Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Katalog Yönetimi</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
              {books.length} Kayıt
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Kitap Envanteri</h1>
          <p className="text-xs text-slate-400">Kütüphanedeki tüm basılı eserler, raf konumları ve anlık stoklar</p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/etiketler"
            className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition shadow-2xs flex items-center gap-1.5"
          >
            🏷️ <span>Barkod Bas</span>
          </Link>
          <Link
            href="/kitap-ekle"
            className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition shadow-md shadow-blue-500/20 flex items-center gap-1.5"
          >
            ➕ <span>Yeni Kitap Ekle</span>
          </Link>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl text-xs font-semibold border backdrop-blur-md transition-all ${
          message.type === 'error'
            ? 'bg-rose-50/80 text-rose-700 border-rose-200 shadow-rose-100'
            : 'bg-emerald-50/80 text-emerald-800 border-emerald-200 shadow-emerald-100'
        }`}>
          {message.text}
        </div>
      )}

      {/* Modern Bento Arama & Sıralama Barı */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Demirbaş no, kitap adı, yazar, tür veya ISBN ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>

        {/* Sıralama Seçenekleri Dropdown */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Sırala:</span>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition font-medium cursor-pointer"
            >
              <option value="demirbas_asc">🏷️ Demirbaş No (Artan)</option>
              <option value="demirbas_desc">🏷️ Demirbaş No (Azalan)</option>
              <option value="title_asc">📖 Kitap Adına Göre (A-Z)</option>
              <option value="newest">✨ En Yeni Eklenen</option>
              <option value="oldest">📜 En Eski Eklenen</option>
            </select>
          </div>

          <span className="text-xs text-slate-400 font-mono hidden md:inline">
            (<strong className="text-slate-700">{filteredBooks.length}</strong> eser)
          </span>

        </div>
      </div>

      {/* Kitap Envanteri Listesi */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">Kitap envanteri yükleniyor...</div>
      ) : filteredBooks.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
          Arama kriterinize uygun kitap bulunamadı.
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredBooks.map((b, index) => {
              const inStock = (b.available_copies || 0) > 0;
              return (
                <div
                  key={b.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/70 transition duration-200 group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {b.cover_url ? (
                      <img
                        src={b.cover_url}
                        alt=""
                        className="w-12 h-16 object-cover rounded-xl shadow-xs border border-slate-200/80 shrink-0 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
                        📖
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-blue-600 transition">
                          {b.title}
                        </h3>
                        {b.demirbas_no && (
                          <span className="font-mono text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-bold border border-sky-100">
                            🏷️ {b.demirbas_no}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400 font-bold">
                          #{index + 1}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                        {b.author || 'Yazar Yok'} • <span className="text-slate-400">{b.publisher || 'Yayınevi Yok'}</span>
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold border border-indigo-100 text-[10px]">
                          📚 {b.category || 'Roman'}
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold border border-slate-200/60">
                          ISBN: {b.isbn || 'Yok'}
                        </span>
                        <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md border border-blue-100 text-[10px]">
                          📍 Raf: {b.shelf_location || 'Belirtilmedi'}
                        </span>
                        {b.page_count > 0 && (
                          <span className="bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-md border border-amber-200 text-[10px] font-mono">
                            📄 {b.page_count} sayfa
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-2 shrink-0">
                    <span
                      className={`text-[11px] px-3 py-1 rounded-full font-bold border transition ${
                        inStock
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          : 'bg-rose-50 text-rose-700 border-rose-200/80'
                      }`}
                    >
                      {inStock ? `Rafta: ${b.available_copies} adet` : 'Tümü Emanette'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(b)}
                        className="text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        Düzenle
                      </button>
                      <span className="text-slate-200">|</span>
                      <button
                        onClick={() => handleDeleteBook(b.id, b.title)}
                        className="text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kitap Düzenleme Modalı */}
      {editingBook && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Envanter Güncelle</span>
                <h2 className="text-base font-bold text-slate-900">Kitabı Düzenle</h2>
              </div>
              <button
                onClick={() => setEditingBook(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateBook} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">🏷️ Demirbaş No</label>
                  <input
                    type="text"
                    placeholder="Örn: 2026-050"
                    value={editForm.demirbas_no}
                    onChange={(e) => setEditForm({ ...editForm, demirbas_no: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Kitap Adı *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Yazar</label>
                  <input
                    type="text"
                    value={editForm.author}
                    onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Yayınevi</label>
                  <input
                    type="text"
                    value={editForm.publisher}
                    onChange={(e) => setEditForm({ ...editForm, publisher: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Kitap Türü / Kategori</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
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
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">ISBN</label>
                  <input
                    type="text"
                    value={editForm.isbn}
                    onChange={(e) => setEditForm({ ...editForm, isbn: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Raf Konumu</label>
                  <input
                    type="text"
                    placeholder="Örn: A-3"
                    value={editForm.shelf_location}
                    onChange={(e) => setEditForm({ ...editForm, shelf_location: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Sayfa Sayısı</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Örn: 160"
                    value={editForm.page_count}
                    onChange={(e) => setEditForm({ ...editForm, page_count: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mevcut Kopya (Stok)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.available_copies}
                    onChange={(e) => setEditForm({ ...editForm, available_copies: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Kapak Görsel Linki (URL)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={editForm.cover_url}
                  onChange={(e) => setEditForm({ ...editForm, cover_url: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBook(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer disabled:bg-blue-300 shadow-md shadow-blue-500/20"
                >
                  {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}