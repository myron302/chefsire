// client/src/components/BarcodeScanner.tsx
import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import { X } from "lucide-react";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          const tick = async () => {
            if (!readerRef.current || !videoRef.current) return;
            try {
              const result = await readerRef.current.decodeOnceFromVideoDevice(
                undefined,
                videoRef.current
              );
              if (result?.getText()) {
                stop();
                onDetected(result.getText());
              }
            } catch (e) {
              if (e instanceof NotFoundException) {
                // keep scanning
                requestAnimationFrame(tick);
              } else {
                setError("Scanner error. Please try again.");
              }
            }
          };
          requestAnimationFrame(tick);
        }
      } catch (e) {
        console.error(e);
        setError(
          "Camera access denied or unavailable. Please grant permission and try again."
        );
      }
    })();

    const stop = () => {
      try {
        if (videoRef.current && videoRef.current.srcObject) {
          (videoRef.current.srcObject as MediaStream)
            .getTracks()
            .forEach((t) => t.stop());
          videoRef.current.srcObject = null;
        }
        readerRef.current?.reset();
      } catch {}
    };

    return stop;
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md rounded-xl overflow-hidden bg-black">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 bg-white/90 rounded-full p-1"
          aria-label="Close scanner"
        >
          <X className="w-5 h-5" />
        </button>

        <video
          ref={videoRef}
          className="w-full h-[60vh] object-cover"
          muted
          playsInline
        />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Simple target box */}
          <div className="w-48 h-48 border-2 border-white/90 rounded-md" />
        </div>

        {error && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-sm p-2 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
