import { useState, useEffect, useRef } from 'react';

export function useDeviceMotion() {
  const [acceleration, setAcceleration] = useState<number>(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const emaRef = useRef<number>(9.8);
  const ALPHA = 0.2;

  const requestPermission = async (): Promise<boolean> => {
    try {
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setPermissionGranted(true);
          return true;
        }
        return false;
      } else {
        // Non-iOS 13+ devices
        setPermissionGranted(true);
        return true;
      }
    } catch (error) {
      console.error('Error requesting device motion permission:', error);
      return false;
    }
  };

  useEffect(() => {
    if (!permissionGranted) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      let x = 0, y = 0, z = 0;
      
      // Prefer acceleration without gravity if available and meaningful, otherwise fallback to including gravity
      if (event.acceleration && (event.acceleration.x || event.acceleration.y || event.acceleration.z)) {
         x = event.acceleration.x || 0;
         y = event.acceleration.y || 0;
         z = event.acceleration.z || 0;
         
         const rawA = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
         emaRef.current = ALPHA * rawA + (1 - ALPHA) * emaRef.current;
         setAcceleration(emaRef.current);
      } else if (event.accelerationIncludingGravity) {
         x = event.accelerationIncludingGravity.x || 0;
         y = event.accelerationIncludingGravity.y || 0;
         z = event.accelerationIncludingGravity.z || 0;
         
         const rawA = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
         emaRef.current = ALPHA * rawA + (1 - ALPHA) * emaRef.current;
         // Subtract gravity approx 9.8
         const shakeIntensity = Math.abs(emaRef.current - 9.8);
         setAcceleration(shakeIntensity);
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [permissionGranted]);

  return { acceleration, requestPermission, permissionGranted };
}
