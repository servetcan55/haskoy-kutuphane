'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouteGuard } from '@/lib/useRouteGuard';
import { useStaffAuth } from '@/lib/useStaffAuth';

const VALID_DENSITIES = ['compact', 'normal', 'spacious'];

const DEFAULT_QUOTES = [
  { text: 'Kitapsız yaşamak; kör, sağır ve dilsiz yaşamaktır.', author: 'Seneca' },
  { text: 'Hayatta en hakiki mürşit ilimdir, fendir.', author: 'Mustafa Kemal Atatürk' },
  { text: 'Bir kitap, içimizdeki donmuş denizi parçalayacak bir balta olmalıdır.', author: 'Franz Kafka' },
  { text: 'Okumak bir insanı doldurur, konuşmak hazırlar, yazmak ise olgunlaştırır.', author: 'Francis Bacon' },
  { text: 'Kitaplar hiç solmayan çiçeklerdir.', author: 'Hasan Ali Yücel' },
];

const DEFAULT_SLOTS = [
  { id: 'slot1', name: '1. Teneffüs', start: '09:10', end: '09:25' },
  { id: 'slot2', name: '2. Teneffüs', start: '10:05', end: '10:20' },
  { id: 'slot3', name: '3. Teneffüs', start: '11:00', end: '11:15' },
  { id: 'slot4', name: '4. Teneffüs', start: '11:55', end: '12:10' },
  { id: 'slot5', name: 'Öğle Arası', start: '12:50', end: '13:25' },
  { id: 'slot6', name: '5. Teneffüs', start: '14:05', end: '14:20' },
];

const DAYS = [
  { key: 'monday', label: 'Pazartesi' },
  { key: 'tuesday', label: 'Salı' },
  { key: 'wednesday', label: 'Çarşamba' },
  { key: 'thursday', label: 'Perşembe' },
  { key: 'friday', label: 'Cuma' },
];

function getStoredDensity() {
  if (typeof window === 'undefined') return 'normal';
  try {
    const persisted = window.localStorage.getItem('haskoy_sidebar_density_persisted');
    if (persisted && VALID_DENSITIES.includes(persisted)) return persisted;
    const current = window.localStorage.getItem('haskoy_sidebar_density');
    if (current && VALID_DENSITIES.includes(current)) return current;
  } catch (_) {}
  return 'normal';
}

function setStoredDensity(mode) {
  if (typeof window === 'undefined' || !VALID_DENSITIES.includes(mode)) return;
  try {
    window.localStorage.setItem('haskoy_sidebar_density', mode);
    window.localStorage.setItem('haskoy_sidebar_density_persisted', mode);
  } catch (_) {}
  window.dispatchEvent(
    new CustomEvent('haskoy-sidebar-density-change', { detail: { density: mode } })
  );
}

