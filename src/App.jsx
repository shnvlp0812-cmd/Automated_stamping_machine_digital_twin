import React, { useState, useCallback } from 'react';
import DecoilerCanvas from './components/DecoilerCanvas';
import PremiumDashboard from './components/PremiumDashboard';
import { getPanelConfig } from './utils/panelConfig';
import './App.css';

export default function App() {
  const [sliderSPM, setSliderSPM] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [targetCount, setTargetCount] = useState(230);
  const [safeGuardVisible, setSafeGuardVisible] = useState(true);
  const [emptyTrigger, setEmptyTrigger] = useState(0);
  const [modelChangeTrigger, setModelChangeTrigger] = useState(0);
  const [isMaterialExhausted, setIsMaterialExhausted] = useState(false);
  const [showExhaustedDialog, setShowExhaustedDialog] = useState(false);
  const [stats, setStats] = useState({
    rpm: 0,
    feedRate: 0,
    pressStatus: 'WAITING',
    containerCount: 0,
    dashboardStats: {}
  });

  const [timers, setTimers] = useState({
    running: 0,
    idle: 0,
    downtime: 0
  });

  const logAudit = useCallback((eventType, description, severity = 'INFO') => {
    fetch('http://localhost:5000/api/audit_logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, description, severity })
    }).catch(e => console.error("Audit log failed:", e));
  }, []);

  React.useEffect(() => {
    fetch('http://localhost:5000/api/simulation_state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_model_id: selectedModel || 'back_panel',
        target_count: targetCount,
        is_playing: isPlaying,
        safeguard_visible: safeGuardVisible
      })
    }).catch(e => console.error("Sim state push failed:", e));
  }, [selectedModel, targetCount, isPlaying, safeGuardVisible]);

  const isPlayingRef = React.useRef(isPlaying);
  const pressStatusRef = React.useRef(stats.pressStatus);

  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Prevent double logging on mount by tracking first mount
  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!mountedRef.current) {
        mountedRef.current = true;
        return;
    }
    if (isPlaying) {
      logAudit('MACHINE_START', 'Operator started the production line.', 'INFO');
    } else {
      logAudit('MACHINE_STOP', 'Production line paused or stopped.', 'WARNING');
    }
  }, [isPlaying, logAudit]);

  React.useEffect(() => {
    pressStatusRef.current = stats.pressStatus;
  }, [stats.pressStatus]);

  React.useEffect(() => {
    if (stats.containerCount >= targetCount && isPlaying) {
      setIsPlaying(false);
    }
  }, [stats.containerCount, isPlaying, targetCount]);

  // Tick the timers every second
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const currentPlaying = isPlayingRef.current;
        const currentStatus = pressStatusRef.current;

        if (!currentPlaying || currentStatus === 'CONTAINERS FULL' || currentStatus === 'COIL OVER') {
          return { ...prev, downtime: prev.downtime + 1 };
        } else {
          return { ...prev, running: prev.running + 1 };
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    window.onMaterialExhaustedEvent = () => {
      logAudit('COIL_EXHAUSTED', 'Machine stopped due to material exhaustion.', 'CRITICAL');
      setIsPlaying(false);
      setIsMaterialExhausted(true);
      setShowExhaustedDialog(true);
      setStats(prev => ({ ...prev, pressStatus: 'COIL OVER' }));
    };
    return () => {
      delete window.onMaterialExhaustedEvent;
    };
  }, []);

  // Calculate RPM from target SPM so we don't break the model
  // FeedRate = SPM * cutLength. RPM = FeedRate / (2 * PI * 0.45)
  const pConfig = getPanelConfig(selectedModel);
  const derivedRPM = (sliderSPM * pConfig.cutLength) / 2.827433;

  const handleStatsUpdate = useCallback((newStats) => {
    setStats((prev) => {
      if (
        prev.rpm === newStats.rpm &&
        prev.feedRate === newStats.feedRate &&
        prev.pressStatus === newStats.pressStatus &&
        prev.containerCount === newStats.containerCount &&
        JSON.stringify(prev.dashboardStats) === JSON.stringify(newStats.dashboardStats)
      ) {
        return prev;
      }
      return newStats;
    });
  }, []);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleModelChange = (model) => {
    if (model !== selectedModel) {
      logAudit('MODEL_CHANGED', `Operator changed model to ${model || 'default'}.`, 'INFO');
      setSelectedModel(model);
      setIsPlaying(false);
      setIsMaterialExhausted(false);
      setModelChangeTrigger((prev) => prev + 1);
    }
  };

  return (
    <main className="app-viewport">
      <DecoilerCanvas
        sliderRPM={derivedRPM}
        isPlaying={isPlaying}
        onStatsUpdate={handleStatsUpdate}
        safeGuardVisible={safeGuardVisible}
        selectedModel={selectedModel}
        emptyTrigger={emptyTrigger}
        modelChangeTrigger={modelChangeTrigger}
      />

      <PremiumDashboard
        rpm={stats.rpm}
        feedRate={stats.feedRate}
        sliderValue={sliderSPM}
        onSliderChange={setSliderSPM}
        isPlaying={isPlaying}
        onSetPlaying={(val) => {
          if (isMaterialExhausted && val === true) return;
          setIsPlaying(val);
        }}
        pressStatus={isMaterialExhausted ? 'COIL OVER' : stats.pressStatus}
        containerCount={stats.containerCount}
        timers={timers}
        selectedModel={selectedModel}
        setSelectedModel={handleModelChange}
        targetCount={targetCount}
        setTargetCount={setTargetCount}
        safeGuardVisible={safeGuardVisible}
        setSafeGuardVisible={setSafeGuardVisible}
        onEmptyContainer={() => {
            logAudit('CONTAINER_EMPTIED', 'Operator emptied a full container from storage.', 'INFO');
            setEmptyTrigger(t => t + 1);
        }}
        dashboardStats={stats.dashboardStats}
      />

      <div id="hint" role="status">
        drag to orbit &middot; scroll to zoom
      </div>

      {showExhaustedDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#1a1d21', border: '1px solid #333', borderRadius: '8px',
            padding: '24px', width: '360px', color: '#f0f2f5',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontFamily: 'Inter, sans-serif'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: '#ef4444' }}>MATERIAL EXHAUSTED</h2>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5', color: '#a0a6b0' }}>
              The coil material has been exhausted.
            </p>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', lineHeight: '1.5', color: '#a0a6b0' }}>
              Production has stopped because there is not enough material remaining for the next part.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowExhaustedDialog(false)}
                style={{
                  background: '#2b3036', color: '#fff', border: '1px solid #4d5257',
                  padding: '8px 16px', borderRadius: '4px', cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
