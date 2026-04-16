import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScanner({ onScanSuccess, onScanFailure }) {
  const [uniqueId] = useState(() => "reader-" + Math.random().toString(36).substring(2, 10));

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      uniqueId,
      { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [0] // Camera only
      },
      false
    );

    let isScanning = true;

    scanner.render((decodedText) => {
      if (isScanning) {
        onScanSuccess(decodedText);
      }
    }, (error) => {
      if (onScanFailure) {
        onScanFailure(error);
      }
    });

    return () => {
      isScanning = false;
      scanner.clear().catch(err => {
        console.error("Failed to clear scanner:", err);
      });
    };
  }, [uniqueId, onScanSuccess, onScanFailure]);

  return (
    <div className="w-full mx-auto overflow-hidden rounded-xl bg-white border-2 border-gray-100 p-4 shadow-sm text-gray-800">
      <div className="mb-2 text-sm text-center text-gray-500">กรุณากดปุ่ม Request Camera Permissions (หากมี) เพื่อเปิดกล้อง</div>
      <div id={uniqueId} className="w-full"></div>
    </div>
  );
}
