'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getAcademicInfo, matchesPeriod } from '@/lib/academic';

const DEFAULT_QUOTES = [
  { text: 'Kitapsız yaşamak; kör, sağır ve dilsiz yaşamaktır.', author: 'Seneca' },
  { text: 'Hayatta en hakiki mürşit ilimdir, fendir.', author: 'Mustafa Kemal Atatürk' },
  { text: 'Bir kitap, içimizdeki donmuş denizi parçalayacak bir balta olmalıdır.', author: 'Franz Kafka' },
  { text: 'Okumak bir insanı doldurur, konuşmak hazırlar, yazmak ise olgunlaştırır.', author: 'Francis Bacon' },
  { text: 'Kitaplar hiç solmayan çiçeklerdir.', author: 'Hasan Ali Yücel' },
];

const AUTHORS_OF_THE_WEEK = [
  {
    name: 'Ömer Seyfettin',
    era: 'Türk Edebiyatı / Hikaye',
    desc: 'Milli edebiyat akımının öncülerinden; Kaşağı, Diyet ve Falaka gibi unutulmaz hikayelerin yazarı.',
    icon: '✍️',
  },
  {
    name: 'Jules Verne',
    era: 'Dünya Klasikleri / Bilim Kurgu',
    desc: 'Hayal gücünün sınırlarını zorlayan; Denizler Altında 20.000 Fersah ve 80 Günde Devri Alem ustası.',
    icon: '🚀',
  },
  {
    name: 'Rıfat Ilgaz',
    era: 'Türk Edebiyatı / Mizah & Roman',
    desc: 'Hababam Sınıfı, Karartma Geceleri ve Halime Kaptan gibi toplumcu gerçekçi eserlerin mimarı.',
    icon: '📚',
  },
];

const LIBRARY_TIPS = [
  { title: 'Sessizlik Kuralı', text: 'Kütüphanemizde fısıltıyla konuşarak okuyan arkadaşlarımızın dikkatini koruyalım.', icon: '🤫' },
  { title: 'Emanet Süresi 15 Gün', text: 'Aldığınız kitapları 15 gün içinde iade ederek diğer arkadaşlarınıza da okuma fırsatı verin.', icon: '📅' },
  { title: 'Kitap Ayracı Kullanımı', text: 'Sayfa köşelerini katlamak yerine kitap ayracı kullanarak eserleri temiz tutalım.', icon: '🔖' },
];

const DEFAULT_SLOTS = [
  { id: 'slot1', name: '1. Teneffüs', start: '09:10', end: '09:25' },
  { id: 'slot2', name: '2. Teneffüs', start: '10:05', end: '10:20' },
  { id: 'slot3', name: '3. Teneffüs', start: '11:00', end: '11:15' },
  { id: 'slot4', name: '4. Teneffüs', start: '11:55', end: '12:10' },
  { id: 'slot5', name: 'Öğle Arası', start: '12:50', end: '13:25' },
  { id: 'slot6', name: '5. Teneffüs', start: '14:05', end: '14:20' },
];

// WMO Hava Durumu Kodu Çözümleyici & Kütüphane Mesajları
const getWeatherDetails = (code) => {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return {
      icon: '🌧️',
      desc: 'Yağmurlu',
      note: 'Dışarıda yağmur var; sıcak bir kütüphane köşesinde kitap okumak için harika bir gün!',
    };
  }
  if ([71, 73, 75, 85, 86].includes(code)) {
    return {
      icon: '❄️',
      desc: 'Karlı',
      note: 'Canik beyaza büründü! Kütüphanemizin sıcacık ortamında yeni dünyalar keşfet.',
    };
  }
  if ([1, 2, 3, 45, 48].includes(code)) {
    return {
      icon: '⛅',
      desc: 'Parçalı Bulutlu',
      note: 'Huzurlu bir kütüphane havası; teneffüste yeni bir hikayeye başlamaya ne dersin?',
    };
  }
  return {
    icon: '☀️',
    desc: 'Açık / Güneşli',
    note: 'Güneşli ve aydınlık bir gün! Zihnini dinlendirecek harika bir kitap seç.',
  };
};

