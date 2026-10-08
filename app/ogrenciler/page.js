'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [gradeClass, setGradeClass] = useState('');
  const [gender, setGender] = useState('kiz');
  const [photoUrl, setPhotoUrl] = useState('');
  
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

  // Düzenleme Modalı Durumu
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    id: '',
    student_number: '',
    full_name: '',
    grade_class: '',
    gender: 'belirtilmedi',
    photo_url: '',
  });

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*');

    if (!error && data) {
      // Önce şubeye (grade_class), şube içinde okul numarasına (sayısal) göre sırala
      data.sort((a, b) => {
        const classA = (a.grade_class || '').trim();
        const classB = (b.grade_class || '').trim();
        if (classA !== classB) {
          return classA.localeCompare(classB, 'tr', { numeric: true });
        }
        const numA = Number(a.student_number) || 0;
        const numB = Number(b.student_number) || 0;
        return numA - numB;
      });

      setStudents(data);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const classes = Array.from(new Set(students.map((s) => s.grade_class).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'tr', { numeric: true })
  );

  // Tekil Öğrenci Ekleme
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!studentNumber.trim() || !fullName.trim()) {
      setMessage({ text: 'Okul numarası ve ad-soyad zorunludur.', type: 'error' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('students').insert([
      {
        student_number: studentNumber.trim(),
        full_name: fullName.trim(),
        grade_class: gradeClass.trim(),
        gender: gender,
        photo_url: photoUrl.trim(),
      },
    ]);

    if (error) {
      setMessage({ text: 'Hata: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: 'Öğrenci başarıyla eklendi.', type: 'success' });
      setStudentNumber('');
      setFullName('');
      setGradeClass('');
      setPhotoUrl('');
      loadStudents();
    }
    setLoading(false);
  };

  // Düzenleme Başlat
  const startEdit = (st) => {
    setEditingStudent(st);
    setEditForm({
      id: st.id,
      student_number: st.student_number || '',
      full_name: st.full_name || '',
      grade_class: st.grade_class || '',
      gender: st.gender || 'kiz',
      photo_url: st.photo_url || '',
    });
  };

  // Düzenlemeyi Kaydet
  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('students')
      .update({
        student_number: editForm.student_number.trim(),
        full_name: editForm.full_name.trim(),
        grade_class: editForm.grade_class.trim(),
        gender: editForm.gender,
        photo_url: editForm.photo_url.trim(),
      })
      .eq('id', editForm.id);

    if (error) {
      setMessage({ text: 'Güncelleme hatası: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: 'Öğrenci bilgileri güncellendi.', type: 'success' });
      setEditingStudent(null);
      loadStudents();
    }
    setLoading(false);
  };

  // Öğrenci Silme
  const handleDeleteStudent = async (id, name) => {
    if (!confirm(`"${name}" isimli öğrenciyi ve kütüphane geçmişini silmek istediğinize emin misiniz?`)) return;

    await supabase.from('loans').delete().eq('student_id', id);
    const { error } = await supabase.from('students').delete().eq('id', id);

    if (error) {
      setMessage({ text: 'Silme hatası: ' + error.message, type: 'error' });
    } else {
      setMessage({ text: `"${name}" başarıyla silindi.`, type: 'success' });
      loadStudents();
    }
  };

  // Örnek Excel (.xlsx) Şablonu İndirme
  const downloadSampleExcel = () => {
    const sampleData = [
      { 'Okul No': 35, 'Ad Soyad': 'Ahmet Can ÖZTÜRK', 'Sınıf': '6A', 'Cinsiyet': 'Erkek' },
      { 'Okul No': 96, 'Ad Soyad': 'Zeynep AYGÜN', 'Sınıf': '6A', 'Cinsiyet': 'Kız' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Öğrenci Listesi');
    XLSX.writeFile(workbook, 'ornek_ogrenci_sablonu.xlsx');
  };

  // Excel / CSV Dosyası Okuma & Toplu Yükleme
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (jsonData.length === 0) {
        throw new Error('Yüklenen dosya boş görünüyor.');
      }

      const parsedStudents = jsonData
        .map((row) => {
          const no = row['Okul No'] || row['Numara'] || row['No'] || row['student_number'] || '';
          const name = row['Ad Soyad'] || row['Adı Soyadı'] || row['full_name'] || `${row['Ad'] || ''} ${row['Soyad'] || ''}`.trim();
          const cls = row['Sınıf'] || row['Sınıfı'] || row['Şube'] || row['grade_class'] || '';
          const g = row['Cinsiyet'] || row['gender'] || 'belirtilmedi';

          let normalizedGender = 'belirtilmedi';
          if (String(g).toLowerCase().startsWith('k')) normalizedGender = 'kiz';
          if (String(g).toLowerCase().startsWith('e')) normalizedGender = 'erkek';

          return {
            student_number: String(no).trim(),
            full_name: String(name).trim(),
            grade_class: String(cls).trim(),
            gender: normalizedGender,
          };
        })
        .filter((s) => s.student_number && s.full_name);

      if (parsedStudents.length === 0) {
        throw new Error('Dosyada geçerli "Okul No" ve "Ad Soyad" sütunları bulunamadı.');
      }

      const { error } = await supabase
        .from('students')
        .upsert(parsedStudents, { onConflict: 'student_number' });

      if (error) throw error;

      setMessage({
        text: `Dosyadan ${parsedStudents.length} öğrenci başarıyla içe aktarıldı.`,
        type: 'success',
      });
      loadStudents();
    } catch (err) {
      setMessage({ text: 'Dosya yükleme hatası: ' + err.message, type: 'error' });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Önce seçilen sınıfa, sonra arama kelimesine göre filtrele
  const filteredStudents = students.filter((st) => {
    const matchClass = selectedClass === 'ALL' || st.grade_class === selectedClass;
    const matchSearch =
      search === '' ||
      st.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      st.student_number?.includes(search) ||
      st.grade_class?.toLowerCase().includes(search.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div className="space-y-6 w-full antialiased">
      {/* Üst Command Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/85">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Okur Yönetimi</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
              {students.length} Kayıtlı Öğrenci
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Öğrenci Yönetimi</h1>
          <p className="text-xs text-slate-400">Öğrenci profilleri, şube sıralaması ve toplu işlemler</p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/ogrenci-kartlari"
            className="text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition shadow-2xs flex items-center gap-1.5"
          >
            🪪 <span>Öğrenci Kartları</span>
          </Link>
        </div>
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

      {/* Bento Grid: Excel İçe Aktarma & Tekil Öğrenci Kaydı */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sol: Excel / CSV Yükleme & Örnek Şablon */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white p-6 rounded-3xl border border-emerald-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-100/80 text-emerald-700 text-sm">📊</span>
              <h3 className="text-sm font-bold text-emerald-950">Toplu Excel / CSV Yükle</h3>
            </div>
            <p className="text-xs text-emerald-800/80 mt-2 leading-relaxed">
              e-Okuldan aldığınız listeyi seçerek yüzlerce öğrenciyi tek seferde aktarın.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              className={`w-full block text-center py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer shadow-md shadow-emerald-600/20 ${
                importLoading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {importLoading ? 'Aktarılıyor...' : '📁 Excel / CSV Dosyası Seç'}
            </label>

            <button
              type="button"
              onClick={downloadSampleExcel}
              className="w-full text-center py-1.5 px-2 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center justify-center gap-1 cursor-pointer transition"
            >
              <span>📥</span>
              <span>Örnek Excel (.xlsx) Şablonunu İndir</span>
            </button>
          </div>
        </div>

        {/* Sağ: Yeni Öğrenci Ekleme Formu */}
        <form
          onSubmit={handleAddStudent}
          className="lg:col-span-2 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm">🎓</span>
              <h3 className="text-sm font-bold text-slate-900">Tekil Öğrenci Kaydı</h3>
            </div>
            <p className="text-xs text-slate-400">Öğrenciyi cinsiyet ve fotoğraf bilgisiyle birlikte kaydedin.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Okul No *</label>
              <input
                type="text"
                placeholder="Örn: 142"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-indigo-500 bg-slate-50/70"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Ad Soyad *</label>
              <input
                type="text"
                placeholder="Öğrenci Adı Soyadı"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-indigo-500 bg-slate-50/70"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Sınıf / Şube</label>
              <input
                type="text"
                placeholder="Örn: 6A"
                value={gradeClass}
                onChange={(e) => setGradeClass(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-indigo-500 bg-slate-50/70"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Cinsiyet</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none bg-slate-50/70 font-semibold"
              >
                <option value="kiz">👧 Kız Öğrenci</option>
                <option value="erkek">👦 Erkek Öğrenci</option>
                <option value="belirtilmedi">⚪ Belirtilmedi</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Fotoğraf URL (İsteğe Bağlı)</label>
              <input
                type="text"
                placeholder="https://... (Fotoğraf linki)"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-indigo-500 bg-slate-50/70 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition cursor-pointer shadow-md shadow-indigo-500/20"
            >
              {loading ? 'Ekleniyor...' : '+ Öğrenciyi Kaydet'}
            </button>
          </div>
        </form>
      </div>

      {/* Kayıtlı Öğrenciler Listesi */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-4">
        
        {/* Üst Bar: Sınıf Filtreleme & Arama */}
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <h2 className="font-bold text-slate-900 text-sm">
                Kayıtlı Öğrenciler ({filteredStudents.length})
              </h2>
            </div>

            <div className="relative w-full sm:w-80">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                placeholder="İsim, numara veya sınıf ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Sınıf Şubelerine Göre Hızlı Filtre Butonları */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Şube Filtrele:</span>
            <button
              onClick={() => setSelectedClass('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedClass === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tümü ({students.length})
            </button>
            {classes.map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedClass === cls ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto px-4 sm:px-5 pb-4">
          {filteredStudents.length === 0 ? (
            <p className="p-12 text-center text-xs text-slate-400">Kayıt bulunamadı.</p>
          ) : (
            filteredStudents.map((st) => (
              <div
                key={st.id}
                className="py-3.5 flex justify-between items-center hover:bg-slate-50/70 transition group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {st.photo_url ? (
                    <img
                      src={st.photo_url}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                      st.gender === 'kiz'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : st.gender === 'erkek'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-indigo-600 text-white'
                    }`}>
                      {st.gender === 'kiz' ? '👧' : st.gender === 'erkek' ? '👦' : (st.full_name?.charAt(0) || 'Ö')}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/ogrenciler/${st.id}`}
                        className="font-bold text-slate-900 text-xs hover:text-indigo-600 hover:underline transition truncate"
                      >
                        {st.full_name}
                      </Link>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {st.grade_class || 'Sınıfsız'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Okul No: <strong className="text-slate-600">{st.student_number}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => startEdit(st)}
                    className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    ✏️ Düzenle
                  </button>
                  <Link
                    href={`/ogrenciler/${st.id}`}
                    className="text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition"
                  >
                    Karnesi →
                  </Link>
                  <span className="text-slate-200">|</span>
                  <button
                    onClick={() => handleDeleteStudent(st.id, st.full_name)}
                    className="text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DÜZENLEME MODAL PENCERESİ */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Öğrenci Bilgilerini Güncelle</h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Okul No</label>
                  <input
                    type="text"
                    value={editForm.student_number}
                    onChange={(e) => setEditForm({ ...editForm, student_number: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Sınıf / Şube</label>
                  <input
                    type="text"
                    value={editForm.grade_class}
                    onChange={(e) => setEditForm({ ...editForm, grade_class: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Cinsiyet</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-semibold"
                >
                  <option value="kiz">👧 Kız Öğrenci</option>
                  <option value="erkek">👦 Erkek Öğrenci</option>
                  <option value="belirtilmedi">⚪ Belirtilmedi</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Fotoğraf URL</label>
                <input
                  type="text"
                  value={editForm.photo_url}
                  onChange={(e) => setEditForm({ ...editForm, photo_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-md shadow-indigo-500/20"
                >
                  {loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}