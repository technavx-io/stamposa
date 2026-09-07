'use client';

import { useEffect, useRef, useState } from 'react';
import { CameraOff } from 'lucide-react';
import { Spinner } from '@/components/ui/surface';

/**
 * Live camera QR scanner. Uses the native BarcodeDetector where the browser
 * has one (Chrome, Edge, Android WebView) and falls back to jsQR — a pure-JS
 * decoder run on canvas frames — everywhere else (Safari/iOS). Camera access
 * needs HTTPS or localhost.
 */
export function QrScanner({ onDecode }: { onDecode: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const decodedRef = useRef(false);
  const [state, setState] = useState<'starting' | 'scanning' | 'denied' | 'unavailable'>(
    'starting',
  );

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        });
      } catch {
        if (!cancelled) setState('denied');
        return;
      }
      if (cancelled || !videoRef.current) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (cancelled) return;
      setState('scanning');

      const hit = (text: string) => {
        if (decodedRef.current || !text) return;
        decodedRef.current = true;
        navigator.vibrate?.(80);
        stop();
        onDecode(text);
      };

      type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
      const DetectorCtor = (
        window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
        }
      ).BarcodeDetector;

      if (DetectorCtor) {
        const detector = new DetectorCtor({ formats: ['qr_code'] });
        timer = setInterval(() => {
          if (video.readyState < 2) return;
          detector
            .detect(video)
            .then((codes) => codes[0] && hit(codes[0].rawValue))
            .catch(() => undefined);
        }, 220);
        return;
      }

      const jsQR = (await import('jsqr')).default;
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      timer = setInterval(() => {
        if (!ctx || video.readyState < 2) return;
        const scale = 480 / Math.max(video.videoWidth, 1);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        });
        if (found?.data) hit(found.data);
      }, 260);
    };

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [onDecode]);

  if (state === 'denied' || state === 'unavailable') {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl bg-surface-2 text-center">
        <CameraOff className="size-6 text-muted" />
        <p className="max-w-60 text-sm text-muted">
          {state === 'denied'
            ? 'Camera access was blocked. Allow it in the browser, or type the code instead.'
            : 'No camera available here — type the customer code instead.'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-zinc-900">
      <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
      {state === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-6 text-white" />
        </div>
      )}
      {/* viewfinder */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="size-40 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      <p className="absolute inset-x-0 bottom-2 text-center text-xs font-medium text-white/80">
        Point at the QR on the customer&apos;s card
      </p>
    </div>
  );
}
