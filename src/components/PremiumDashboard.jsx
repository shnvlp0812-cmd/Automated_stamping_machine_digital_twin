import React, { useEffect } from 'react';
import './PremiumDashboard.css';

export default function PremiumDashboard({
    rpm,
    feedRate,
    sliderValue,
    onSliderChange,
    isPlaying,
    onSetPlaying,
    pressStatus = 'WAITING',
    containerCount = 0,
    timers = { running: 0, idle: 0, downtime: 0 },
    selectedModel,
    setSelectedModel,
    selectedShape,
    setSelectedShape,
    targetCount,
    setTargetCount,
    safeGuardVisible,
    setSafeGuardVisible
}) {
    const [models, setModels] = React.useState([]);
    const [shapes, setShapes] = React.useState([]);

    useEffect(() => {
        fetch('http://localhost:5000/api/models').then(r => r.json()).then(setModels).catch(console.error);
        fetch('http://localhost:5000/api/shapes').then(r => r.json()).then(setShapes).catch(console.error);
    }, []);
    const cutLength = 1.3;
    const actualSPM = (feedRate / cutLength) || 0;
    const cycleTime = actualSPM > 0 ? (60 / actualSPM) : 0;

    const targetQuantity = targetCount || 500;
    const totalPartsProduced = containerCount;
    const totalCoilLength = 500.0;
    const materialRemaining = Math.max(0, totalCoilLength - (totalPartsProduced * cutLength));

    const todayDate = new Date().toISOString().split('T')[0];
    const shift = "Shift 1";

    const isRunning = pressStatus === 'FORMING' || pressStatus === 'DETECTING';
    const isFault = pressStatus === 'FAULT';
    const isOverflow = containerCount >= Math.min(targetCount, 230);

    // Save production run when machine stops
    const previousPlaying = React.useRef(isPlaying);
    useEffect(() => {
        if (previousPlaying.current === true && isPlaying === false) {
            // Machine just stopped, save the run if we have a model/shape selected
            if (selectedModel && selectedShape && totalPartsProduced > 0) {
                fetch('http://localhost:5000/api/production_runs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model_id: selectedModel,
                        shape_id: selectedShape,
                        target_count: targetCount,
                        parts_produced: totalPartsProduced,
                        downtime: timers.downtime,
                        running_time: timers.running,
                        production_date: todayDate
                    })
                }).catch(err => console.error("Failed to save production run:", err));
            }
        }
        previousPlaying.current = isPlaying;
    }, [isPlaying, selectedModel, selectedShape, targetCount, totalPartsProduced, timers, todayDate]);

    // Helper to format seconds to HH:MM:SS
    const formatTime = (totalSeconds) => {
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const availability = (timers.running + timers.downtime) > 0 ? (timers.running / (timers.running + timers.downtime)) : 0;
    const performance = (timers.running > 0) ? Math.min((totalPartsProduced / ((timers.running / 60) * sliderValue)), 1) : 0;
    const oeeScore = availability * performance * 1.0 * 100;

    // Push data to the backend every 2 seconds if running
    useEffect(() => {
        if (!isPlaying) return;
        const intervalId = setInterval(() => {
            fetch('http://localhost:5000/api/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    spm: actualSPM,
                    cycle_time: cycleTime,
                    parts_produced: totalPartsProduced,
                    press_status: pressStatus,
                    coil_length: totalCoilLength,
                    cut_length: cutLength,
                    material_remaining: materialRemaining,
                    date: todayDate,
                    shift: shift,
                    running_time: timers.running,
                    downtime: timers.downtime,
                    availability: availability * 100,
                    performance: performance * 100,
                    oee_score: oeeScore
                })
            }).catch(err => console.error("Telemetry sync failed:", err));
        }, 2000);

        return () => clearInterval(intervalId);
    }, [isPlaying, actualSPM, cycleTime, totalPartsProduced, pressStatus, materialRemaining, todayDate, shift, timers, availability, performance, oeeScore]);

    const [showHistory, setShowHistory] = React.useState(false);
    const [historyData, setHistoryData] = React.useState([]);

    const fetchHistory = () => {
        fetch('http://localhost:5000/api/production_runs/history')
            .then(res => res.json())
            .then(data => {
                setHistoryData(data);
                setShowHistory(true);
            })
            .catch(err => console.error("Failed to fetch history:", err));
    };

    return (
        <aside className="premium-dashboard">

            <div className="premium-panel">
                <div className="panel-header">Production Configuration</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <span className="metric-label">Model Variant</span>
                        <select
                            className="metric-value"
                            style={{ width: '100%', padding: '6px', marginTop: '4px', background: 'var(--panel-bg)', color: 'var(--text-light)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                        >
                            <option value=""> Select Model </option>
                            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <span className="metric-label">Shape</span>
                        <select
                            className="metric-value"
                            style={{ width: '100%', padding: '6px', marginTop: '4px', background: 'var(--panel-bg)', color: 'var(--text-light)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                            value={selectedShape}
                            onChange={(e) => setSelectedShape(e.target.value)}
                        >
                            <option value="">Select Shape</option>
                            {shapes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <span className="metric-label">Target Count</span>
                        <input
                            type="number"
                            min="1"
                            className="metric-value"
                            style={{ width: '100%', padding: '6px', marginTop: '4px', background: 'var(--panel-bg)', color: 'var(--text-light)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                            value={targetCount}
                            onChange={(e) => setTargetCount(parseInt(e.target.value) || 0)}
                        />
                    </div>
                </div>
            </div>

            <div className="premium-panel">
                <div className="panel-header">Machine Control</div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <button className="control-btn start" onClick={() => onSetPlaying(true)}>
                        START
                    </button>
                    <button className="control-btn stop" onClick={() => onSetPlaying(false)}>
                        STOP
                    </button>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                    <span className="metric-label" style={{ marginBottom: '8px', display: 'block' }}>Safeguard Control</span>
                    <div style={{ display: 'flex', gap: '20px', color: '#f8fafc', fontSize: '0.85rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="safeguard" 
                                checked={safeGuardVisible === true} 
                                onChange={() => setSafeGuardVisible(true)} 
                            />
                            ON
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="safeguard" 
                                checked={safeGuardVisible === false} 
                                onChange={() => setSafeGuardVisible(false)} 
                            />
                            OFF
                        </label>
                    </div>
                </div>

                <div>
                    <span className="metric-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Target SPM</span>
                        <span>{sliderValue.toFixed(0)} SPM</span>
                    </span>
                    <input
                        type="range"
                        min="10"
                        max="120"
                        step="1"
                        value={sliderValue}
                        onChange={(e) => onSliderChange(parseFloat(e.target.value))}
                        style={{ width: '100%', marginTop: '8px', cursor: 'pointer', accentColor: '#38bdf8' }}
                    />
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>
                        Target Cycle: {(60 / sliderValue).toFixed(2)}s
                    </div>
                </div>
            </div>

            <div className="premium-panel">
                <div className="panel-header">Machine Information</div>
                <div className="metric-grid">
                    <div className="metric">
                        <span className="metric-label">ID / Name</span>
                        <span className="metric-value" style={{ fontSize: '1rem' }}>PR-001</span>
                        <span className="metric-unit">Stamping Press A</span>
                    </div>
                    <div className="metric">
                        <span className="metric-label">Status</span>
                        <div className="status-indicator">
                            <span className={`status-dot ${!isPlaying ? 'fault' : isRunning ? '' : 'idle'}`}></span>
                            <span>{!isPlaying ? 'STOPPED' : pressStatus}</span>
                        </div>
                    </div>
                </div>
                <div className="metric-grid" style={{ marginTop: '16px' }}>
                    <div className="metric">
                        <span className="metric-label">Running Time</span>
                        <span className="metric-value" style={{ fontSize: '1.1rem' }}>{formatTime(timers.running)}</span>
                    </div>
                    <div className="metric">
                        <span className="metric-label">Downtime</span>
                        <span className="metric-value" style={{ fontSize: '1.1rem', color: '#f87171' }}>{formatTime(timers.downtime)}</span>
                    </div>
                </div>
            </div>


            <div className="premium-panel">
                <div className="panel-header">Production Output</div>
                <div className="metric-grid">
                    <div className="metric">
                        <span className="metric-label">Parts Produced</span>
                        <span className="metric-value success">
                            {totalPartsProduced}
                            <span className="metric-unit">/ {targetQuantity}</span>
                        </span>
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${(totalPartsProduced / targetQuantity) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    <div className="metric">
                        <span className="metric-label">Actual SPM</span>
                        <span className="metric-value highlight">
                            {actualSPM.toFixed(1)}
                            <span className="metric-unit">SPM</span>
                        </span>
                    </div>
                    <div className="metric">
                        <span className="metric-label">Cycle Time</span>
                        <span className="metric-value">
                            {cycleTime.toFixed(2)}
                            <span className="metric-unit">sec</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="premium-panel">
                <div className="panel-header">Material Tracking</div>
                <div className="metric-grid">
                    <div className="metric">
                        <span className="metric-label">Coil Length</span>
                        <span className="metric-value">
                            {totalCoilLength.toFixed(1)}
                            <span className="metric-unit">m</span>
                        </span>
                    </div>
                    <div className="metric">
                        <span className="metric-label">Cut Sheet</span>
                        <span className="metric-value">
                            {cutLength.toFixed(2)}
                            <span className="metric-unit">m</span>
                        </span>
                    </div>
                    <div className="metric" style={{ gridColumn: 'span 2' }}>
                        <span className="metric-label">Material Remaining</span>
                        <span className="metric-value">
                            {materialRemaining.toFixed(1)}
                            <span className="metric-unit">m ({((materialRemaining / totalCoilLength) * 100).toFixed(0)}%)</span>
                        </span>
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${(materialRemaining / totalCoilLength) * 100}%`, background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="premium-panel">
                <div className="panel-header">Overall Equipment Effectiveness (OEE)</div>
                <div className="metric-grid">
                    <div className="metric">
                        <span className="metric-label">Availability</span>
                        <span className="metric-value">
                            {((timers.running + timers.downtime) > 0 ? (timers.running / (timers.running + timers.downtime)) * 100 : 0).toFixed(1)}
                            <span className="metric-unit">%</span>
                        </span>
                        <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${(timers.running + timers.downtime) > 0 ? (timers.running / (timers.running + timers.downtime)) * 100 : 0}%`, background: '#8b5cf6', boxShadow: '0 0 8px #8b5cf6' }}></div>
                        </div>
                    </div>
                    <div className="metric">
                        <span className="metric-label">Performance</span>
                        <span className="metric-value">
                            {((timers.running > 0) ? Math.min((totalPartsProduced / ((timers.running / 60) * sliderValue)) * 100, 100) : 0).toFixed(1)}
                            <span className="metric-unit">%</span>
                        </span>
                    </div>
                    <div className="metric" style={{ gridColumn: 'span 2' }}>
                        <span className="metric-label">OEE Score</span>
                        <span className="metric-value highlight" style={{ color: '#a855f7', textShadow: '0 0 10px rgba(168, 85, 247, 0.5)' }}>
                            {((
                                ((timers.running + timers.downtime) > 0 ? (timers.running / (timers.running + timers.downtime)) : 0) *
                                ((timers.running > 0) ? Math.min((totalPartsProduced / ((timers.running / 60) * sliderValue)), 1) : 0) *
                                1.0 // Quality is 100%
                            ) * 100).toFixed(1)}
                            <span className="metric-unit">%</span>
                        </span>
                        <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${((((timers.running + timers.downtime) > 0 ? (timers.running / (timers.running + timers.downtime)) : 0) * ((timers.running > 0) ? Math.min((totalPartsProduced / ((timers.running / 60) * sliderValue)), 1) : 0)) * 100)}%`, background: '#a855f7', boxShadow: '0 0 8px #a855f7' }}></div>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={fetchHistory}
                style={{
                    background: 'rgba(56, 189, 248, 0.2)',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    letterSpacing: '1px',
                    pointerEvents: 'auto',
                    textTransform: 'uppercase'
                }}
            >
                View Database History
            </button>

            {showHistory && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: '#0f172a', border: '1px solid #334155', borderRadius: '12px',
                        padding: '24px', width: '90%', maxWidth: '900px', maxHeight: '80vh', overflowY: 'auto',
                        pointerEvents: 'auto', color: '#f8fafc'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#38bdf8' }}>Historical Database Logs</h2>
                            <button onClick={() => setShowHistory(false)} style={{
                                background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer'
                            }}>&times;</button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Timestamp</th>
                                    <th style={{ padding: '8px' }}>Model</th>
                                    <th style={{ padding: '8px' }}>Shape</th>
                                    <th style={{ padding: '8px' }}>Target</th>
                                    <th style={{ padding: '8px' }}>Parts Produced</th>
                                    <th style={{ padding: '8px' }}>Run Time (s)</th>
                                    <th style={{ padding: '8px' }}>Downtime (s)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyData.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                                        <td style={{ padding: '8px' }}>{new Date(row.timestamp).toLocaleString()}</td>
                                        <td style={{ padding: '8px', color: '#38bdf8' }}>{row.model_name || 'N/A'}</td>
                                        <td style={{ padding: '8px', color: '#4ade80' }}>{row.shape_name || 'N/A'}</td>
                                        <td style={{ padding: '8px' }}>{row.target_count}</td>
                                        <td style={{ padding: '8px' }}>{row.parts_produced}</td>
                                        <td style={{ padding: '8px' }}>{row.running_time}</td>
                                        <td style={{ padding: '8px', color: '#f87171' }}>{row.downtime}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {historyData.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                                No history found in database. Make sure the Node server is running and tracking.
                            </div>
                        )}
                    </div>
                </div>
            )}

        </aside>
    );
}
