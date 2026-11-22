'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useStaffAuth } from '@/lib/useStaffAuth';

const AVAILABLE_ROUTES = [
  { path: '/dashboard', label: 'Ana Sayfa (Kontrol Merkezi)' },
  { path: '/odunc-ver', label: 'Ödünç Masası (Ver / İade Al)' },
  { path: '/kitaplar', label: 'Kitap Envanteri' },
  { path: '/ogrenciler', label: 'Öğrenci Yönetimi' },
  { path: '/ogrenci-kartlari', label: 'Öğrenci Kartları' },
  { path: '/emanetler', label: 'Emanet Takip' },
  { path: '/etiketler', label: 'Barkod & Etiket' },
  { path: '/istatistikler', label: 'İstatistikler' },
  { path: '/pano', label: 'Canlı Pano (TV)' },
  { path: '/nobet', label: 'Kütüphane Nöbet Çizelgesi' },
  { path: '/ayarlar', label: 'Sistem Ayarları' },
  { path: '/uyeler', label: 'Grup & Üye Yönetimi' },
];

const AVAILABLE_PERMISSIONS = [
  { key: 'can_add_book', label: 'Yeni Kitap Ekleyebilir' },
  { key: 'can_edit_book', label: 'Kitap Bilgisi Düzenleyebilir' },
  { key: 'can_delete_book', label: 'Kitap Silebilir (Kritik)' },
  { key: 'can_manage_students', label: 'Öğrenci Ekleyip Düzenleyebilir' },
  { key: 'can_manage_duties', label: 'Nöbet Excel Yükleyebilir' },
  { key: 'can_manage_users', label: 'Grup & Üye Yönetebilir' },
];

