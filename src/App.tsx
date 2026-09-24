import { useState, useEffect, useRef, useCallback } from 'react';
import { useDeviceMotion } from './hooks/useDeviceMotion';
import { useTorch } from './hooks/useTorch';

type AppState = 'onboarding' | 'idle' | 'cheering';

function App() {
  const [appState, setAppState] = useState<AppState>('onboarding');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('lightstick_high_score') || '0', 10);
  });
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  
  const { acceleration, requestPermission: requestMotionPerm } = useDeviceMotion();
  const { hasTorch, initCamera, setTorchState } = useTorch();

  // Track high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('lightstick_high_score', score.toString());
    }
  }, [score, highScore]);

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

      // T(A) interpolates from A=6 (2000ms) to A=15 (50ms)
      let t = 2000 - ((a - 6) * 1950) / 9;
      if (t < 50) t = 50;
      if (t > 2000) t = 2000;

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
      setScore(prev => {
        // Mức điểm trừ = mức điểm cuồng nhiệt * 3%
        const deduction = Math.ceil(prev * 0.03);
        return Math.max(0, prev - deduction);
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [appState]);

  if (appState === 'onboarding') {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-black text-white p-6 z-50 relative">
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

  // Calculate sliding percentage
  // 100 points = 1% translation progress. Max progress is 100% (at 10,000 points).
  const slideProgress = Math.min(score / 100, 100);
  
  // Div height is 1100vh. To slide it so the bottom 100vh is visible,
  // we need to translate by -1000vh.
  // As a percentage of the div's height (1100vh), 1000vh is ~90.909%.
  const translateY = (slideProgress / 100) * 90.909;

  // Middle text points change
  const currentDeduction = Math.ceil(score * 0.03);
  const addedPoints = Math.floor(acceleration);

  return (
    <div className="relative w-full h-full overflow-hidden text-white bg-black">
      
      {/* Sliding Gradient Background */}
      <div 
        className="absolute top-0 left-0 w-full transition-transform duration-1000 ease-linear"
        style={{
          height: '1100vh',
          background: 'linear-gradient(to bottom, #000000 0%, #0f172a 10%, #1e3a8a 20%, #1d4ed8 30%, #3b82f6 40%, #06b6d4 50%, #10b981 60%, #eab308 70%, #f97316 80%, #ef4444 90%, #991b1b 100%)',
          transform: `translateY(-${translateY}%)`
        }}
      />

      {/* Flash Overlay */}
      <div 
        className={`absolute inset-0 z-10 transition-colors duration-75 ${
          isFlashing ? (hasTorch ? 'bg-black/10' : 'bg-white') : 'bg-transparent'
        }`} 
      />

      {/* Content */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        <div className="absolute top-10 left-0 w-full text-center">
          <div className="text-sm uppercase tracking-widest opacity-90 mb-1">Điểm Cuồng Nhiệt</div>
          <div className="text-6xl font-black font-mono text-white">{score.toLocaleString()}</div>
          <div className="text-xs uppercase tracking-widest opacity-70 mt-2 text-yellow-300">
            Highest: {highScore.toLocaleString()}
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center">
          <div className={`text-6xl font-bold italic tracking-wider ${appState === 'cheering' ? 'text-green-400' : 'text-red-400'}`}>
            {appState === 'cheering' ? `+ ${addedPoints}` : `- ${currentDeduction}`}
          </div>
        </div>

        <div className="absolute bottom-10 left-0 w-full text-center opacity-80 text-sm text-white font-medium">
          Gia tốc: {acceleration.toFixed(1)} m/s²
          <br />
          Chế độ: {hasTorch ? 'Flash Camera' : 'Chớp Màn Hình'}
        </div>
      </div>
    </div>
  );
}

export default App;
