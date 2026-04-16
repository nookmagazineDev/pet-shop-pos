import { useEffect, useRef, useId } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScanner({ onScanSuccess, onScanFailure }) {
  const uniqueId = useId().replace(/:/g, ''); // Generate stable unique ID per instance

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      uniqueId,
      { 
        fps: 10,
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
  }, []); // Run once on mount

  return (
    <div className="w-full mx-auto overflow-hidden rounded-xl bg-black">
      <div id={uniqueId} className="w-full"></div>
    </div>
  );
}

