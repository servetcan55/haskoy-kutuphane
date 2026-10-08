'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoanDeskPage() {
  const [students, setStudents] = useState([]);
  const [books, setBooks] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [returnDays, setReturnDays] = useState(15);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchData = async () => {
      const [stRes, bkRes] = await Promise.all([
        supabase.from('students').select('*').order('full_name', { ascending: true }),
        supabase.from('books').select('*').order('title', { ascending: true }),
      ]);
      setStudents(stRes.data || []);
      setBooks(bkRes.data || []);
    };
    fetchData();
  }, []);

  const filteredBooks = books.filter((b) => {
    const q = bookSearch.toLowerCase().trim();
    return (
      b.title?.toLowerCase().includes(q) ||
      b.author?.toLowerCase().includes(q) ||
      b.isbn?.toLowerCase().includes(q) ||
      String(b.id) === q
    );
  });

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.toLowerCase().trim();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.student_number?.toLowerCase().includes(q) ||
      s.grade_class?.toLowerCase().includes(q)
    );
  });

  const handleLendBook = async () => {
    if (!selectedStudent) {
      setMessage({ text: 'Lütfen kitabı teslim alacak öğrenciyi seçin.', type: 'error' });
      return;
    }
    if (!selectedBook) {
      setMessage({ text: 'Lütfen verilecek kitabı seçin veya barkodunu okutun.', type: 'error' });
      return;
    }
    if ((selectedBook.available_copies || 0) <= 0) {
      setMessage({ text: 'Bu kitabın rafta mevcut kopyası bulunmuyor!', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(today.getDate() + parseInt(returnDays, 10));

    const todayStr = today.toISOString().split('T')[0];
    const dueStr = dueDate.toISOString().split('T')[0];

    const { error: loanError } = await supabase.from('loans').insert([
      {
        student_id: selectedStudent.id,
        book_id: selectedBook.id,
        loan_date: todayStr,
        due_date: dueStr,
        status: 'emanette',
      },
    ]);

    if (loanError) {
      setMessage({ text: 'İşlem başarısız: ' + loanError.message, type: 'error' });
      setLoading(false);
      return;
    }

    const newCopies = Math.max(0, (selectedBook.available_copies || 1) - 1);
    await supabase.from('books').update({ available_copies: newCopies }).eq('id', selectedBook.id);

    setBooks((prev) =>
      prev.map((b) => (b.id === selectedBook.id ? { ...b, available_copies: newCopies } : b))
    );

    setMessage({
      text: `✓ "${selectedBook.title}" başarıyla ${selectedStudent.full_name} (${selectedStudent.grade_class}) öğrencisine verildi. Son teslim: ${dueDate.toLocaleDateString('tr-TR')}`,
      type: 'success',
    });

    setSelectedBook(null);
    setBookSearch('');
    setLoading(false);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto antialiased">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Hızlı Dolaşım Masası</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-mono text-slate-400">Kitap Teslim Ekranı</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Ödünç Masası</h1>
          <p className="text-xs text-slate-400">Barkod okutarak veya listeden seçerek saniyeler içinde öğrenciye teslim edin</p>
        </div>

        {/* 
          HATA BURADAYDI: href="/" olan bağlantıyı href="/dashboard" olarak düzelttim.
          Eğer yönetici paneli ana sayfanızın adresi farklıysa (örneğin /admin), lütfen /dashboard kısmını değiştirin.
        */}
        <Link
          href="/dashboard"
          className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition shadow-2xs flex items-center gap-1.5"
        >
          ← <span>Ana Sayfa</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. ADIM: ÖĞRENCİ SEÇ */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                1
              </span>
              <h3 className="font-bold text-sm text-slate-900">Öğrenci Seç</h3>
            </div>
            {selectedStudent && (
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Seçimi Değiştir
              </button>
            )}
          </div>

          {selectedStudent ? (
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                {selectedStudent.full_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">Seçilen Okur</span>
                <h4 className="font-bold text-slate-900 text-sm">{selectedStudent.full_name}</h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Okul No: {selectedStudent.student_number} • Sınıf: <strong>{selectedStudent.grade_class}</strong>
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                Seçildi ✓
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Öğrenci adı, okul no veya sınıf yazın..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {filteredStudents.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">Eşleşen öğrenci bulunamadı.</p>
                ) : (
                  filteredStudents.slice(0, 10).map((st) => (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStudent(st)}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          {st.student_number}
                        </span>
                        <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                          {st.full_name}
                        </span>
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                          {st.grade_class}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 group-hover:text-indigo-600">Seç →</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. ADIM: KİTAP SEÇ / BARKOD OKUT */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                2
              </span>
              <h3 className="font-bold text-sm text-slate-900">Kitap Seç veya Barkod Okut</h3>
            </div>
            {selectedBook && (
              <button
                onClick={() => setSelectedBook(null)}
                className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Seçimi Değiştir
              </button>
            )}
          </div>

          {selectedBook ? (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center gap-3.5">
              {selectedBook.cover_url ? (
                <img src={selectedBook.cover_url} alt="" className="w-12 h-16 object-cover rounded-lg border shadow-xs" />
              ) : (
                <div className="w-12 h-16 bg-blue-100 rounded-lg flex items-center justify-center text-xs font-bold text-blue-700 border">
                  📖
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Seçilen Kitap</span>
                <h4 className="font-bold text-slate-900 text-sm truncate">{selectedBook.title}</h4>
                <p className="text-xs text-slate-500 truncate">{selectedBook.author}</p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Raf: <strong>{selectedBook.shelf_location || 'Yok'}</strong> • Rafta: <strong className="text-emerald-600">{selectedBook.available_copies} adet</strong>
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                Hazır ✓
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
                  ⚡
                </span>
                <input
                  type="text"
                  placeholder="Barkod okutun veya kitap adı/yazar yazın..."
                  value={bookSearch}
                  onChange={(e) => {
                    setBookSearch(e.target.value);
                    const exact = books.find(
                      (b) => b.isbn === e.target.value.trim() || `HK-${String(b.id).padStart(5, '0')}` === e.target.value.trim()
                    );
                    if (exact) setSelectedBook(exact);
                  }}
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-mono transition"
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {filteredBooks.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">Kitap bulunamadı.</p>
                ) : (
                  filteredBooks.slice(0, 10).map((bk) => {
                    const inStock = (bk.available_copies || 0) > 0;
                    return (
                      <div
                        key={bk.id}
                        onClick={() => inStock && setSelectedBook(bk)}
                        className={`p-3 flex items-center justify-between transition group ${
                          inStock ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-40 cursor-not-allowed bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {bk.cover_url ? (
                            <img src={bk.cover_url} alt="" className="w-7 h-10 object-cover rounded border shrink-0" />
                          ) : (
                            <div className="w-7 h-10 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0 border">
                              📖
                            </div>
                          )}
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600">{bk.title}</h5>
                            <p className="text-[10px] text-slate-400 truncate">{bk.author} • Raf: {bk.shelf_location || '-'}</p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          inStock ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {inStock ? `${bk.available_copies} adet` : 'Tükendi'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xs p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700">Teslim Süresi:</span>
          <div className="flex items-center gap-1.5">
            {[7, 15, 20, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setReturnDays(days)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  returnDays === days
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {days} Gün
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleLendBook}
          disabled={loading || !selectedStudent || !selectedBook}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-8 py-3.5 rounded-2xl transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          <span>📖</span>
          <span>{loading ? 'İşleniyor...' : 'Ödünç Verme İşlemini Tamamla'}</span>
        </button>
      </div>
    </div>
  );
}