function slugifyGroup(text) {
  return String(text ?? '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function GrupVeUyeYonetimPage() {
  const { user, loading: authLoading } = useStaffAuth();
  const [activeTab, setActiveTab] = useState('groups'); // 'groups' | 'members'

  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Yeni Grup Oluşturma Formu
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  // Yeni Üye Oluşturma Formu
  const [newMember, setNewMember] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'teacher_librarian',
  });

  // Üye Düzenleme
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'teacher_librarian',
  });

  const isAdmin = user?.role === 'admin';

  const loadAll = async () => {
    setLoading(true);
    const [grpRes, memRes] = await Promise.all([
      supabase.from('user_groups').select('*').order('id', { ascending: true }),
      supabase.from('staff_users').select('id, username, password, full_name, role, created_at').order('id', { ascending: true }),
    ]);

    if (grpRes.error) {
      setMessage({ text: 'Gruplar yüklenirken hata: ' + grpRes.error.message, type: 'error' });
    } else {
      const loadedGroups = grpRes.data || [];
      setGroups(loadedGroups);
      if (loadedGroups.length > 0 && !loadedGroups.some((g) => g.slug === newMember.role)) {
        setNewMember((prev) => ({ ...prev, role: loadedGroups[0].slug }));
      }
    }

    if (memRes.error) {
      setMessage({ text: 'Üyeler yüklenirken hata: ' + memRes.error.message, type: 'error' });
    } else {
      setMembers(memRes.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadAll();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, isAdmin]);

  // Grup Sayfa İzni Checkbox Değişimi
  const toggleGroupRoute = (groupId, routePath) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const currentRoutes = Array.isArray(g.allowed_routes) ? g.allowed_routes : [];
        const exists = currentRoutes.includes(routePath);
        const updated = exists
          ? currentRoutes.filter((r) => r !== routePath)
          : [...currentRoutes, routePath];
        return { ...g, allowed_routes: updated };
      })
    );
  };

  // Grup İşlem İzni Checkbox Değişimi
  const toggleGroupPermission = (groupId, permKey) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const currentPerms = g.permissions || {};
        return {
          ...g,
          permissions: {
            ...currentPerms,
            [permKey]: !currentPerms[permKey],
          },
        };
      })
    );
  };

  // Grup Yetkilerini Veritabanına Kaydet
  const handleSaveGroup = async (group) => {
    setSaving(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabase
      .from('user_groups')
      .update({
        name: group.name,
        description: group.description,
        allowed_routes: group.allowed_routes || [],
        permissions: group.permissions || {},
      })
      .eq('id', group.id);

    if (error) {
      setMessage({ text: 'Grup yetkileri kaydedilirken hata: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: `✓ "${group.name}" grubunun yetkileri güncellendi.`, type: 'success' });
    }
    setSaving(false);
  };

  // Yeni Özel Grup Oluştur
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const cleanName = newGroupName.trim();
    if (!cleanName) return;

    const slug = slugifyGroup(cleanName) || `grup_${Date.now()}`;
    if (groups.some((g) => g.slug === slug)) {
      setMessage({ text: 'Bu isimde bir grup zaten mevcut.', type: 'error' });
      return;
    }

    setSaving(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabase.from('user_groups').insert([
      {
        slug,
        name: cleanName,
        description: newGroupDesc.trim() || 'Özel yetkilendirilmiş kütüphane grubu.',
        allowed_routes: ['/dashboard', '/odunc-ver'],
        permissions: {
          can_add_book: false,
          can_edit_book: false,
          can_delete_book: false,
          can_manage_students: false,
          can_manage_duties: false,
          can_manage_users: false,
        },
        is_system: false,
      },
    ]);

    if (error) {
      setMessage({ text: 'Grup oluşturulurken hata: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: `✓ "${cleanName}" grubu oluşturuldu. Aşağıdan kutucukları işaretleyip kaydedebilirsiniz.`, type: 'success' });
      setNewGroupName('');
      setNewGroupDesc('');
      loadAll();
    }
    setSaving(false);
  };

  // Özel Grubu Sil
  const handleDeleteGroup = async (group) => {
    if (group.is_system) {
      setMessage({ text: 'Sistem temel grupları silinemez, yetkilerini düzenleyebilirsiniz.', type: 'error' });
      return;
    }
    if (!confirm(`"${group.name}" grubunu silmek istediğinize emin misiniz?`)) return;

    const { error } = await supabase.from('user_groups').delete().eq('id', group.id);
    if (error) {
      setMessage({ text: 'Grup silinemedi: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: `"${group.name}" grubu silindi.`, type: 'success' });
      loadAll();
    }
  };

  // Yeni Üye Oluştur
  const handleCreateMember = async (e) => {
    e.preventDefault();
    const cleanFullName = newMember.full_name.trim();
    const cleanUsername = newMember.username.trim();
    const cleanPassword = newMember.password.trim();

    if (!cleanFullName || !cleanUsername || !cleanPassword) {
      setMessage({ text: 'Ad Soyad, Kullanıcı Adı ve Şifre alanları zorunludur.', type: 'error' });
      return;
    }

    setSaving(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabase.from('staff_users').insert([
      {
        full_name: cleanFullName,
        username: cleanUsername,
        password: cleanPassword,
        role: newMember.role,
      },
    ]);

    if (error) {
      setMessage({ text: 'Hesap oluşturulurken hata: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: `✓ "${cleanFullName}" hesabı oluşturuldu.`, type: 'success' });
      setNewMember({ full_name: '', username: '', password: '', role: newMember.role });
      loadAll();
    }
    setSaving(false);
  };

  const startEditMember = (item) => {
    setEditingMemberId(item.id);
    setEditMemberForm({
      full_name: item.full_name || '',
      username: item.username || '',
      password: item.password || '',
      role: item.role || 'teacher_librarian',
    });
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    if (!editingMemberId) return;

    setSaving(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabase
      .from('staff_users')
      .update({
        full_name: editMemberForm.full_name.trim(),
        username: editMemberForm.username.trim(),
        password: editMemberForm.password.trim(),
        role: editMemberForm.role,
      })
      .eq('id', editingMemberId);

    if (error) {
      setMessage({ text: 'Üye güncellenirken hata: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: '✓ Üye bilgileri ve grubu güncellendi.', type: 'success' });
      setEditingMemberId(null);
      loadAll();
    }
    setSaving(false);
  };

  const handleDeleteMember = async (item) => {
    if (String(item.id) === String(user?.id)) {
      setMessage({ text: 'Aktif oturumunuzun bağlı olduğu hesabı silemezsiniz.', type: 'error' });
      return;
    }
    if (!confirm(`"${item.full_name}" (${item.username}) hesabını silmek istediğinize emin misiniz?`)) return;

    const { error } = await supabase.from('staff_users').delete().eq('id', item.id);
    if (error) {
      setMessage({ text: 'Silme hatası: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: `"${item.full_name}" silindi.`, type: 'success' });
      loadAll();
    }
  };

  const getGroupLabel = (slug) => {
    const found = groups.find((g) => g.slug === slug);
    if (found) return found.name;
    if (slug === 'librarian') return 'Kütüphaneci';
    return slug;
  };

  if (authLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Yetki kontrol ediliyor...</div>;
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-3 shadow-xs">
          <span className="text-3xl">🛡️</span>
          <h1 className="text-lg font-black text-slate-900">Yalnızca Admin Yetkisi</h1>
          <p className="text-xs text-slate-500">
            Grup yetkilendirme ve üye yönetimi işlemleri yalnızca <strong>Admin</strong> grubundaki yöneticiler tarafından yapılabilir.
          </p>
          <div className="pt-2">
            <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
              ← Yönetim Paneline Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto antialiased">
      {/* Üst Başlık & Sekme Geçişi */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Yetki & Hesap Merkezi</span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Grup & Yetki Panosu</h1>
          <p className="text-xs text-slate-400">
            Grupları işaretleyerek sayfa ve işlem izinlerini belirleyin, yeni gruplar ve kullanıcı hesapları oluşturun
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex items-center gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
                activeTab === 'groups' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🛡️ Gruplar & Yetkiler ({groups.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
                activeTab === 'members' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              👥 Kullanıcı Hesapları ({members.length})
            </button>
          </div>

          <Link
            href="/dashboard"
            className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition"
          >
            ← Panele Dön
          </Link>
        </div>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border ${
            message.type === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ================================================================= */}
      {/* 1. SEKME: GRUPLAR & YETKİ CHECKBOX MATRİSİ                        */}
      {/* ================================================================= */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Yeni Grup Oluşturma Kartı */}
          <form onSubmit={handleCreateGroup} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h2 className="text-sm font-black text-slate-900">Yeni Yetki Grubu Oluştur</h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <div className="md:col-span-4">
                <input
                  type="text"
                  required
                  placeholder="Grup Adı (Örn: Nöbetçi Kulüp Başkanı)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div className="md:col-span-6">
                <input
                  type="text"
                  placeholder="Kısa açıklama (İsteğe bağlı)"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer disabled:opacity-50"
                >
                  + Grup Ekle
                </button>
              </div>
            </div>
          </form>

          {/* Grup Kartları */}
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Gruplar yükleniyor...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {groups.map((grp) => {
                const isRootAdmin = grp.slug === 'admin';
                const routes = Array.isArray(grp.allowed_routes) ? grp.allowed_routes : [];
                const perms = grp.permissions || {};

                return (
                  <div
                    key={grp.id}
                    className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-4">
                      {/* Grup Başlığı */}
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-slate-900">{grp.name}</h3>
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                              {grp.slug}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">{grp.description}</p>
                        </div>

                        {!grp.is_system && (
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(grp)}
                            className="text-[11px] font-bold text-rose-600 hover:underline shrink-0 cursor-pointer"
                          >
                            Sil
                          </button>
                        )}
                      </div>

                      {/* Görebileceği Sayfalar (Menüler) */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                          Görebileceği Ekranlar / Menüler
                        </span>
                        <div className="grid grid-cols-1 gap-1.5 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                          {AVAILABLE_ROUTES.map((rt) => {
                            const checked = isRootAdmin || routes.includes(rt.path);
                            return (
                              <label
                                key={rt.path}
                                className={`flex items-center gap-2.5 text-xs select-none ${
                                  isRootAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:text-slate-950'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isRootAdmin}
                                  onChange={() => toggleGroupRoute(grp.id, rt.path)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className={checked ? 'font-bold text-slate-800' : 'text-slate-500'}>
                                  {rt.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* İşlem Yetkileri */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                          Özel İşlem Yetkileri
                        </span>
                        <div className="grid grid-cols-1 gap-1.5 bg-amber-50/40 p-3 rounded-2xl border border-amber-100">
                          {AVAILABLE_PERMISSIONS.map((pm) => {
                            const checked = isRootAdmin || Boolean(perms[pm.key]);
                            return (
                              <label
                                key={pm.key}
                                className={`flex items-center gap-2.5 text-xs select-none ${
                                  isRootAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isRootAdmin}
                                  onChange={() => toggleGroupPermission(grp.id, pm.key)}
                                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                />
                                <span className={checked ? 'font-bold text-slate-800' : 'text-slate-500'}>
                                  {pm.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {!isRootAdmin ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveGroup(grp)}
                        className="w-full py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {saving ? 'Kaydediliyor...' : `✓ ${grp.name} Yetkilerini Kaydet`}
                      </button>
                    ) : (
                      <div className="text-center text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 py-2 rounded-2xl">
                        👑 Tam Yetkili Ana Yönetici Grubu
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. SEKME: KULLANICI HESAPLARI & GRUP ATAMA                        */}
      {/* ================================================================= */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateMember} className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-2xs">
            <h2 className="text-sm font-black text-slate-900">Yeni Kullanıcı Hesabı Oluştur</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Ad Soyad / Hesap Etiketi *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Nöbetçi Öğrenci Masası"
                  value={newMember.full_name}
                  onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Kullanıcı Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: nobetci_ogrenci"
                  value={newMember.username}
                  onChange={(e) => setNewMember({ ...newMember, username: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Şifre *</label>
                <input
                  type="text"
                  required
                  placeholder="Şifre belirleyin"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Yetki Grubu</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                >
                  {groups.map((g) => (
                    <option key={g.slug} value={g.slug}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Ekleniyor...' : '+ Hesap Oluştur'}
                </button>
              </div>
            </div>
          </form>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Sistem Hesapları ({members.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="p-3">ID</th>
                    <th className="p-3">Ad Soyad</th>
                    <th className="p-3">Kullanıcı Adı</th>
                    <th className="p-3">Şifre</th>
                    <th className="p-3">Bağlı Grup</th>
                    <th className="p-3 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => {
                    const isEditing = editingMemberId === m.id;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono text-slate-400">#{m.id}</td>
                        <td className="p-3 font-bold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editMemberForm.full_name}
                              onChange={(e) => setEditMemberForm({ ...editMemberForm, full_name: e.target.value })}
                              className="p-1.5 border border-slate-300 rounded-lg w-full"
                            />
                          ) : (
                            m.full_name
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editMemberForm.username}
                              onChange={(e) => setEditMemberForm({ ...editMemberForm, username: e.target.value })}
                              className="p-1.5 border border-slate-300 rounded-lg w-full"
                            />
                          ) : (
                            m.username
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editMemberForm.password}
                              onChange={(e) => setEditMemberForm({ ...editMemberForm, password: e.target.value })}
                              className="p-1.5 border border-slate-300 rounded-lg w-full"
                            />
                          ) : (
                            m.password
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <select
                              value={editMemberForm.role}
                              onChange={(e) => setEditMemberForm({ ...editMemberForm, role: e.target.value })}
                              className="p-1.5 border border-slate-300 rounded-lg font-bold"
                            >
                              {groups.map((g) => (
                                <option key={g.slug} value={g.slug}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                m.role === 'admin'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : m.role === 'student_librarian'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-blue-100 text-blue-900 border border-blue-300'
                              }`}
                            >
                              {getGroupLabel(m.role)}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={handleUpdateMember}
                                className="text-emerald-700 font-bold hover:underline mr-2 cursor-pointer"
                              >
                                Kaydet
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingMemberId(null)}
                                className="text-slate-500 font-semibold hover:underline cursor-pointer"
                              >
                                İptal
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditMember(m)}
                                className="text-blue-600 font-bold hover:underline mr-2 cursor-pointer"
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMember(m)}
                                className="text-rose-600 font-bold hover:underline cursor-pointer"
                              >
                                Sil
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}