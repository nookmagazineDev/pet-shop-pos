import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScanner({ onScanSuccess, onScanFailure }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    // Only initialize if we haven't already
    if (!document.getElementById('reader')) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        // Removed qrbox to scan using the full frame
        // Removed aspectRatio to let it use native phone camera ratio
        supportedScanTypes: [0] // 0 = Only camera, Hide file upload since we want mobile scanning
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
      scanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, [onScanSuccess, onScanFailure]);

  return (
    <div className="w-full mx-auto overflow-hidden rounded-xl bg-[#000000]">
      <div id="reader" ref={scannerRef} className="w-full border-none"></div>
    </div>
  );
}