export default function SettingsPage() {
  const { user, loading: guardLoading, authorized } = useRouteGuard();
  const { logout } = useStaffAuth();

  // Hedefler & Sözler State'leri
  const [termGoal, setTermGoal] = useState('500');
  const [termPageGoal, setTermPageGoal] = useState('100000');
  const [quotes, setQuotes] = useState(DEFAULT_QUOTES);
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingQuotes, setSavingQuotes] = useState(false);
  const [goalMessage, setGoalMessage] = useState('');
  const [quotesMessage, setQuotesMessage] = useState('');

  // Kurumsal Karne İmza Yetkilileri State'leri
  const [schoolDirector, setSchoolDirector] = useState('');
  const [libraryTeacher, setLibraryTeacher] = useState('');
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffMessage, setStaffMessage] = useState('');

  // Teneffüs Çizelgesi State'leri
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [schedule, setSchedule] = useState({
    monday: {},
    tuesday: {},
    wednesday: {},
    thursday: {},
    friday: {},
  });
  const [selectedDay, setSelectedDay] = useState('monday');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');

  // Sol Menü Boyutu / Yoğunluğu State'leri
  const [sidebarDensity, setSidebarDensity] = useState('normal');
  const [savingDensity, setSavingDensity] = useState(false);
  const [densityMessage, setDensityMessage] = useState('');

  // İstemci açılışında tarayıcıdaki kayıtlı menü yoğunluğunu anında uygula
  useEffect(() => {
    const initial = getStoredDensity();
    setSidebarDensity(initial);
  }, []);

  const loadSettings = async () => {
    const [goalRes, pageGoalRes, quotesRes, scheduleRes, directorRes, teacherRes, densityRes] = await Promise.all([
      supabase.from('settings').select('value').eq('id', 'term_goal').maybeSingle(),
      supabase.from('settings').select('value').eq('id', 'term_page_goal').maybeSingle(),
      supabase.from('settings').select('value').eq('id', 'kiosk_quotes').maybeSingle(),
      supabase.from('settings').select('value').eq('id', 'library_schedule').maybeSingle(),
      supabase.from('settings').select('value').eq('id', 'school_director').maybeSingle(),
      supabase.from('settings').select('value').eq('id', 'library_teacher').maybeSingle(),
      supabase.from('settings').select('value').eq('id', 'sidebar_density').maybeSingle(),
    ]);

    if (goalRes.data?.value) setTermGoal(goalRes.data.value);
    if (pageGoalRes.data?.value) setTermPageGoal(pageGoalRes.data.value);
    if (directorRes.data?.value) setSchoolDirector(directorRes.data.value);
    if (teacherRes.data?.value) setLibraryTeacher(teacherRes.data.value);

    const localSaved = getStoredDensity();
    let hasExplicitLocal = false;
    try {
      hasExplicitLocal = Boolean(window.localStorage.getItem('haskoy_sidebar_density_persisted'));
    } catch (_) {}

    if (hasExplicitLocal && VALID_DENSITIES.includes(localSaved)) {
      setSidebarDensity(localSaved);
      setStoredDensity(localSaved);
    } else if (densityRes.data?.value && VALID_DENSITIES.includes(densityRes.data.value)) {
      setSidebarDensity(densityRes.data.value);
      setStoredDensity(densityRes.data.value);
    } else {
      setSidebarDensity(localSaved);
    }

    if (quotesRes.data?.value) {
      try {
        const parsed = JSON.parse(quotesRes.data.value);
        if (Array.isArray(parsed) && parsed.length > 0) setQuotes(parsed);
      } catch (err) {
        console.error('Sözler parse edilemedi:', err);
      }
    }

    if (scheduleRes.data?.value) {
      try {
        const parsedSchedule = JSON.parse(scheduleRes.data.value);
        if (parsedSchedule.slots && Array.isArray(parsedSchedule.slots)) setSlots(parsedSchedule.slots);
        if (parsedSchedule.schedule) setSchedule(parsedSchedule.schedule);
      } catch (e) {
        console.error('Çizelge okunamadı:', e);
      }
    }
  };

  useEffect(() => {
    if (!guardLoading && user && authorized) {
      loadSettings();
    }
  }, [guardLoading, user, authorized]);

  // Sol menü yoğunluğunu anında önizleme + kalıcı saklama
  const handleDensitySelect = (mode) => {
    setSidebarDensity(mode);
    setStoredDensity(mode);
  };

  const handleSaveDensity = async (e) => {
    e.preventDefault();
    setSavingDensity(true);
    setDensityMessage('');
    setStoredDensity(sidebarDensity);

    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          id: 'sidebar_density',
          value: sidebarDensity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    setSavingDensity(false);
    if (error) {
      setDensityMessage(`✓ Tarayıcı tercihiniz kaydedildi (${sidebarDensity}). (Veritabanı notu: ${error.message})`);
    } else {
      setDensityMessage('✓ Sol menü yoğunluğu ayarı kaydedildi!');
    }
    setTimeout(() => setDensityMessage(''), 4000);
  };

  // 1. Karne İmza Yetkililerini Kaydetme
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    setSavingStaff(true);
    setStaffMessage('');

    const [res1, res2] = await Promise.all([
      supabase.from('settings').upsert({
        id: 'school_director',
        value: schoolDirector.trim(),
        updated_at: new Date().toISOString(),
      }),
      supabase.from('settings').upsert({
        id: 'library_teacher',
        value: libraryTeacher.trim(),
        updated_at: new Date().toISOString(),
      }),
    ]);

    setSavingStaff(false);
    if (res1.error || res2.error) {
      setStaffMessage('Hata: Yetkili bilgileri kaydedilemedi.');
    } else {
      setStaffMessage('✓ Karne imza yetkilileri başarıyla kaydedildi! Tüm karnelere yansıtıldı.');
      setTimeout(() => setStaffMessage(''), 3000);
    }
  };

  // 2. Hedefleri Kaydetme
  const handleSaveGoal = async (e) => {
    e.preventDefault();
    setSavingGoal(true);
    setGoalMessage('');

    const [res1, res2] = await Promise.all([
      supabase.from('settings').upsert({
        id: 'term_goal',
        value: String(termGoal).trim(),
        updated_at: new Date().toISOString(),
      }),
      supabase.from('settings').upsert({
        id: 'term_page_goal',
        value: String(termPageGoal).trim(),
        updated_at: new Date().toISOString(),
      }),
    ]);

    setSavingGoal(false);
    if (res1.error || res2.error) {
      setGoalMessage('Hata: Hedefler kaydedilemedi.');
    } else {
      setGoalMessage('✓ Dönemlik kitap ve sayfa rekoru hedefleri başarıyla kaydedildi!');
      setTimeout(() => setGoalMessage(''), 3000);
    }
  };

  // 3. Teneffüs Çizelgesini Kaydetme
  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    setScheduleMessage('');

    const payload = { slots, schedule };

    const { error } = await supabase.from('settings').upsert({
      id: 'library_schedule',
      value: JSON.stringify(payload),
      updated_at: new Date().toISOString(),
    });

    setSavingSchedule(false);
    if (error) {
      setScheduleMessage('Hata: Çizelge kaydedilemedi.');
    } else {
      setScheduleMessage('✓ Kütüphane haftalık teneffüs ve şube programı başarıyla kaydedildi!');
      setTimeout(() => setScheduleMessage(''), 3500);
    }
  };

  // 4. Günün Sözleri İşlemleri
  const handleAddQuote = (e) => {
    e.preventDefault();
    if (!newText.trim() || !newAuthor.trim()) return;

    setQuotes((prev) => [...prev, { text: newText.trim(), author: newAuthor.trim() }]);
    setNewText('');
    setNewAuthor('');
  };

  const handleDeleteQuote = (index) => {
    if (quotes.length <= 1) {
      alert('Panoda en az 1 adet söz kalmalıdır.');
      return;
    }
    setQuotes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveQuotesToDb = async () => {
    setSavingQuotes(true);
    setQuotesMessage('');

    const { error } = await supabase.from('settings').upsert({
      id: 'kiosk_quotes',
      value: JSON.stringify(quotes),
      updated_at: new Date().toISOString(),
    });

    setSavingQuotes(false);
    if (error) {
      setQuotesMessage('Hata: Sözler veritabanına kaydedilemedi.');
    } else {
      setQuotesMessage('✓ Günün sözleri başarıyla kaydedildi! Canlı panoya yansıtıldı.');
      setTimeout(() => setQuotesMessage(''), 3000);
    }
  };

  if (guardLoading) {
    return (
      <div className="p-16 text-center text-xs font-mono text-slate-400">
        Yetki kontrol ediliyor...
      </div>
    );
  }

  if (!user || !authorized) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-3 shadow-xs">
          <span className="text-3xl">🔒</span>
          <h1 className="text-lg font-black text-slate-900">Bu Sayfaya Erişim Yetkiniz Yok</h1>
          <p className="text-xs text-slate-500">
            Bulunduğunuz kullanıcı grubu Sistem Ayarları ekranını görüntülemek için yetkilendirilmemiş.
          </p>
          <div className="pt-2">
            <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
              ← Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-8 pb-16 antialiased">
      {/* Üst Başlık & Kullanıcı Durumu & Ana Sayfaya Dönüş */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sistem & Kütüphane Ayarları</h1>
          <p className="text-xs text-slate-500 mt-1">
            Sol menü görünümünü, karne imza yetkililerini, canlı pano hedeflerini, haftalık şube ziyaret çizelgesini ve günün sözlerini buradan yönetebilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-2xl">
              <span className="text-xs font-bold text-slate-800">{user.full_name}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                {user.role === 'admin' ? '👑 Yönetici' : `🛡️ ${user.role}`}
              </span>
              <button
                onClick={logout}
                title="Güvenli Çıkış"
                className="text-xs text-slate-400 hover:text-rose-600 transition ml-1 cursor-pointer"
              >
                Çıkış ✕
              </button>
            </div>
          )}

          <Link
            href="/"
            className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition shadow-2xs flex items-center gap-1.5"
          >
            ← <span>Ana Sayfa</span>
          </Link>
        </div>
      </div>

      {/* 0. SOL MENÜ BOYUTU & YOĞUNLUĞU AYARI */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-5">
          <span className="text-base p-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">📐</span>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Sol Menü Boyutu & Yoğunluğu
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tüm menü linkleri açıkken alt kullanıcı profilinin ve ekran sığmasının nasıl davranacağını seçin.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveDensity} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'compact',
                title: 'Kompakt',
                desc: 'Sıkı aralık, küçük ekranlarda ekstra boşluk',
              },
              {
                id: 'normal',
                title: 'Normal (Önerilen)',
                desc: 'Dengeli boyut, kaydırma çubuğu çıkmadan tam oturur',
              },
              {
                id: 'spacious',
                title: 'Geniş',
                desc: 'Daha iri yazı ve geniş satır boşluğu',
              },
            ].map((opt) => {
              const active = sidebarDensity === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleDensitySelect(opt.id)}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                    active
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">{opt.title}</span>
                    {active && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {densityMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                densityMessage.startsWith('✓')
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {densityMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={savingDensity}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {savingDensity ? 'Kaydediliyor...' : 'Menü Boyutunu Kaydet'}
          </button>
        </form>
      </div>

      {/* 1. RESMİ KARNE İMZA YETKİLİLERİ AYARI */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-5">
          <span className="text-base p-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">🖋️</span>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Resmi Karne İmza Yetkilileri
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tekil öğrenci karnesi ve toplu şube karnelerinin altındaki mühür/imza alanlarında çıkacak isimler.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveStaff} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kütüphane Rehber Öğretmeni
              </label>
              <input
                type="text"
                value={libraryTeacher}
                onChange={(e) => setLibraryTeacher(e.target.value)}
                placeholder="Örn: Servet CAN"
                className="w-full text-sm font-semibold p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Karnelerin sol imza alanında unvanın altında yazar</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Okul Müdürü
              </label>
              <input
                type="text"
                value={schoolDirector}
                onChange={(e) => setSchoolDirector(e.target.value)}
                placeholder="Örn: Ahmet YILMAZ"
                className="w-full text-sm font-semibold p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Karnelerin sağ imza/mühür alanında unvanın altında yazar</span>
            </div>
          </div>

          {staffMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                staffMessage.startsWith('✓')
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {staffMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={savingStaff}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
          >
            {savingStaff ? 'Kaydediliyor...' : 'İmza Yetkililerini Kaydet'}
          </button>
        </form>
      </div>

      {/* 2. KÜTÜPHANE TENEFFÜS & ŞUBE ZİYARET ÇİZELGESİ */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">📅</span>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Haftalık Teneffüs & Ziyaretçi Şube Programı
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Günün teneffüs saatlerinde kütüphaneye hangi sınıfların kabul edileceğini belirleyin. Canlı panoda gösterilir.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs font-bold">
            {DAYS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDay(d.key)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  selectedDay === d.key ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
            <span className="col-span-3 sm:col-span-2">Teneffüs Adı</span>
            <span className="col-span-3 sm:col-span-3">Saat Aralığı</span>
            <span className="col-span-6 sm:col-span-7">Kütüphaneye Uğrayabilecek Şubeler (Örn: 5A, 5B, 6C)</span>
          </div>

          <div className="space-y-2">
            {slots.map((slot, index) => {
              const currentClasses = schedule[selectedDay]?.[slot.id] || '';
              return (
                <div
                  key={slot.id}
                  className="grid grid-cols-12 gap-3 items-center p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-slate-50/90 transition"
                >
                  <div className="col-span-3 sm:col-span-2">
                    <input
                      type="text"
                      value={slot.name}
                      onChange={(e) => {
                        const newSlots = [...slots];
                        newSlots[index].name = e.target.value;
                        setSlots(newSlots);
                      }}
                      className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-3 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={slot.start}
                      onChange={(e) => {
                        const newSlots = [...slots];
                        newSlots[index].start = e.target.value;
                        setSlots(newSlots);
                      }}
                      placeholder="09:10"
                      className="w-full text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center outline-none focus:border-blue-500"
                    />
                    <span className="text-slate-400 font-bold">-</span>
                    <input
                      type="text"
                      value={slot.end}
                      onChange={(e) => {
                        const newSlots = [...slots];
                        newSlots[index].end = e.target.value;
                        setSlots(newSlots);
                      }}
                      placeholder="09:25"
                      className="w-full text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-7">
                    <input
                      type="text"
                      placeholder="Örn: 5A, 5B, 5C"
                      value={currentClasses}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSchedule((prev) => ({
                          ...prev,
                          [selectedDay]: {
                            ...prev[selectedDay],
                            [slot.id]: val,
                          },
                        }));
                      }}
                      className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {scheduleMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold ${
              scheduleMessage.startsWith('✓')
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {scheduleMessage}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-400">* İlerleyen yıllarda yeni teneffüs saati veya şube eklemek için düzenleyebilirsiniz.</p>
          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={savingSchedule}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            {savingSchedule ? 'Kaydediliyor...' : 'Haftalık Programı Kaydet'}
          </button>
        </div>
      </div>

      {/* 3. DÖNEMLİK HEDEFLER (KİTAP & SAYFA REKORU) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
        <form onSubmit={handleSaveGoal} className="space-y-5 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                🎯 Dönemlik Kitap Hedefi
              </label>
              <p className="text-[11px] text-slate-400 mb-2">Okulun toplam okuyacağı eser hedefi</p>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="50000"
                  value={termGoal}
                  onChange={(e) => setTermGoal(e.target.value)}
                  required
                  className="w-full text-base font-bold p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 outline-none transition"
                  placeholder="500"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-slate-400">Kitap</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                🚀 Dönemlik Sayfa Rekoru Hedefi
              </label>
              <p className="text-[11px] text-slate-400 mb-2">Okulun toplam okuyacağı sayfa hedefi</p>
              <div className="relative">
                <input
                  type="number"
                  min="500"
                  step="500"
                  max="1000000"
                  value={termPageGoal}
                  onChange={(e) => setTermPageGoal(e.target.value)}
                  required
                  className="w-full text-base font-bold p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 outline-none transition"
                  placeholder="100000"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-slate-400">Sayfa</span>
              </div>
            </div>
          </div>

          {goalMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                goalMessage.startsWith('✓')
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {goalMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={savingGoal}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {savingGoal ? 'Kaydediliyor...' : 'Hedefleri Kaydet'}
          </button>
        </form>
      </div>

      {/* 4. GÜNÜN SÖZLERİ LİSTESİ */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            📖 Canlı Pano "Günün Sözü" Listesi
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            TV ekranının altındaki kayan bantta sırayla dönecek edebi sözler.
          </p>
        </div>

        <form
          onSubmit={handleAddQuote}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200"
        >
          <div className="sm:col-span-8">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Alıntı / Edebi Söz</label>
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Örn: Kitaplar akıllı kişilerin bahçeleridir."
              required
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none focus:border-blue-500"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Yazar / Düşünür</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder="Örn: Hz. Ali"
                required
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shrink-0 cursor-pointer"
              >
                + Ekle
              </button>
            </div>
          </div>
        </form>

        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {quotes.map((q, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate italic">"{q.text}"</p>
                <span className="text-[11px] font-bold text-blue-600">— {q.author}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteQuote(idx)}
                className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
              >
                Sil
              </button>
            </div>
          ))}
        </div>

        {quotesMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold ${
              quotesMessage.startsWith('✓')
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {quotesMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveQuotesToDb}
          disabled={savingQuotes}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
        >
          {savingQuotes ? 'Kaydediliyor...' : 'Tüm Söz Listesini Canlıya Kaydet'}
        </button>
      </div>
    </div>
  );
}