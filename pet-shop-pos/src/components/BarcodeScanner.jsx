import { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

export default function BarcodeScanner({ onScanSuccess, onScanFailure, onClose }) {
  const [uniqueId] = useState(() => "reader-" + Math.random().toString(36).substring(2, 10));
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    // Disable body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    let html5QrCode;
    let isMounted = true;

    const startScanner = async () => {
      html5QrCode = new Html5Qrcode(uniqueId);
      
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (isMounted) onScanSuccess(decodedText);
          },
          (error) => {
            if (isMounted && onScanFailure) onScanFailure(error);
          }
        );
        if (isMounted) setIsStarting(false);
      } catch (err) {
        console.error("Camera start error:", err);
        if (isMounted) setIsStarting(false);
      }
    };

    // Need slight delay to ensure DOM element is ready
    setTimeout(() => {
      startScanner();
    }, 100);

    return () => {
      isMounted = false;
      document.body.style.overflow = 'auto'; // Restore scroll
      
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch(err => console.error("Stop error", err));
      } else if (html5QrCode) {
         html5QrCode.clear();
      }
    };
  }, [uniqueId, onScanSuccess, onScanFailure]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col justify-center animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/60 backdrop-blur-md text-white absolute top-0 w-full z-20">
        <h3 className="font-semibold flex items-center gap-2 text-lg">
          <Camera size={22} /> สแกนบาร์โค้ด
        </h3>
        <button onClick={onClose} className="p-2.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Main Scanner Container */}
      <div className="w-full h-full flex flex-col items-center justify-center relative bg-black">
        {isStarting && <div className="absolute text-white/70 animate-pulse text-lg z-10">กำลังเตรียมกล้อง...</div>}
        <div id={uniqueId} className="w-full max-w-lg aspect-[3/4] md:aspect-square sm:rounded-2xl overflow-hidden shadow-2xl relative z-10 flex items-center justify-center"></div>
      </div>
      
      {/* Footer Text */}
      <div className="p-6 pb-12 bg-gradient-to-t from-black via-black/80 to-transparent text-center absolute bottom-0 w-full z-20 pointer-events-none">
        <p className="text-white font-medium text-lg shadow-black drop-shadow-md">เล็งกล้องให้บาร์โค้ด หรือ QR Code อยู่ในกรอบ</p>
      </div>
    </div>
  );
}
