'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import JsBarcode from 'jsbarcode';
import { supabase } from '@/lib/supabase';

function BarcodeItem({ value }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        // Barkod için güvenli string oluşturma ve geçersiz karakterleri temizleme
        const safeValue = String(value || '').replace(/[^a-zA-Z0-9-_]/g, '').trim();
        
        if (safeValue.length > 0) {
          JsBarcode(svgRef.current, safeValue, {
            format: 'CODE128',
            width: 1.25,
            height: 34,
            displayValue: true,
            fontSize: 10,
            margin: 0,
          });
        }
      } catch (err) {
        console.error('Barkod çizilemedi:', err);
      }
    }
  }, [value]);

  return <svg ref={svgRef} className="max-w-full h-auto"></svg>;
}

export default function LabelsPage() {
  const [books, setBooks] = useState([]);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('books')
        .select('*')
        .order('title', { ascending: true });
      setBooks(data || []);
      setLoading(false);
    };
    fetchBooks();
  }, []);

  const toggleSelectBook = (id) => {
    setSelectedBooks((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedBooks.length === books.length) {
      setSelectedBooks([]);
    } else {
      setSelectedBooks(books.map((b) => b.id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const printableList = books.filter((b) =>
    selectedBooks.length > 0 ? selectedBooks.includes(b.id) : true
  );

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
          
          html, body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          body, main, div {
            position: static !important;
          }

          .print-full-width-container {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
            z-index: 999999 !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto antialiased print-full-width-container">
        
        {/* YAZDIRMA ESNASINDA GİZLENECEK KONTROL MERKEZİ */}
        <div className="print:hidden space-y-6">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Etiketleme Modülü</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                  {books.length} Kayıtlı Eser
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Barkod & Sırt Etiketi Yazdırma</h1>
              <p className="text-xs text-slate-400">Kitapların sırtına ve iç kapaklarına yapıştırmak için A4 baskı şablonu</p>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/kitaplar"
                className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition shadow-2xs flex items-center gap-1.5"
              >
                ← <span>Kitap Envanteri</span>
              </Link>
              <button
                onClick={handlePrint}
                className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>🖨️</span>
                <span>Etiketleri Yazdır</span>
              </button>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={selectAll}
                className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl transition cursor-pointer"
              >
                {selectedBooks.length === books.length ? 'Seçimi Temizle' : 'Tümünü Seç'}
              </button>
              <span className="text-xs text-slate-500 font-medium">
                {selectedBooks.length > 0 ? (
                  <span className="text-blue-600 font-bold">
                    {selectedBooks.length} kitap seçildi (sadece seçilenler basılacak)
                  </span>
                ) : (
                  <span>Tüm kitaplar basılacak ({books.length} adet)</span>
                )}
              </span>
            </div>

            <div className="relative w-full sm:w-80">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                placeholder="Listeden kitap filtrele..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xs max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
            {books
              .filter((b) => b.title?.toLowerCase().includes(search.toLowerCase()))
              .map((b) => {
                const isChecked = selectedBooks.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className="flex items-center justify-between p-3 hover:bg-slate-50/80 transition cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectBook(b.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer accent-blue-600"
                      />
                      <span className="font-bold text-slate-900">{b.title}</span>
                      <span className="text-slate-400 font-medium">({b.author || 'Yazar Yok'})</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                      Raf: {b.shelf_location || 'Belirtilmedi'}
                    </span>
                  </label>
                );
              })}
          </div>
        </div>

        {/* YAZDIRILACAK ALAN */}
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)] print:shadow-none print:border-none print:p-0 print:m-0">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 print:hidden">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Baskı Önizlemesi (A4 Sayfada 3'lü Kolon)
            </span>
            <span className="text-xs font-mono text-slate-400">
              Toplam: {printableList.length} Etiket
            </span>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 text-center py-12">Etiketler hazırlanıyor...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
              {printableList.map((book) => {
                // ISBN yoksa güvenli bir ID bazlı barkod kodu üretiyoruz
                const barcodeValue = book.isbn ? book.isbn : `1000${book.id}`;
                return (
                  <div
                    key={book.id}
                    className="border-2 border-dashed border-slate-300 rounded-2xl p-3 flex flex-col justify-between items-center text-center bg-white h-44 break-inside-avoid print:border-slate-400 shadow-2xs print:shadow-none"
                  >
                    <div className="w-full">
                      <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest block border-b border-slate-200 pb-0.5">
                        Hasköy Ortaokulu Kütüphanesi
                      </span>
                      <h3 className="font-black text-xs text-slate-900 mt-1 line-clamp-1">
                        {book.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
                        {book.author || 'Yazar Belirtilmedi'}
                      </p>
                    </div>

                    <div className="my-1 flex items-center justify-center">
                      <BarcodeItem value={barcodeValue} />
                    </div>

                    <div className="w-full flex justify-between items-center text-[10px] font-bold border-t border-slate-100 pt-1 text-slate-700 font-mono">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                        Raf: {book.shelf_location || 'Yok'}
                      </span>
                      <span className="text-slate-400">
                        ID: #{book.id}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}