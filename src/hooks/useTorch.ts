import { useState, useRef, useEffect, useCallback } from 'react';

export function useTorch() {
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      const track = stream.getVideoTracks()[0];
      
      // Bind to a hidden video element to ensure the stream stays active
      // (Required on some mobile browsers for torch to work)
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('autoplay', '');
      video.setAttribute('playsinline', '');
      video.style.display = 'none';
      document.body.appendChild(video);
      videoRef.current = video;

      // Wait a moment for capabilities to be populated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch || 'torch' in capabilities) {
        setHasTorch(true);
        trackRef.current = track;
        return true;
      } else {
        // Fallback: try enabling it anyway to see if it throws
        try {
          await track.applyConstraints({ advanced: [{ torch: false }] } as any);
          setHasTorch(true);
          trackRef.current = track;
          return true;
        } catch (e) {
          track.stop();
          video.remove();
          videoRef.current = null;
          return false;
        }
      }
    } catch (error) {
      console.warn('Camera access denied or no torch available:', error);
      return false;
    }
  }, []);

  const setTorchState = useCallback(async (on: boolean) => {
    if (trackRef.current && hasTorch) {
      try {
        await trackRef.current.applyConstraints({
          advanced: [{ torch: on } as any]
        });
      } catch (error) {
        console.error('Error setting torch state:', error);
      }
    }
  }, [hasTorch]);

  useEffect(() => {
    return () => {
      if (trackRef.current) {
        setTorchState(false);
        trackRef.current.stop();
      }
      if (videoRef.current) {
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, [setTorchState]);

  return { hasTorch, initCamera, setTorchState };
}
