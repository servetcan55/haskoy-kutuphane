'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      setErrorMsg('Giriş başarısız: ' + (error.message === 'Invalid login credentials' ? 'E-posta veya şifre hatalı!' : error.message));
      setLoading(false);
    } else if (data?.user) {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl border shadow-sm w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Hasköy Ortaokulu</span>
          <h1 className="text-2xl font-bold text-slate-800">Yönetici Girişi</h1>
          <p className="text-xs text-slate-500">Kütüphane yönetim paneline erişmek için oturum açın</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">E-Posta Adresi</label>
            <input
              type="email"
              placeholder="ornek@meb.k12.tr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-sm text-black outline-none focus:border-blue-500 bg-slate-50 focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Şifre</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-sm text-black outline-none focus:border-blue-500 bg-slate-50 focus:bg-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition cursor-pointer disabled:bg-blue-300 shadow-xs"
          >
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}