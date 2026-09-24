import { useState, useRef, useEffect, useCallback } from 'react';

export function useTorch() {
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      const track = stream.getVideoTracks()[0];
      
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
        setHasTorch(true);
        trackRef.current = track;
        return true;
      } else {
        // No torch capability
        track.stop();
        return false;
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
    };
  }, [setTorchState]);

  return { hasTorch, initCamera, setTorchState };
}
