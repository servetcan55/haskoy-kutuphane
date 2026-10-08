'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getAcademicInfo } from '@/lib/academic';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const currentAcademic = getAcademicInfo();

  useEffect(() => {
    // Personel oturumu zaten varsa doğrudan panoya yönlendir
    const staffSession = localStorage.getItem('haskoy_staff_session');
    if (staffSession) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Lütfen kullanıcı adı / e-posta ve şifrenizi girin.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const loginInput = username.trim().toLowerCase();

      // 1. staff_users tablosunda kontrol
      const { data: staffData } = await supabase
        .from('staff_users')
        .select('id, username, full_name, role, password')
        .eq('username', loginInput)
        .maybeSingle();

      if (staffData && staffData.password === password.trim()) {
        const sessionData = {
          id: staffData.id,
          username: staffData.username,
          full_name: staffData.full_name,
          role: staffData.role,
          loggedInAt: new Date().toISOString(),
        };

        localStorage.setItem('haskoy_staff_session', JSON.stringify(sessionData));
        router.push('/dashboard');
        return;
      }

      // 2. Supabase Auth (E-posta + Şifre) kontrolü
      if (loginInput.includes('@')) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: username.trim(),
          password: password.trim(),
        });

        if (!authError && authData?.user) {
          const userObj = authData.user;
          const sessionData = {
            id: userObj.id,
            username: userObj.email,
            full_name: userObj.user_metadata?.full_name || 'Servet CAN',
            role: 'admin',
            loggedInAt: new Date().toISOString(),
          };

          localStorage.setItem('haskoy_staff_session', JSON.stringify(sessionData));
          router.push('/dashboard');
          return;
        }
      }

      setErrorMsg('Kullanıcı adı / e-posta veya şifre hatalı.');
    } catch (err) {
      setErrorMsg('Giriş yapılırken bir hata oluştu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 antialiased selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 sm:p-8 shadow-2xl space-y-6 z-10">
        
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-xl shadow-blue-500/25 mx-auto">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-2xl text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-cyan-300">
              H
            </div>
          </div>
          <span className="text-[11px] font-black tracking-widest uppercase text-cyan-400 block pt-1">
            Canik / Samsun • {currentAcademic.academicYear}
          </span>
          <h1 className="text-xl font-black text-white tracking-tight">Kütüphane Yönetim Paneli</h1>
          <p className="text-xs text-slate-400">Yetkili Personel Giriş Ekranı</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5 text-left">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Kullanıcı Adı veya E-Posta
            </label>
            <input
              type="text"
              placeholder="admin, ogretmen veya e-posta"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full text-xs font-semibold p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Şifre
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full text-xs font-semibold p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition cursor-pointer active:scale-95 disabled:opacity-50 text-center"
          >
            {loading ? 'Doğrulanıyor...' : 'Sisteme Giriş Yap 🔐'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <Link href="/" className="text-slate-400 hover:text-white transition font-medium">
            ← Ana Sayfaya Dön
          </Link>
          <Link href="/pano" className="text-slate-400 hover:text-white transition font-medium">
            📺 TV Panosu
          </Link>
        </div>

      </div>
    </div>
  );
}