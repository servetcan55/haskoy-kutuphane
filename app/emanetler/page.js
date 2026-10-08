'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { sound } from '@/lib/audio';

export default function LoansPage() {
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [openMenuId, setOpenMenuId] = useState(null);

  const loadLoans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('loans')
      .select(`
        id,
        loan_date,
        due_date,
        return_date,
        status,
        condition_note,
        student_id,
        book_id,
        books:book_id ( id, title, author, cover_url, available_copies ),
        students:student_id ( id, full_name, student_number, grade_class )
      `)
      .order('id', { ascending: false });

    if (!error && data) {
      setLoans(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const isReturned = (status) => {
    if (!status) return false;
    const s = String(status).toLowerCase();
    return s.includes('iade') || s.includes('kayıp') || s.includes('return') || s.includes('lost');
  };

  // İade & Durum Yönetim Fonksiyonu
  const handleReturnAction = async (loan, actionType) => {
    setOpenMenuId(null);
    const today = new Date().toISOString().split('T')[0];
    let newStatus = 'iade edildi (sağlam)';
    let note = '';
    let shouldIncreaseStock = true;

    if (actionType === 'damaged') {
      newStatus = 'iade edildi (hasarlı)';
      note = prompt('Kitap hasar durumu hakkında kısa bir not girin (Örn: Sayfası yırtık):') || 'Hasarlı teslim alındı';
      shouldIncreaseStock = true;
    } else if (actionType === 'lost') {
      if (!confirm(`"${loan.books?.title}" kitabını KAYIP olarak işaretlemek istiyor musunuz? Stok artırılmayacak ve öğrencinin kütüğüne kayıp olarak işlenecektir.`)) return;
      newStatus = 'kayıp';
      note = 'Öğrenci kitabı kaybettiğini beyan etti.';
      shouldIncreaseStock = false;
    }

    // 1. Loans tablosunu güncelle
    const { error: loanError } = await supabase
      .from('loans')
      .update({
        return_date: today,
        status: newStatus,
        condition_note: note,
      })
      .eq('id', loan.id);

    if (loanError) {
      setMessage({ text: 'İşlem hatası: ' + loanError.message, type: 'error' });
      sound?.playError?.();
      return;
    }

    // 2. Kitap Stoğunu Güncelle (Sadece sağlam ve hasarlı teslimde +1)
    if (shouldIncreaseStock) {
      const currentCopies = loan.books?.available_copies ?? 0;
      await supabase
        .from('books')
        .update({ available_copies: currentCopies + 1 })
        .eq('id', loan.book_id);
    }

    if (actionType === 'lost') {
      setMessage({ text: `"${loan.books?.title}" kitabı kayıp olarak kütüphane kütüğüne işlendi.`, type: 'error' });
      sound?.playError?.();
    } else {
      setMessage({ text: `✓ "${loan.books?.title}" kitabı başarıyla teslim alındı.`, type: 'success' });
      sound?.playReturn?.();
    }

    loadLoans();
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const activeLoans = loans.filter((l) => !isReturned(l.status));
  const pastLoans = loans.filter((l) => isReturned(l.status));

  const currentList = activeTab === 'active' ? activeLoans : pastLoans;

  const filteredLoans = currentList.filter((loan) => {
    const q = search.toLowerCase();
    const bookTitle = loan.books?.title?.toLowerCase() || '';
    const studentName = loan.students?.full_name?.toLowerCase() || '';
    const studentNo = loan.students?.student_number || '';
    return bookTitle.includes(q) || studentName.includes(q) || studentNo.includes(q);
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto antialiased">
      {/* Üst Command Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Dolaşım & Takip</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
              {activeLoans.length} Emanette
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Emanet & Takip Paneli</h1>
          <p className="text-xs text-slate-400">Aktif emanetler, teslim süreleri, hasarlı ve kayıp kitap durum yönetimi</p>
        </div>

        <Link
          href="/"
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

      {/* Kontrol Çubuğu: Tablar ve Arama */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>⏳ Emanettekiler</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">
              {activeLoans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>✓ Geçmiş İşlemler</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
              {pastLoans.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
            🔍
          </span>
          <input
            type="text"
            placeholder="Kitap veya öğrenci ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Liste Kartı */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xs overflow-visible">
        {loading ? (
          <p className="p-16 text-center text-xs text-slate-400 font-mono">Emanet kayıtları yükleniyor...</p>
        ) : filteredLoans.length === 0 ? (
          <p className="p-16 text-center text-xs text-slate-400">Bu bölümde gösterilecek kayıt bulunamadı.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLoans.map((loan) => {
              let diffDays = null;
              if (loan.due_date) {
                const due = new Date(loan.due_date);
                due.setHours(0, 0, 0, 0);
                diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
              }

              const isLost = loan.status?.includes('kayıp');
              const isDamaged = loan.status?.includes('hasarlı');

              return (
                <div
                  key={loan.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
                >
                  {/* Kitap Bilgisi */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {loan.books?.cover_url ? (
                      <img
                        src={loan.books.cover_url}
                        alt=""
                        className="w-11 h-15 object-cover rounded-xl border border-slate-200 shadow-2xs shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-15 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-400 font-bold shrink-0">
                        📖
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 truncate">{loan.books?.title || 'Bilinmeyen Kitap'}</h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{loan.books?.author || 'Yazar Belirtilmemiş'}</p>
                      
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] font-mono text-slate-500">
                          Veriliş: {loan.loan_date ? new Date(loan.loan_date).toLocaleDateString('tr-TR') : '-'}
                        </span>

                        {activeTab === 'active' && diffDays !== null && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            diffDays < 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                              : diffDays <= 3
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {diffDays < 0 ? `${Math.abs(diffDays)} Gün Gecikti` : `${diffDays} Gün Kaldı`}
                          </span>
                        )}

                        {activeTab === 'history' && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            isLost
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isDamaged
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {isLost ? '❌ Kayıp Kitap' : isDamaged ? '⚠️ Hasarlı İade' : '✓ Sağlam İade'}
                          </span>
                        )}

                        {loan.condition_note && (
                          <span className="text-[10px] italic text-slate-400">
                            ({loan.condition_note})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sağ: Öğrenci ve İade Açılır Menüsü */}
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 shrink-0">
                    <div className="text-left sm:text-right">
                      <Link
                        href={`/ogrenciler/${loan.students?.id}`}
                        className="font-bold text-xs text-slate-900 hover:text-blue-600 hover:underline block"
                      >
                        {loan.students?.full_name || 'Öğrenci'}
                      </Link>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        No: {loan.students?.student_number} • <span className="text-indigo-600 font-semibold">{loan.students?.grade_class}</span>
                      </p>
                    </div>

                    {activeTab === 'active' && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === loan.id ? null : loan.id)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <span>İade Al</span>
                          <span className="text-[10px]">▼</span>
                        </button>

                        {/* Açılır Durum Menüsü */}
                        {openMenuId === loan.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95">
                            <button
                              onClick={() => handleReturnAction(loan, 'clean')}
                              className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer transition"
                            >
                              <span>✓</span>
                              <span>Sağlam İade Al (+1)</span>
                            </button>

                            <button
                              onClick={() => handleReturnAction(loan, 'damaged')}
                              className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer transition"
                            >
                              <span>⚠️</span>
                              <span>Hasarlı İade Al (+1)</span>
                            </button>

                            <div className="border-t border-slate-100 my-1"></div>

                            <button
                              onClick={() => handleReturnAction(loan, 'lost')}
                              className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition"
                            >
                              <span>❌</span>
                              <span>Öğrenci Kaybetti</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}