'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useStaffAuth(requiredRole = null) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('haskoy_staff_session');
    if (!raw) {
      setUser(null);
      setLoading(false);
      router.push('/login');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.id) {
        throw new Error('Geçersiz oturum');
      }

      // Rol kontrolü (Eğer belirli bir rol şart koşulmuşsa, örn: 'admin')
      if (requiredRole && parsed.role !== requiredRole) {
        alert('Bu bölüme erişim için Yönetici (Okul Müdürü) yetkisi gereklidir.');
        router.push('/');
        return;
      }

      setUser(parsed);
    } catch (e) {
      localStorage.removeItem('haskoy_staff_session');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router, requiredRole]);

  const logout = () => {
    localStorage.removeItem('haskoy_staff_session');
    setUser(null);
    router.push('/login');
  };

  return { user, loading, logout, isAdmin: user?.role === 'admin' };
}