'use client';
import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScanner({ onScanSuccess, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'reader',
      {
        fps: 10,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScanSuccess(decodedText);
      },
      (error) => {
        // Okuma anındaki anlık kare tarama hataları sessiz geçilir
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-5 rounded-2xl max-w-sm w-full shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-semibold text-slate-800 text-sm">Kamera ile Barkod Okutun</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <div id="reader" className="overflow-hidden rounded-xl border border-slate-200"></div>

        <p className="text-xs text-center text-slate-500">
          Kitabın arkasındaki barkodu kamera alanının ortasına getirin.
        </p>
      </div>
    </div>
  );
}