export default function LibraryKioskPage() {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [currentMonthName, setCurrentMonthName] = useState('');
  const [currentDayKey, setCurrentDayKey] = useState('wednesday');
  const [currentDayName, setCurrentDayName] = useState('Çarşamba');
  const [qrOrigin, setQrOrigin] = useState('');

  // Canik / Samsun Hava Durumu
  const [weather, setWeather] = useState({
    temp: null,
    icon: '🌤️',
    desc: 'Hava durumu alınıyor...',
    note: 'Kitap okumak için harika bir gün!',
  });

  const [stats, setStats] = useState({
    totalBooks: 0,
    totalStudents: 0,
    monthlyRead: 0,
    termRead: 0,
    totalMonthlyPages: 0,
    totalTermPages: 0,
  });

  const [termGoal, setTermGoal] = useState(500);
  const [termPageGoal, setTermPageGoal] = useState(100000);
  const [quotes, setQuotes] = useState(DEFAULT_QUOTES);

  // Çizelge
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [scheduleData, setScheduleData] = useState({});
  const [activeSlotInfo, setActiveSlotInfo] = useState(null);

  // Sıralama Verileri
  const [bookPodium, setBookPodium] = useState([]);
  const [pagePodium, setPagePodium] = useState([]);
  const [classBookPodium, setClassBookPodium] = useState([]);
  const [classPagePodium, setClassPagePodium] = useState([]);

  const [recommendedBooks, setRecommendedBooks] = useState([]);
  const [latestActivity, setLatestActivity] = useState(null);

  // Sağ Alt Kültür Vitrini Döngüsü
  const [cultureMode, setCultureMode] = useState('book');
  const [currentRecIndex, setCurrentRecIndex] = useState(0);

  // Alt Bant Döngüsü: Günün Sözü ⇄ Hava Durumu
  const [bottomTickerMode, setBottomTickerMode] = useState('quote');
  const [quoteIndex, setQuoteIndex] = useState(0);

  const academic = getAcademicInfo();

  // Dinamik Origin URL'sini al
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setQrOrigin(window.location.origin);
    }
  }, []);

  // Saat & Teneffüs Güncelleme
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
      setCurrentMonthName(now.toLocaleDateString('tr-TR', { month: 'long' }));

      const dayIndex = now.getDay();
      const dayMap = {
        1: { key: 'monday', name: 'Pazartesi' },
        2: { key: 'tuesday', name: 'Salı' },
        3: { key: 'wednesday', name: 'Çarşamba' },
        4: { key: 'thursday', name: 'Perşembe' },
        5: { key: 'friday', name: 'Cuma' },
      };

      const matchedDay = dayMap[dayIndex] || { key: 'monday', name: 'Pazartesi' };
      setCurrentDayKey(matchedDay.key);
      setCurrentDayName(matchedDay.name);

      const curHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      let activeFound = null;

      slots.forEach((s) => {
        if (curHourMin >= s.start && curHourMin <= s.end) {
          activeFound = { ...s, isNow: true };
        }
      });

      if (!activeFound) {
        const upcoming = slots.find((s) => s.start > curHourMin);
        if (upcoming) activeFound = { ...upcoming, isNow: false };
      }

      setActiveSlotInfo(activeFound);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [slots]);

  // Canik / Samsun Canlı Hava Durumu Çekimi (Open-Meteo)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=41.28&longitude=36.35&current=temperature_2m,weather_code&timezone=auto'
        );
        const data = await res.json();
        if (data?.current) {
          const temp = Math.round(data.current.temperature_2m);
          const code = data.current.weather_code;
          const details = getWeatherDetails(code);
          setWeather({
            temp,
            icon: details.icon,
            desc: details.desc,
            note: details.note,
          });
        }
      } catch (err) {
        console.error('Hava durumu alınamadı:', err);
      }
    };

    fetchWeather();
    const weatherTimer = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(weatherTimer);
  }, []);

  // Alt Bant Döngüsü: Günün Sözü ⇄ Hava Durumu (10 Saniyede Bir)
  useEffect(() => {
    const tickerTimer = setInterval(() => {
      setBottomTickerMode((prev) => {
        if (prev === 'quote') {
          return 'weather';
        }
        setQuoteIndex((q) => (q + 1) % (quotes.length || 1));
        return 'quote';
      });
    }, 10000);
    return () => clearInterval(tickerTimer);
  }, [quotes.length]);

  // Sağ Alt Vitrini Döndür (Kitap ⇄ Yazar ⇄ Kural)
  useEffect(() => {
    const carouselTimer = setInterval(() => {
      setCultureMode((prev) => {
        if (prev === 'book') return 'author';
        if (prev === 'author') return 'tip';
        return 'book';
      });
      setCurrentRecIndex((prev) => (prev + 1) % (recommendedBooks.length || 1));
    }, 8000);
    return () => clearInterval(carouselTimer);
  }, [recommendedBooks.length]);

  // Supabase Verilerini Yükleme
  const loadKioskData = async () => {
    try {
      const [booksRes, studentsRes, loansRes, goalRes, pageGoalRes, quotesRes, scheduleRes] = await Promise.all([
        supabase.from('books').select('*').order('id', { ascending: false }),
        supabase.from('students').select('*'),
        supabase.from('loans').select(`
          id, student_id, book_id, return_date, loan_date, status,
          books:book_id ( id, title, author, cover_url, page_count )
        `).order('id', { ascending: false }),
        supabase.from('settings').select('value').eq('id', 'term_goal').maybeSingle(),
        supabase.from('settings').select('value').eq('id', 'term_page_goal').maybeSingle(),
        supabase.from('settings').select('value').eq('id', 'kiosk_quotes').maybeSingle(),
        supabase.from('settings').select('value').eq('id', 'library_schedule').maybeSingle(),
      ]);

      if (goalRes.data?.value) {
        const parsed = parseInt(goalRes.data.value, 10);
        if (!isNaN(parsed) && parsed > 0) setTermGoal(parsed);
      }

      if (pageGoalRes.data?.value) {
        const parsedPages = parseInt(pageGoalRes.data.value, 10);
        if (!isNaN(parsedPages) && parsedPages > 0) setTermPageGoal(parsedPages);
      }

      if (quotesRes.data?.value) {
        try {
          const parsedQuotes = JSON.parse(quotesRes.data.value);
          if (Array.isArray(parsedQuotes) && parsedQuotes.length > 0) setQuotes(parsedQuotes);
        } catch (e) {
          console.error(e);
        }
      }

      if (scheduleRes.data?.value) {
        try {
          const parsedSch = JSON.parse(scheduleRes.data.value);
          if (parsedSch.slots && Array.isArray(parsedSch.slots)) setSlots(parsedSch.slots);
          if (parsedSch.schedule) setScheduleData(parsedSch.schedule);
        } catch (e) {
          console.error('Çizelge parse hatası:', e);
        }
      }

      const books = booksRes.data || [];
      const students = studentsRes.data || [];
      const loans = loansRes.data || [];

      const isReturned = (status) => {
        if (!status) return false;
        const s = String(status).toLowerCase();
        return (s.includes('iade') || s.includes('return')) && !s.includes('kayıp');
      };

      const monthlyCompleted = loans.filter((l) => isReturned(l.status) && matchesPeriod(l.return_date || l.loan_date, 'month'));
      const termCompleted = loans.filter((l) => isReturned(l.status) && matchesPeriod(l.return_date || l.loan_date, 'term'));
      const displayLoans = monthlyCompleted.length > 0 ? monthlyCompleted : termCompleted;

      const studentStats = {};
      const classStats = {};
      let totalMonthlyPages = 0;
      let totalTermPages = 0;

      monthlyCompleted.forEach((l) => {
        totalMonthlyPages += Number(l.books?.page_count) || 0;
      });

      termCompleted.forEach((l) => {
        totalTermPages += Number(l.books?.page_count) || 0;
      });

      displayLoans.forEach((l) => {
        const sId = l.student_id;
        const pages = Number(l.books?.page_count) || 0;

        if (!studentStats[sId]) {
          studentStats[sId] = { bookCount: 0, pageCount: 0 };
        }
        studentStats[sId].bookCount += 1;
        studentStats[sId].pageCount += pages;

        const st = students.find((s) => String(s.id) === String(sId));
        const grade = (st?.grade_class || st?.sinif || '')?.trim();
        if (grade) {
          if (!classStats[grade]) {
            classStats[grade] = { bookCount: 0, pageCount: 0 };
          }
          classStats[grade].bookCount += 1;
          classStats[grade].pageCount += pages;
        }
      });

      // Bireysel Sıralamalar
      const topStudentsByBooks = Object.entries(studentStats)
        .map(([sId, data]) => {
          const st = students.find((s) => String(s.id) === String(sId));
          return {
            id: sId,
            name: st?.full_name || st?.ad_soyad || 'Öğrenci',
            grade: st?.grade_class || st?.sinif || '-',
            gender: st?.gender || st?.cinsiyet || 'belirtilmedi',
            photo_url: st?.photo_url,
            bookCount: data.bookCount,
            pageCount: data.pageCount,
          };
        })
        .sort((a, b) => b.bookCount - a.bookCount || b.pageCount - a.pageCount)
        .slice(0, 3);

      const topStudentsByPages = Object.entries(studentStats)
        .map(([sId, data]) => {
          const st = students.find((s) => String(s.id) === String(sId));
          return {
            id: sId,
            name: st?.full_name || st?.ad_soyad || 'Öğrenci',
            grade: st?.grade_class || st?.sinif || '-',
            gender: st?.gender || st?.cinsiyet || 'belirtilmedi',
            photo_url: st?.photo_url,
            bookCount: data.bookCount,
            pageCount: data.pageCount,
          };
        })
        .sort((a, b) => b.pageCount - a.pageCount || b.bookCount - a.bookCount)
        .slice(0, 3);

      // Sınıf Sıralamaları
      const topClassesByBooks = Object.entries(classStats)
        .map(([grade, data]) => ({ grade, bookCount: data.bookCount, pageCount: data.pageCount }))
        .sort((a, b) => b.bookCount - a.bookCount || b.pageCount - a.pageCount)
        .slice(0, 3);

      const topClassesByPages = Object.entries(classStats)
        .map(([grade, data]) => ({ grade, bookCount: data.bookCount, pageCount: data.pageCount }))
        .sort((a, b) => b.pageCount - a.pageCount || b.bookCount - a.bookCount)
        .slice(0, 3);

      setBookPodium(topStudentsByBooks);
      setPagePodium(topStudentsByPages);
      setClassBookPodium(topClassesByBooks);
      setClassPagePodium(topClassesByPages);
      setRecommendedBooks(books.slice(0, 6));

      if (loans.length > 0) {
        const lastLoan = loans[0];
        const st = students.find((s) => String(s.id) === String(lastLoan.student_id));
        const bk = books.find((b) => String(b.id) === String(lastLoan.book_id));
        if (st && bk) {
          setLatestActivity({
            studentName: st.full_name || st.ad_soyad,
            bookTitle: bk.title,
            status: isReturned(lastLoan.status) ? 'iade etti' : 'ödünç aldı',
          });
        }
      }

      setStats({
        totalBooks: books.length,
        totalStudents: students.length,
        monthlyRead: monthlyCompleted.length,
        termRead: termCompleted.length,
        totalMonthlyPages,
        totalTermPages,
      });
    } catch (err) {
      console.error('Kiosk Veri Hatası:', err);
    }
  };

  useEffect(() => {
    loadKioskData();
    const interval = setInterval(loadKioskData, 25000);
    return () => clearInterval(interval);
  }, []);

  const activeRecBook = recommendedBooks[currentRecIndex];
  const activeAuthor = AUTHORS_OF_THE_WEEK[currentRecIndex % AUTHORS_OF_THE_WEEK.length];
  const activeTip = LIBRARY_TIPS[currentRecIndex % LIBRARY_TIPS.length];
  const currentQuote = quotes[quoteIndex % (quotes.length || 1)] || DEFAULT_QUOTES[0];

  const bookGoalPercent = Math.min(100, Math.round((stats.termRead / (termGoal || 1)) * 100));
  const pageGoalPercent = Math.min(100, Math.round((stats.totalTermPages / (termPageGoal || 1)) * 100));

  const todaysSchedule = scheduleData[currentDayKey] || {};
  const studentPortalUrl = `${qrOrigin || 'https://haskoykutuphane.meb.k12.tr'}/ogrenci`;

  return (
    <div className="h-screen w-screen bg-slate-950 text-white flex flex-col justify-between p-3 select-none overflow-hidden relative font-sans">
      {/* Atmosfer Işıkları */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* 1. ÜST HEADER */}
      <header className="grid grid-cols-1 lg:grid-cols-12 items-center gap-3 pb-2 border-b border-slate-800/80 z-20 shrink-0">
        
        {/* SOL: LOGO & BAŞLIK */}
        <div className="lg:col-span-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-xl shadow-blue-500/20 ring-1 ring-white/20 shrink-0">
            <div className="w-full h-full bg-slate-950/80 rounded-[14px] flex items-center justify-center font-black text-xl text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-cyan-300">
              H
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Canik / Samsun • Canlı TV Panosu
              </span>
            </div>
            <h1 className="text-lg lg:text-xl font-black text-white tracking-tight truncate">
              Hasköy Ortaokulu Kütüphanesi
            </h1>
          </div>
        </div>

        {/* ORTA: CANLI HAREKET BİLDİRİMİ */}
        <div className="lg:col-span-4 flex justify-center">
          {latestActivity ? (
            <div className="w-full max-w-md bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-indigo-950/80 border border-blue-500/30 rounded-2xl p-2 px-3 shadow-xl shadow-blue-950/40 backdrop-blur-xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center text-base shrink-0 shadow-inner">
                ⚡
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.2 rounded">
                    Canlı Hareket
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Az önce</span>
                </div>
                <p className="text-xs text-slate-200 truncate mt-0.5">
                  <strong className="text-white font-black">{latestActivity.studentName}</strong>,{' '}
                  <span className="text-blue-300 font-medium">"{latestActivity.bookTitle}"</span> eserini{' '}
                  <span className={latestActivity.status.includes('iade') ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {latestActivity.status}
                  </span>
                  !
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-medium italic py-1.5">
              Kütüphanede yeni işlem bekleniyor...
            </div>
          )}
        </div>

        {/* SAĞ: ZAMAN & CANİK CANLI HAVA DURUMU WIDGET'I */}
        <div className="lg:col-span-4 flex justify-end">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-1.5 pl-3 flex items-center gap-2.5 shadow-xl">
            {/* Canik Canlı Hava Rozeti */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2 py-1 rounded-xl">
              <span className="text-base">{weather.icon}</span>
              <div className="text-left leading-none">
                <span className="text-xs font-black text-white font-mono">
                  {weather.temp !== null ? `${weather.temp}°C` : '--°C'}
                </span>
                <span className="text-[8px] text-slate-400 block font-medium mt-0.5">Canik</span>
              </div>
            </div>

            {/* Tarih ve Dönem */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 mb-0.5">
                <span className="text-[10px] font-extrabold text-blue-400 bg-blue-950/80 border border-blue-500/30 px-1.5 py-0.2 rounded uppercase tracking-wider">
                  {currentMonthName ? `${currentMonthName}` : 'Bu Ay'}
                </span>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded">
                  {academic.academicYear}
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-semibold capitalize tracking-tight">
                {currentDate}
              </p>
            </div>

            {/* Dijital Saat */}
            <div className="h-10 px-2.5 bg-slate-950/90 border border-slate-800 rounded-xl flex items-center justify-center font-mono text-lg font-black text-emerald-400 tracking-wider shadow-inner">
              {currentTime || '00:00:00'}
            </div>
          </div>
        </div>

      </header>

      {/* 2. DÖNEMLİK KİTAP & SAYFA SEFERBERLİĞİ BARLARI */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-2.5 my-1.5 z-10 shadow-2xl shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
          
          {/* Kitap Hedefi */}
          <div className="flex flex-col justify-between gap-1.5 lg:pr-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm p-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">🎯</span>
                <div>
                  <h3 className="text-xs font-black text-white tracking-tight">Dönemlik Kitap Hedefi</h3>
                  <p className="text-[10px] text-slate-400">Okulumuzun toplam okunan eser hedefi</p>
                </div>
              </div>
              <div className="text-right flex items-baseline gap-1.5">
                <span className="font-mono font-black text-sm text-blue-400">{stats.termRead}</span>
                <span className="font-mono text-xs text-slate-500">/ {termGoal}</span>
                <span className="text-[10px] font-black text-blue-300 bg-blue-950/80 border border-blue-500/30 px-2 py-0.5 rounded-md ml-1">
                  %{bookGoalPercent}
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-xl h-3.5 p-0.5 border border-slate-800/90 shadow-inner overflow-hidden relative">
              <div
                className="bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 h-full rounded-lg transition-all duration-1000 relative shadow-lg shadow-blue-500/30"
                style={{ width: `${Math.max(bookGoalPercent, 2)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Sayfa Rekoru */}
          <div className="flex flex-col justify-between gap-1.5 pt-2 lg:pt-0 lg:pl-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">🚀</span>
                <div>
                  <h3 className="text-xs font-black text-white tracking-tight">Dönemlik Sayfa Rekoru</h3>
                  <p className="text-[10px] text-slate-400">Hasköy Ortaokulu toplam sayfa seferberliği</p>
                </div>
              </div>
              <div className="text-right flex items-baseline gap-1.5">
                <span className="font-mono font-black text-sm text-amber-400">{stats.totalTermPages.toLocaleString('tr-TR')}</span>
                <span className="font-mono text-xs text-slate-500">/ {termPageGoal.toLocaleString('tr-TR')} sf.</span>
                <span className="text-[10px] font-black text-amber-300 bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 rounded-md ml-1">
                  %{pageGoalPercent}
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-xl h-3.5 p-0.5 border border-slate-800/90 shadow-inner overflow-hidden relative">
              <div
                className="bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400 h-full rounded-lg transition-all duration-1000 relative shadow-lg shadow-amber-500/30"
                style={{ width: `${Math.max(pageGoalPercent, 2)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. ORTA BÖLÜM: 3 SÜTUN DA KUSURSUZ %50 - %50 EŞİT BÖLÜNMÜŞ (TAM SİMETRİ) */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 my-1 z-10">
        
        {/* SOL SÜTUN (4 KOLON): 1. KİTAP KURTLARI + 2. SAYFA ŞAMPİYONLARI */}
        <div className="lg:col-span-4 grid grid-rows-2 gap-3 h-full min-h-0">
          
          {/* 1A: AYIN KİTAP KURTLARI */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-3 flex flex-col justify-between shadow-xl min-h-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🏆</span>
                <h2 className="text-xs font-black text-white tracking-tight">Ayın Kitap Kurtları</h2>
              </div>
              <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full uppercase">
                Kitap Sıralaması
              </span>
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col justify-center min-h-0 py-1">
              {bookPodium.length === 0 ? (
                <p className="text-center text-xs text-slate-500">Okur verisi bekleniyor...</p>
              ) : (
                bookPodium.map((st, idx) => (
                  <div
                    key={st.id || idx}
                    className={`p-2 rounded-2xl border flex items-center justify-between transition ${
                      idx === 0
                        ? 'bg-gradient-to-r from-amber-500/20 to-slate-900/50 border-amber-400/40 shadow-sm'
                        : idx === 1
                        ? 'bg-slate-850/60 border-slate-400/30'
                        : 'bg-slate-900/50 border-amber-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-white truncate">{st.name}</h4>
                        <span className="text-[10px] text-indigo-400 font-bold">{st.grade}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-xs text-amber-400 block">{st.bookCount} Kitap</span>
                      <span className="text-[9px] text-slate-400 font-medium">{st.pageCount} sf.</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 1B: SAYFA ŞAMPİYONLARI */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-3 flex flex-col justify-between shadow-xl min-h-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base">📄</span>
                <h2 className="text-xs font-black text-white tracking-tight">Sayfa Şampiyonları</h2>
              </div>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full uppercase">
                Sayfa Sıralaması
              </span>
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col justify-center min-h-0 py-1">
              {pagePodium.length === 0 ? (
                <p className="text-center text-xs text-slate-500">Okur verisi bekleniyor...</p>
              ) : (
                pagePodium.map((st, idx) => (
                  <div
                    key={st.id || idx}
                    className={`p-2 rounded-2xl border flex items-center justify-between transition ${
                      idx === 0
                        ? 'bg-gradient-to-r from-emerald-500/20 to-slate-900/50 border-emerald-400/40 shadow-sm'
                        : idx === 1
                        ? 'bg-slate-850/60 border-slate-400/30'
                        : 'bg-slate-900/50 border-amber-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">{idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}</span>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-white truncate">{st.name}</h4>
                        <span className="text-[10px] text-emerald-400 font-bold">{st.grade}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-xs text-emerald-400 block">{st.pageCount.toLocaleString('tr-TR')} sf.</span>
                      <span className="text-[9px] text-slate-400 font-medium">{st.bookCount} Kitap</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ORTA SÜTUN (4 KOLON): 1. SINIFLAR (KİTAP) + 2. SINIFLAR (SAYFA) */}
        <div className="lg:col-span-4 grid grid-rows-2 gap-3 h-full min-h-0">
          
          {/* 2A: LİDER SINIFLAR (KİTAP LİGİ) */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-3 flex flex-col justify-between shadow-xl min-h-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 text-white flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2c-.6 1.4-1.5 2.5-1.5 3.5 0 1.1.9 2 2 2s2-.9 2-2c0-1-.9-2.1-1.5-3.5h-1zM4 19.5c0-.8.7-1.5 1.5-1.5H11v-9.5c-1.5-.7-3.4-1-5.5-1-2.4 0-4.5.5-5.5 1v11.3c0 .4.3.7.7.7.3 0 .6-.1.8-.3 1.1-.5 2.6-.7 4-.7zm16 0c1.4 0 2.9.2 4 .7.2.2.5.3.8.3.4 0 .7-.3.7-.7V7.5c-1-.5-3.1-1-5.5-1-2.1 0-4 .3-5.5 1V18h5.5c.8 0 1.5.7 1.5 1.5z" />
                  </svg>
                </div>
                <h3 className="text-xs font-black text-white tracking-tight">Lider Sınıflar (Kitap)</h3>
              </div>
              <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Şube Kitap
              </span>
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col justify-center min-h-0 py-1">
              {classBookPodium.length === 0 ? (
                <p className="text-center text-xs text-slate-500">Sınıf verisi oluşuyor...</p>
              ) : (
                classBookPodium.map((cls, idx) => (
                  <div key={cls.grade} className="p-2 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] ${idx === 0 ? 'bg-amber-400 text-amber-950' : 'bg-slate-700 text-white'}`}>
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-xs text-white">{cls.grade} Sınıfı</h4>
                    </div>
                    <span className="font-mono font-black text-xs text-amber-400">{cls.bookCount} Kitap</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2B: LİDER SINIFLAR (SAYFA LİGİ) */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-3 flex flex-col justify-between shadow-xl min-h-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2c-.6 1.4-1.5 2.5-1.5 3.5 0 1.1.9 2 2 2s2-.9 2-2c0-1-.9-2.1-1.5-3.5h-1zM4 19.5c0-.8.7-1.5 1.5-1.5H11v-9.5c-1.5-.7-3.4-1-5.5-1-2.4 0-4.5.5-5.5 1v11.3c0 .4.3.7.7.7.3 0 .6-.1.8-.3 1.1-.5 2.6-.7 4-.7zm16 0c1.4 0 2.9.2 4 .7.2.2.5.3.8.3.4 0 .7-.3.7-.7V7.5c-1-.5-3.1-1-5.5-1-2.1 0-4 .3-5.5 1V18h5.5c.8 0 1.5.7 1.5 1.5z" />
                  </svg>
                </div>
                <h3 className="text-xs font-black text-white tracking-tight">Lider Sınıflar (Sayfa)</h3>
              </div>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Şube Sayfa
              </span>
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col justify-center min-h-0 py-1">
              {classPagePodium.length === 0 ? (
                <p className="text-center text-xs text-slate-500">Sınıf verisi oluşuyor...</p>
              ) : (
                classPagePodium.map((cls, idx) => (
                  <div key={cls.grade} className="p-2 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] ${idx === 0 ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-700 text-white'}`}>
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-xs text-white">{cls.grade} Sınıfı</h4>
                    </div>
                    <span className="font-mono font-black text-xs text-emerald-400">{cls.pageCount.toLocaleString('tr-TR')} sf.</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* SAĞ SÜTUN (4 KOLON): TENEFFÜS PROGRAMI + KÜLTÜR VİTRİNİ & ÖĞRENCİ PORTALI QR KODU */}
        <div className="lg:col-span-4 grid grid-rows-2 gap-3 h-full min-h-0">
          
          {/* 3A: SAĞ ÜST KUTU: GÜNÜN TENEFFÜS PROGRAMI */}
          <div className="bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-blue-950/70 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-3 flex flex-col justify-between shadow-xl min-h-0 overflow-hidden">
            <div className="flex items-center justify-between pb-1 border-b border-indigo-500/20 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📅</span>
                <h3 className="text-xs font-black text-white tracking-tight">
                  {currentDayName} Kütüphane Teneffüs Programı
                </h3>
              </div>
              <span className="text-[9px] font-extrabold text-cyan-300 bg-cyan-950/90 border border-cyan-500/40 px-2 py-0.2 rounded-full uppercase">
                Bugün
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-between py-1 min-h-0 gap-0.5">
              {slots.map((s) => {
                const assigned = todaysSchedule[s.id];
                const isCurrent = activeSlotInfo?.id === s.id && activeSlotInfo?.isNow;
                return (
                  <div
                    key={s.id}
                    className={`px-2 py-0.5 rounded-lg border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-emerald-950/90 border-emerald-500/70 text-white shadow-xs'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isCurrent ? 'bg-emerald-400 animate-ping' : 'bg-indigo-400'
                        }`}
                      ></span>
                      <span className="text-[10px] font-bold text-slate-300 shrink-0">
                        {s.name}:
                      </span>
                      <span
                        className={`truncate text-xs font-black px-1.5 py-0.2 rounded ${
                          isCurrent
                            ? 'text-emerald-300 bg-emerald-900/50 border border-emerald-500/40'
                            : 'text-amber-300 bg-amber-400/10 border border-amber-400/20'
                        }`}
                      >
                        {assigned || 'Serbest Ziyaret'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-xs font-black text-cyan-300 bg-slate-950/90 px-2 py-0.5 rounded-md border border-slate-700/80 shrink-0 shadow-inner tracking-wide ml-1.5">
                      <span>{s.start}</span>
                      <span className="text-slate-500 font-normal">-</span>
                      <span>{s.end}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3B: SAĞ ALT KUTU: DÖNÜŞÜMLÜ KÜLTÜR VİTRİNİ + DİNAMİK ÖĞRENCİ PORTALI QR KODU */}
          <div className="bg-slate-900/70 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-3 flex flex-col justify-between shadow-xl min-h-0 overflow-hidden">
            {/* Üst: Vitrin Başlığı ve Döngü Butonları */}
            <div className="flex items-center justify-between pb-1 border-b border-indigo-500/20 shrink-0">
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <span>{cultureMode === 'book' ? '⭐' : cultureMode === 'author' ? '✍️' : '📌'}</span>
                {cultureMode === 'book' ? 'Tavsiye Eser' : cultureMode === 'author' ? 'Haftanın Yazarı' : 'Kütüphane Hatırlatması'}
              </span>

              <div className="flex items-center gap-1 text-[8px] font-bold">
                <button
                  type="button"
                  onClick={() => setCultureMode('book')}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer ${cultureMode === 'book' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Kitap
                </button>
                <button
                  type="button"
                  onClick={() => setCultureMode('author')}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer ${cultureMode === 'author' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Yazar
                </button>
                <button
                  type="button"
                  onClick={() => setCultureMode('tip')}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer ${cultureMode === 'tip' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Kural
                </button>
              </div>
            </div>

            {/* Orta: 3'lü Dönüşümlü İçerik */}
            <div className="flex-1 flex items-center min-h-0 py-1">
              {cultureMode === 'book' && (
                activeRecBook ? (
                  <div className="flex items-center gap-2.5 w-full animate-in fade-in duration-500">
                    {activeRecBook.cover_url ? (
                      <img src={activeRecBook.cover_url} alt="" className="w-10 h-15 object-cover rounded-xl border border-indigo-400/30 shadow-md shrink-0" />
                    ) : (
                      <div className="w-10 h-15 rounded-xl bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0">📖</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="text-xs font-black text-white truncate">{activeRecBook.title}</h3>
                        {activeRecBook.page_count && (
                          <span className="text-[8px] font-mono text-indigo-300 bg-indigo-950 px-1 rounded border border-indigo-500/30 shrink-0">
                            {activeRecBook.page_count} sf.
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-indigo-200/90 font-medium truncate mt-0.5">{activeRecBook.author}</p>
                      <p className="text-[9px] text-slate-300/80 mt-0.5 line-clamp-2 italic leading-tight">
                        {activeRecBook.description || 'Kütüphanemizde mutlaka okunması gereken akıcı ve değerli bir eser.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center w-full">Eser yükleniyor...</p>
                )
              )}

              {cultureMode === 'author' && (
                <div className="flex items-center gap-2.5 w-full animate-in fade-in duration-500">
                  <div className="w-10 h-14 rounded-2xl bg-indigo-900/60 border border-indigo-400/30 flex items-center justify-center text-2xl shrink-0 shadow">
                    {activeAuthor.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-white truncate">{activeAuthor.name}</h4>
                      <span className="text-[8px] font-bold text-purple-300 bg-purple-500/20 px-1 rounded">
                        {activeAuthor.era}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                      {activeAuthor.desc}
                    </p>
                  </div>
                </div>
              )}

              {cultureMode === 'tip' && (
                <div className="flex items-center gap-2.5 w-full animate-in fade-in duration-500">
                  <div className="w-10 h-14 rounded-2xl bg-emerald-900/40 border border-emerald-400/30 flex items-center justify-center text-2xl shrink-0 shadow">
                    {activeTip.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-white truncate">{activeTip.title}</h4>
                    <p className="text-[9px] text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                      {activeTip.text}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Alt: Dinamik Öğrenci Portalı Karekod Alanı */}
            <div className="pt-1.5 border-t border-indigo-500/20 flex items-center justify-between gap-2.5 shrink-0 bg-slate-950/40 -mx-3 -mb-3 p-2.5 px-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 bg-white p-0.5 rounded-lg shrink-0 flex items-center justify-center shadow-md">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(studentPortalUrl)}`}
                    alt="Öğrenci Portalı QR Kodu"
                    className="w-full h-full object-contain block"
                  />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black text-amber-300 tracking-wider uppercase block truncate leading-none">
                    📱 Cep Kütüphanem
                  </span>
                  <span className="text-[8px] text-slate-300 block truncate mt-0.5">
                    Kitap ara • İade gününü gör
                  </span>
                </div>
              </div>

              <Link
                href="/ogrenci"
                className="text-[8px] font-black text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-2 py-1 rounded-md shrink-0 hover:bg-cyan-900 transition flex items-center gap-0.5"
              >
                <span>/ogrenci</span>
                <span>→</span>
              </Link>
            </div>
          </div>

        </div>

      </main>

      {/* 4. DİNAMİK GÜNÜN SÖZÜ & CANLI HAVA DURUMU AKILLI MOTİVASYON BANDI */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-1.5 my-1 z-10 flex items-center gap-3 overflow-hidden shadow-inner shrink-0">
        {bottomTickerMode === 'quote' ? (
          <div className="flex items-center gap-3 w-full animate-in fade-in duration-500 truncate">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest shrink-0 flex items-center gap-1.5">
              <span>📖</span> Günün Sözü
            </span>
            <span className="text-slate-600">|</span>
            <p className="text-xs text-slate-200 truncate italic">
              "{currentQuote.text}" — <strong className="text-white font-semibold not-italic">{currentQuote.author}</strong>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full animate-in fade-in duration-500 truncate">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest shrink-0 flex items-center gap-1.5">
              <span>{weather.icon}</span> Canik / Samsun {weather.temp !== null ? `(${weather.temp}°C - ${weather.desc})` : ''}
            </span>
            <span className="text-slate-600">|</span>
            <p className="text-xs text-emerald-300 truncate font-medium">
              "{weather.note}"
            </p>
          </div>
        )}
      </div>

      {/* 5. ALT BAR: Sayaçlar & Çıkış */}
      <footer className="pt-1.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 z-10 shrink-0">
        <div className="grid grid-cols-4 gap-3 lg:gap-6 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-base p-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">📚</span>
            <div>
              <span className="text-sm lg:text-base font-black text-white">{stats.totalBooks}</span>
              <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Mevcut Kitap</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-base p-1 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">🎓</span>
            <div>
              <span className="text-sm lg:text-base font-black text-white">{stats.totalStudents}</span>
              <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Kayıtlı Okur</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-base p-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓</span>
            <div>
              <span className="text-sm lg:text-base font-black text-emerald-400">{stats.monthlyRead}</span>
              <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">
                {currentMonthName ? `${currentMonthName} Okunan` : 'Aylık Okunan'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-base p-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">📄</span>
            <div>
              <span className="text-sm lg:text-base font-black text-amber-400">{stats.totalMonthlyPages.toLocaleString('tr-TR')}</span>
              <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Aylık Sayfa</p>
            </div>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition px-3 py-1 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800"
        >
          ✕ Panodan Çık (Ana Sayfa)
        </Link>
      </footer>
    </div>
  );
}