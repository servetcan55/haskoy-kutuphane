'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getAcademicInfo } from '@/lib/academic';

const PIN_COLUMN = 'pin_code';
const WEAK_PINS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321']);

function normalizeClassValue(val) {
  return String(val ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLocaleUpperCase('tr-TR');
}

function isValidFourDigitPin(pin) {
  return /^\d{4}$/.test(String(pin ?? '').trim());
}

export default function StudentPortalPage() {
  const currentAcademic = getAcademicInfo();

  // Oturum ve PIN Akışı State'leri
  const [currentStudent, setCurrentStudent] = useState(null);
  const [pendingStudent, setPendingStudent] = useState(null); // 'setup' | 'verify' için doğrulanmış aday
  const [authStep, setAuthStep] = useState('credentials'); // 'credentials' | 'setup_pin' | 'verify_pin'

  const [inputNo, setInputNo] = useState('');
  const [inputClass, setInputClass] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Oturum İçi PIN Değiştirme Modalı State'leri
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [newPinConfirmInput, setNewPinConfirmInput] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // Veri State'leri
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState([]);
  const [activeLoans, setActiveLoans] = useState([]);
  const [completedLoans, setCompletedLoans] = useState([]);
  const [favorites, setFavorites] = useState([]);

  // Filtreleme & Arama
  const [search, setSearch] = useState('');
  const [filterShelf, setFilterShelf] = useState('all');
  const [activeTab, setActiveTab] = useState('catalog');

  // "Bana Kitap Öner" Modal State'i
  const [recommendedBook, setRecommendedBook] = useState(null);
  const [showRecommendModal, setShowRecommendModal] = useState(false);

  // 1. Tarayıcıda Kayıtlı Öğrenci Var mı Kontrol Et
  useEffect(() => {
    const saved = localStorage.getItem('haskoy_student_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id && parsed?.grade_class) {
          fetchStudentProfile(parsed.id);
        }
      } catch (e) {
        localStorage.removeItem('haskoy_student_session');
      }
    }
  }, []);

  // 2. Öğrenci Profilini ve Verilerini Getir (1000 kayıt sınırını aşan döngülü kitap çekimiyle)
  const fetchStudentProfile = async (studentId) => {
    setLoading(true);

    let allBooks = [];
    let step = 1000;
    let from = 0;
    let to = 999;
    let keepFetching = true;

    try {
      while (keepFetching) {
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allBooks = [...allBooks, ...data];
          if (data.length < step) {
            keepFetching = false;
          } else {
            from += step;
            to += step;
          }
        } else {
          keepFetching = false;
        }
      }
    } catch (err) {
      console.error('Öğrenci kataloğu kitaplar yüklenirken hata:', err);
    }

    const [studentRes, loansRes, favRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).single(),
      supabase.from('loans').select('*'),
      supabase.from('student_favorites').select('book_id').eq('student_id', studentId),
    ]);

    if (studentRes.data) {
      setCurrentStudent(studentRes.data);
      localStorage.setItem('haskoy_student_session', JSON.stringify(studentRes.data));
    }

    const rawLoans = loansRes.data || [];
    const favIds = (favRes.data || []).map((f) => f.book_id);
    setFavorites(favIds);

    const isReturned = (status, returnDate) => {
      if (returnDate) return true;
      if (!status) return false;
      const s = String(status).toLowerCase().trim();
      return (s.includes('iade') || s.includes('return') || s.includes('teslim') || s.includes('tamam')) && !s.includes('kayıp');
    };

    const activeLoanBookIds = new Set(
      rawLoans.filter((l) => !isReturned(l.status, l.return_date)).map((l) => String(l.book_id))
    );

    const processedBooks = allBooks.map((b) => ({
      ...b,
      page_count: Number(b.page_count || b.sayfa_sayisi || 0),
      isAvailable: !activeLoanBookIds.has(String(b.id)),
    }));
    setBooks(processedBooks);

    const myRawLoans = rawLoans.filter((l) => String(l.student_id) === String(studentId));

    const myLoans = myRawLoans.map((l) => {
      const foundBook = processedBooks.find((b) => String(b.id) === String(l.book_id));
      return { ...l, book: foundBook || null };
    });

    const currentActive = myLoans.filter((l) => !isReturned(l.status, l.return_date));
    setActiveLoans(currentActive);

    const completed = myLoans.filter((l) => isReturned(l.status, l.return_date));
    setCompletedLoans(completed);

    setLoading(false);
  };

  // 3A. Okul Numarası ve Sınıf/Şube Kontrolü -> PIN Kurulum veya PIN Doğrulama Adımına Geç
  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    const cleanNo = inputNo.trim();
    const cleanClass = normalizeClassValue(inputClass);

    if (!cleanNo || !cleanClass) {
      setLoginError('Lütfen okul numaranızı ve sınıf/şubenizi (örneğin 6A) birlikte girin.');
      return;
    }

    setAuthLoading(true);
    setLoginError('');
    setShowForgotHelp(false);

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('student_number', cleanNo);

    setAuthLoading(false);

    if (error || !data || data.length === 0) {
      setLoginError('Okul numarası veya sınıf/şube bilgisi eşleşmedi. Lütfen kontrol edin.');
      return;
    }

    const matchedStudent = data.find(
      (st) => normalizeClassValue(st.grade_class) === cleanClass
    );

    if (!matchedStudent) {
      setLoginError('Okul numarası ile sınıf/şube bilgisi eşleşmedi. Lütfen kendi sınıf/şubenizi girin.');
      return;
    }

    setPendingStudent(matchedStudent);
    setPinInput('');
    setPinConfirmInput('');
    setFailedAttempts(0);
    setLockUntil(0);

    const existingPin = String(matchedStudent[PIN_COLUMN] ?? '').trim();
    if (isValidFourDigitPin(existingPin)) {
      setAuthStep('verify_pin');
    } else {
      setAuthStep('setup_pin');
    }
  };

  // 3B. İlk Girişte 4 Haneli PIN Belirleme
  const handleSetupPinSubmit = async (e) => {
    e.preventDefault();
    if (!pendingStudent) return;

    const cleanPin = pinInput.trim();
    const cleanConfirm = pinConfirmInput.trim();

    if (!isValidFourDigitPin(cleanPin)) {
      setLoginError('PIN tam olarak 4 rakamdan oluşmalıdır (örneğin 5824).');
      return;
    }
    if (WEAK_PINS.has(cleanPin)) {
      setLoginError('Çok kolay veya ardışık bir PIN seçmeyin (örneğin 1234, 0000).');
      return;
    }
    if (cleanPin !== cleanConfirm) {
      setLoginError('Girdiğiniz iki PIN birbiriyle uyuşmuyor.');
      return;
    }

    setAuthLoading(true);
    setLoginError('');

    const { error } = await supabase
      .from('students')
      .update({ [PIN_COLUMN]: cleanPin })
      .eq('id', pendingStudent.id);

    setAuthLoading(false);

    if (error) {
      setLoginError('PIN kaydedilemedi: ' + error.message);
      return;
    }

    const updatedStudent = { ...pendingStudent, [PIN_COLUMN]: cleanPin };
    setPendingStudent(null);
    setAuthStep('credentials');
    setInputNo('');
    setInputClass('');
    setPinInput('');
    setPinConfirmInput('');
    fetchStudentProfile(updatedStudent.id);
  };

  // 3C. Mevcut 4 Haneli PIN ile Giriş Doğrulama
  const handleVerifyPinSubmit = async (e) => {
    e.preventDefault();
    if (!pendingStudent) return;

    const now = Date.now();
    if (lockUntil > now) {
      const remainingSec = Math.ceil((lockUntil - now) / 1000);
      setLoginError(`Çok fazla hatalı deneme yapıldı. Lütfen ${remainingSec} saniye bekleyin.`);
      return;
    }

    const cleanPin = pinInput.trim();
    if (!isValidFourDigitPin(cleanPin)) {
      setLoginError('Lütfen 4 haneli PIN kodunuzu girin.');
      return;
    }

    const savedPin = String(pendingStudent[PIN_COLUMN] ?? '').trim();
    if (cleanPin !== savedPin) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setPinInput('');

      if (nextAttempts >= 5) {
        setLockUntil(Date.now() + 30000);
        setFailedAttempts(0);
        setLoginError('5 hatalı PIN denemesi yapıldı. 30 saniye sonra tekrar deneyin.');
      } else {
        setLoginError(`PIN hatalı (Kalan deneme hakkı: ${5 - nextAttempts}).`);
      }
      return;
    }

    const verifiedStudent = pendingStudent;
    setPendingStudent(null);
    setAuthStep('credentials');
    setInputNo('');
    setInputClass('');
    setPinInput('');
    setLoginError('');
    setFailedAttempts(0);
    fetchStudentProfile(verifiedStudent.id);
  };

  // 3D. Oturum Açıkken Mevcut PIN ile Yeni PIN Belirleme
  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    if (!currentStudent) return;

    const cleanCurrent = currentPinInput.trim();
    const cleanNew = newPinInput.trim();
    const cleanConfirm = newPinConfirmInput.trim();

    setChangePinError('');
    setChangePinSuccess('');

    const savedPin = String(currentStudent[PIN_COLUMN] ?? '').trim();
    if (cleanCurrent !== savedPin) {
      setChangePinError('Mevcut PIN kodunuz hatalı.');
      return;
    }

    if (!isValidFourDigitPin(cleanNew)) {
      setChangePinError('Yeni PIN tam olarak 4 rakamdan oluşmalıdır.');
      return;
    }

    if (WEAK_PINS.has(cleanNew)) {
      setChangePinError('Çok kolay veya ardışık bir PIN seçmeyin.');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setChangePinError('Yeni PIN ile tekrarı uyuşmuyor.');
      return;
    }

    setSavingPin(true);
    const { error } = await supabase
      .from('students')
      .update({ [PIN_COLUMN]: cleanNew })
      .eq('id', currentStudent.id);
    setSavingPin(false);

    if (error) {
      setChangePinError('PIN güncellenemedi: ' + error.message);
      return;
    }

    const updated = { ...currentStudent, [PIN_COLUMN]: cleanNew };
    setCurrentStudent(updated);
    localStorage.setItem('haskoy_student_session', JSON.stringify(updated));
    setCurrentPinInput('');
    setNewPinInput('');
    setNewPinConfirmInput('');
    setChangePinSuccess('✓ 4 haneli PIN kodunuz başarıyla güncellendi!');
    setTimeout(() => {
      setShowChangePinModal(false);
      setChangePinSuccess('');
    }, 1500);
  };

  // 4. Çıkış Yap
  const handleLogout = () => {
    localStorage.removeItem('haskoy_student_session');
    setCurrentStudent(null);
    setPendingStudent(null);
    setAuthStep('credentials');
    setInputNo('');
    setInputClass('');
    setPinInput('');
    setPinConfirmInput('');
    setLoginError('');
    setShowForgotHelp(false);
    setShowChangePinModal(false);
  };

  // 5. Favoriye Ekle / Çıkar
  const toggleFavorite = async (bookId) => {
    if (!currentStudent) return;

    const isFav = favorites.includes(bookId);
    if (isFav) {
      setFavorites((prev) => prev.filter((id) => id !== bookId));
      await supabase
        .from('student_favorites')
        .delete()
        .eq('student_id', currentStudent.id)
        .eq('book_id', bookId);
    } else {
      setFavorites((prev) => [...prev, bookId]);
      await supabase.from('student_favorites').insert([
        { student_id: currentStudent.id, book_id: bookId },
      ]);
    }
  };

  // 6. ⭐ "Bana Kitap Öner!" Algoritması
  const handleRecommendBook = () => {
    const readBookIds = new Set(completedLoans.map((l) => String(l.book_id)));
    const availableBooks = books.filter(
      (b) => b.isAvailable && !readBookIds.has(String(b.id))
    );

    const pool = availableBooks.length > 0 ? availableBooks : books.filter((b) => b.isAvailable);

    if (pool.length === 0) {
      alert('Şu an kütüphane rafında uygun kitap bulunamadı.');
      return;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    setRecommendedBook(pool[randomIndex]);
    setShowRecommendModal(true);
  };

  const totalReadPages = completedLoans.reduce(
    (acc, curr) => acc + (Number(curr.book?.page_count) || 0),
    0
  );

  const filteredBooks = books.filter((b) => {
    const matchSearch =
      b.title?.toLowerCase().includes(search.toLowerCase()) ||
      b.author?.toLowerCase().includes(search.toLowerCase());
    const matchShelf = filterShelf === 'available' ? b.isAvailable : true;
    return matchSearch && matchShelf;
  });

  // GİRİŞ EKRANI
  if (!currentStudent) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 antialiased selection:bg-indigo-500 selection:text-white">
        <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-7 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-indigo-500/30">
            {authStep === 'setup_pin' ? '🔐' : authStep === 'verify_pin' ? '🔑' : '📖'}
          </div>

          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-indigo-400">
              Hasköy Ortaokulu Kütüphanesi • {currentAcademic.academicYear}
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              {authStep === 'setup_pin'
                ? 'İlk PIN Kodunu Belirle'
                : authStep === 'verify_pin'
                ? '4 Haneli PIN Girişi'
                : 'Öğrenci Okur Portalı'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {authStep === 'setup_pin'
                ? `Merhaba ${pendingStudent?.full_name}, hesabını korumak için 4 haneli bir PIN oluştur.`
                : authStep === 'verify_pin'
                ? `${pendingStudent?.full_name} (${pendingStudent?.grade_class}) için 4 haneli PIN kodunu gir.`
                : 'Kütüphane kataloğunda kitap arayın, elinizdeki iade gününü ve okuma geçmişinizi takip edin.'}
            </p>
          </div>

          {authStep === 'credentials' && (
            <form onSubmit={handleCredentialSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Okul Numaranız
                  </label>
                  <input
                    type="number"
                    placeholder="Örn: 125"
                    value={inputNo}
                    onChange={(e) => setInputNo(e.target.value)}
                    required
                    className="w-full text-base font-bold p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Sınıf / Şube
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 6A"
                    value={inputClass}
                    onChange={(e) => setInputClass(e.target.value)}
                    required
                    className="w-full text-base font-bold p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition uppercase"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {authLoading ? 'Kontrol Ediliyor...' : 'Devam Et →'}
              </button>
            </form>
          )}

          {authStep === 'setup_pin' && (
            <form onSubmit={handleSetupPinSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Yeni PIN (4 Rakam)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    className="w-full text-center text-lg font-black tracking-[0.4em] p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    PIN Tekrarı
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={pinConfirmInput}
                    onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    className="w-full text-center text-lg font-black tracking-[0.4em] p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition font-mono"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  {loginError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep('credentials');
                    setPendingStudent(null);
                    setLoginError('');
                  }}
                  className="px-4 py-3.5 rounded-2xl bg-slate-700/70 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
                >
                  ← Geri
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {authLoading ? 'Kaydediliyor...' : 'PIN Oluştur ve Giriş Yap 🚀'}
                </button>
              </div>
            </form>
          )}

          {authStep === 'verify_pin' && (
            <form onSubmit={handleVerifyPinSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  4 Haneli PIN Kodunuz
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                  className="w-full text-center text-xl font-black tracking-[0.5em] p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition font-mono"
                />
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  {loginError}
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep('credentials');
                    setPendingStudent(null);
                    setLoginError('');
                    setShowForgotHelp(false);
                  }}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  ← Numara / Sınıf Değiştir
                </button>

                <button
                  type="button"
                  onClick={() => setShowForgotHelp((prev) => !prev)}
                  className="text-amber-400 hover:text-amber-300 font-semibold transition cursor-pointer"
                >
                  PIN'imi Unuttum
                </button>
              </div>

              {showForgotHelp && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                  Güvenlik nedeniyle PIN sıfırlama işlemi kendi başınıza yapılamaz. Lütfen{' '}
                  <strong>Kütüphane Rehber Öğretmenine</strong> veya <strong>kütüphane yetkilisine</strong> başvurarak PIN'inizin sıfırlanmasını isteyin.
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {authLoading ? 'Doğrulanıyor...' : 'Kitaplığıma Giriş Yap 🚀'}
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-slate-700/60">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
              ← Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ÖĞRENCİ ANA PANELİ
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 antialiased">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xl shadow-2xs shrink-0">
              {currentStudent.gender === 'kiz' ? '👧' : currentStudent.gender === 'erkek' ? '👦' : '🎓'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900">{currentStudent.full_name}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {currentStudent.grade_class}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">No: {currentStudent.student_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRecommendBook}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>⭐</span>
              <span className="hidden sm:inline">Bana Kitap Öner</span>
            </button>

            <button
              onClick={() => {
                setChangePinError('');
                setChangePinSuccess('');
                setCurrentPinInput('');
                setNewPinInput('');
                setNewPinConfirmInput('');
                setShowChangePinModal(true);
              }}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              🔑 <span className="hidden sm:inline">PIN Değiştir</span>
            </button>

            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Şu An Elimde</span>
            <p className="text-2xl font-black text-blue-600 mt-1">{activeLoans.length} Kitap</p>
            <span className="text-[11px] text-slate-500">Okumakta olduğun</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bitirdiğim Kitap</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{completedLoans.length} Kitap</p>
            <span className="text-[11px] text-emerald-600">Başarıyla iade edilen</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white shadow-2xs">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
              <span>📄</span> Toplam Sayfam
            </span>
            <p className="text-2xl font-black text-amber-600 mt-1 font-mono">
              {totalReadPages.toLocaleString('tr-TR')} sf.
            </p>
            <span className="text-[11px] text-amber-700">Devirdiğin toplam sayfa</span>
          </div>
        </div>

        {activeLoans.length > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⏳</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-100">
                Şu An Elindeki Kitap(lar) & İade Takibi
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeLoans.map((al) => (
                <div key={al.id} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4">
                  {al.book?.cover_url ? (
                    <img src={al.book.cover_url} alt="" className="w-12 h-16 object-cover rounded-xl shadow-md shrink-0" />
                  ) : (
                    <div className="w-12 h-16 bg-white/20 rounded-xl flex items-center justify-center text-2xl shrink-0">
                      📖
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-white truncate">{al.book?.title}</h3>
                    <p className="text-xs text-blue-200 truncate">{al.book?.author}</p>
                    <div className="mt-2 text-[11px] font-medium bg-white/20 px-2.5 py-1 rounded-lg inline-block">
                      Alış Tarihi: <strong>{al.loan_date || '-'}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            📚 Kitap Kataloğu ({books.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            📜 Okuma Geçmişim ({completedLoans.length})
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            ❤️ Favorilerim ({favorites.length})
          </button>
        </div>

        {activeTab === 'catalog' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Kitap veya yazar ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setFilterShelf('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filterShelf === 'all' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setFilterShelf('available')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filterShelf === 'available' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  🟢 Sadece Raftakiler
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredBooks.map((b) => {
                const isFav = favorites.includes(b.id);
                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between group hover:shadow-md transition relative"
                  >
                    <button
                      onClick={() => toggleFavorite(b.id)}
                      className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm transition shadow-2xs cursor-pointer ${
                        isFav ? 'bg-rose-50 text-rose-500' : 'bg-slate-100/80 text-slate-400 hover:text-rose-500'
                      }`}
                    >
                      {isFav ? '❤️' : '🤍'}
                    </button>

                    <div>
                      {b.cover_url ? (
                        <img
                          src={b.cover_url}
                          alt=""
                          className="w-full h-44 object-cover rounded-2xl mb-3 shadow-inner"
                        />
                      ) : (
                        <div className="w-full h-44 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl mb-3 text-slate-300">
                          📖
                        </div>
                      )}

                      <h3 className="font-bold text-xs text-slate-900 truncate" title={b.title}>
                        {b.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{b.author}</p>
                      {b.page_count > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          {b.page_count} sayfa
                        </span>
                      )}
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
                      {b.isAvailable ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Rafta
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                          Emanette
                        </span>
                      )}

                      {b.shelf_location && (
                        <span className="text-[9px] font-mono text-slate-400">
                          📍 {b.shelf_location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Tamamladığın Kitaplar</h3>
            {completedLoans.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">Henüz iade edilmiş kitap kaydınız yok.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {completedLoans.map((cl) => (
                  <div key={cl.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {cl.book?.cover_url ? (
                        <img src={cl.book.cover_url} alt="" className="w-10 h-14 object-cover rounded-xl border shadow-2xs shrink-0" />
                      ) : (
                        <div className="w-10 h-14 bg-slate-100 rounded-xl border flex items-center justify-center text-xs shrink-0">
                          📖
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{cl.book?.title || 'Kitap Adı Bulunamadı'}</h4>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{cl.book?.author || 'Yazar belirtilmemiş'}</p>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          İade Tarihi: {cl.return_date || cl.due_date || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 block">
                        ✓ Tamamlandı
                      </span>
                      {cl.book?.page_count > 0 && (
                        <span className="text-[11px] text-amber-600 font-black font-mono block mt-1">
                          +{cl.book.page_count} sf.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Okumak İstediğin Favori Kitaplar</h3>
            {favorites.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
                Henüz favorilerine kitap eklemedin. Katalogdan ❤️ butonuna basarak ekleyebilirsin!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {books
                  .filter((b) => favorites.includes(b.id))
                  .map((b) => (
                    <div key={b.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-2 relative">
                      <button
                        onClick={() => toggleFavorite(b.id)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-sm transition shadow-2xs cursor-pointer"
                      >
                        ❤️
                      </button>
                      {b.cover_url ? (
                        <img src={b.cover_url} alt="" className="w-full h-36 object-cover rounded-2xl mb-2" />
                      ) : (
                        <div className="w-full h-36 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl mb-2">📖</div>
                      )}
                      <h4 className="font-bold text-xs text-slate-900 truncate">{b.title}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{b.author}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* PIN DEĞİŞTİRME MODALI */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">4 Haneli PIN Kodunu Değiştir</h3>
              <button
                type="button"
                onClick={() => setShowChangePinModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePinSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Mevcut PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                  className="w-full text-center text-base font-black tracking-[0.4em] p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Yeni PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    className="w-full text-center text-base font-black tracking-[0.4em] p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Yeni PIN Tekrar</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={newPinConfirmInput}
                    onChange={(e) => setNewPinConfirmInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    className="w-full text-center text-base font-black tracking-[0.4em] p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-mono"
                  />
                </div>
              </div>

              {changePinError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {changePinError}
                </div>
              )}

              {changePinSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  {changePinSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingPin}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                >
                  {savingPin ? 'Kaydediliyor...' : 'PIN Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRecommendModal && recommendedBook && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <span className="text-4xl block animate-bounce">🎁</span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                Kütüphanenin Sana Özel Önerisi
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1">{recommendedBook.title}</h3>
              <p className="text-xs text-slate-500">{recommendedBook.author}</p>
            </div>

            {recommendedBook.cover_url && (
              <img
                src={recommendedBook.cover_url}
                alt=""
                className="w-24 h-36 object-cover rounded-xl mx-auto shadow-md border"
              />
            )}

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
              ✓ Şu an kütüphane rafında boşta duruyor, teneffüste gidip alabilirsin!
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleRecommendBook}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                🔄 Başka Öner
              </button>
              <button
                onClick={() => setShowRecommendModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}