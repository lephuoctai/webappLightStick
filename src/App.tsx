import { useState, useEffect, useRef, useCallback } from 'react';
import { useDeviceMotion } from './hooks/useDeviceMotion';
import { useTorch } from './hooks/useTorch';

type AppState = 'onboarding' | 'idle' | 'cheering';

function App() {
  const [appState, setAppState] = useState<AppState>('onboarding');
  const [score, setScore] = useState<number>(0);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  
  const { acceleration, requestPermission: requestMotionPerm } = useDeviceMotion();
  const { hasTorch, initCamera, setTorchState } = useTorch();

  const accelerationRef = useRef<number>(0);
  const isFlashingRef = useRef<boolean>(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const loopTimeoutRef = useRef<number | null>(null);

  // Sync acceleration to ref for the loop to read latest without closure issues
  useEffect(() => {
    accelerationRef.current = acceleration;
  }, [acceleration]);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const handleStart = async () => {
    await requestMotionPerm();
    await initCamera();
    await requestWakeLock();
    setAppState('idle');
  };

  const toggleFlash = useCallback(() => {
    const nextState = !isFlashingRef.current;
    isFlashingRef.current = nextState;
    setIsFlashing(nextState);
    setTorchState(nextState);
    
    if (nextState) {
      const a = accelerationRef.current;
      setScore(prev => prev + Math.floor(a));
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  }, [setTorchState]);

  // Main loop
  useEffect(() => {
    if (appState === 'onboarding') return;

    const runLoop = () => {
      const a = accelerationRef.current;
      
      if (a < 6) {
        // Stopped or Idle
        if (isFlashingRef.current) {
          isFlashingRef.current = false;
          setIsFlashing(false);
          setTorchState(false);
        }
        if (appState !== 'idle') setAppState('idle');
        
        // Check again after a bit
        loopTimeoutRef.current = window.setTimeout(runLoop, 200);
        return;
      }

      // Cheering
      if (appState !== 'cheering') setAppState('cheering');

      // T(A) interpolates from A=6 (3000ms) to A=25 (50ms)
      let t = 3000 - ((a - 6) * 2950) / 19;
      if (t < 50) t = 50;
      if (t > 3000) t = 3000;

      toggleFlash();

      loopTimeoutRef.current = window.setTimeout(runLoop, t);
    };

    runLoop();

    return () => {
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };
  }, [appState, toggleFlash, setTorchState]);

  // Cleanup Wake Lock
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, []);

  // Decrease score when idle
  useEffect(() => {
    if (appState !== 'idle') return;

    const intervalId = setInterval(() => {
      setScore(prev => Math.max(0, prev - 10));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [appState]);

  const bgClass = isFlashing ? (hasTorch ? 'bg-zinc-900' : 'bg-white') : 'bg-black';
  const textClass = isFlashing && !hasTorch ? 'text-black' : 'text-white';

  if (appState === 'onboarding') {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-black text-white p-6">
        <h1 className="text-4xl font-bold mb-4 text-center">Shake-to-Cheer</h1>
        <p className="text-center text-gray-400 mb-8 max-w-md">
          Biến điện thoại của bạn thành một lightstick cuồng nhiệt! 
          Lắc điện thoại để cổ vũ, lắc càng mạnh đèn chớp càng nhanh.
        </p>
        <button 
          onClick={handleStart}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-full text-xl shadow-[0_0_15px_rgba(147,51,234,0.5)] transition-all active:scale-95"
        >
          BẮT ĐẦU CỔ VŨ
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-75 ${bgClass} ${textClass}`}>
      <div className="absolute top-10 left-0 w-full text-center">
        <div className="text-sm uppercase tracking-widest opacity-70 mb-1">Điểm Cuồng Nhiệt</div>
        <div className="text-6xl font-black font-mono">{score.toLocaleString()}</div>
      </div>
      
      <div className="flex flex-col items-center justify-center">
        {appState === 'idle' ? (
          <div className="text-2xl opacity-50 animate-pulse">
            Bắt đầu lắc điện thoại!
          </div>
        ) : (
          <div className="text-4xl font-bold italic opacity-90 tracking-wider">
            CHEERING!
          </div>
        )}
      </div>

      <div className="absolute bottom-10 left-0 w-full text-center opacity-40 text-sm">
        Gia tốc: {acceleration.toFixed(1)} m/s²
        <br />
        Chế độ: {hasTorch ? 'Flash Camera' : 'Chớp Màn Hình'}
      </div>
    </div>
  );
}

export default App;
