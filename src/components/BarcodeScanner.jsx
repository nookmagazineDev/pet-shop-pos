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
        qrbox: { width: 250, height: 250 }, 
        aspectRatio: 1.0,
        supportedScanTypes: [0] // 0 = Only camera, Hide file upload since we want mobile scanning
      },
      false
    );

    let isScanning = true;

    scanner.render((decodedText) => {
      if (isScanning) {
        onScanSuccess(decodedText);
        // After success, optionally pause or stop to prevent multiple scans of same item instantly
        // but we'll let parent handle it by hiding the component.
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

  // Use a minimal footprint
  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-xl bg-white p-2">
      <div id="reader" ref={scannerRef} className="w-full border-none"></div>
    </div>
  );
}
