import React, { useState, useCallback } from 'react';
import DecoilerCanvas from './components/DecoilerCanvas';
import PremiumDashboard from './components/PremiumDashboard';
import './App.css';

export default function App() {
  const [sliderSPM, setSliderSPM] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedShape, setSelectedShape] = useState('');
  const [targetCount, setTargetCount] = useState(230);
  const [safeGuardVisible, setSafeGuardVisible] = useState(true);
  const [stats, setStats] = useState({
    rpm: 0,
    feedRate: 0,
    pressStatus: 'WAITING',
    containerCount: 0
  });

  const [timers, setTimers] = useState({
    running: 0,
    idle: 0,
    downtime: 0
  });

  const isPlayingRef = React.useRef(isPlaying);
  const pressStatusRef = React.useRef(stats.pressStatus);

  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  React.useEffect(() => {
    pressStatusRef.current = stats.pressStatus;
  }, [stats.pressStatus]);

  React.useEffect(() => {
    // Max physical capacity across 10 containers is 230
    const actualTarget = Math.min(targetCount, 230);
    if (stats.containerCount >= actualTarget && isPlaying) {
      setIsPlaying(false);
    }
  }, [stats.containerCount, isPlaying, targetCount]);

  // Tick the timers every second
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const currentPlaying = isPlayingRef.current;
        const currentStatus = pressStatusRef.current;
        
        if (!currentPlaying) {
          return { ...prev, downtime: prev.downtime + 1 };
        } else {
          return { ...prev, running: prev.running + 1 };
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate RPM from target SPM so we don't break the model
  // FeedRate = SPM * 1.3. RPM = FeedRate / (2 * PI * 0.45)
  const derivedRPM = (sliderSPM * 1.3) / 2.827433;

  const handleStatsUpdate = useCallback((newStats) => {
    setStats((prev) => {
      if (
        prev.rpm === newStats.rpm &&
        prev.feedRate === newStats.feedRate &&
        prev.pressStatus === newStats.pressStatus &&
        prev.containerCount === newStats.containerCount
      ) {
        return prev;
      }
      return newStats;
    });
  }, []);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  return (
    <main className="app-viewport">
      <DecoilerCanvas
        sliderRPM={derivedRPM}
        isPlaying={isPlaying}
        onStatsUpdate={handleStatsUpdate}
        targetCount={targetCount}
        safeGuardVisible={safeGuardVisible}
      />

      <PremiumDashboard
        rpm={stats.rpm}
        feedRate={stats.feedRate}
        sliderValue={sliderSPM}
        onSliderChange={setSliderSPM}
        isPlaying={isPlaying}
        onSetPlaying={setIsPlaying}
        pressStatus={stats.pressStatus}
        containerCount={stats.containerCount}
        timers={timers}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        selectedShape={selectedShape}
        setSelectedShape={setSelectedShape}
        targetCount={targetCount}
        setTargetCount={setTargetCount}
        safeGuardVisible={safeGuardVisible}
        setSafeGuardVisible={setSafeGuardVisible}
      />

      <div id="hint" role="status">
        drag to orbit &middot; scroll to zoom
      </div>
    </main>
  );
}
