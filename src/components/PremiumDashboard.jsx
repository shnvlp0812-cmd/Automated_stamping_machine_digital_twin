import React, { useEffect } from 'react';
import { getPanelConfig } from '../utils/panelConfig';
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
    timers = { running: 0, downtime: 0 },
    selectedModel,
    setSelectedModel,
    targetCount,
    setTargetCount,
    safeGuardVisible,
    setSafeGuardVisible,
    onEmptyContainer,
    dashboardStats
}) {
    const { totalContainers, fullContainers, availableContainers, containerCapacity, storedParts, pendingParts, remainingStorageCapacity, estimatedAdditional, potentialTotalOutput } = dashboardStats || {};
    const [models, setModels] = React.useState([]);
    const [showAddModel, setShowAddModel] = React.useState(false);
    const [newModelForm, setNewModelForm] = React.useState({ model_id: '', name: '', cut_length: 1.0, total_containers: 5, container_capacity: 25 });

    const fetchModels = React.useCallback(() => {
        fetch('http://localhost:5000/api/machine_recipes')
            .then(res => res.json())
            .then(data => {
                const mappedModels = data.map(m => ({
                    id: m.model_id,
                    name: m.name,
                    cutLength: parseFloat(m.cut_length),
                    totalContainers: parseInt(m.total_containers),
                    capacity: parseInt(m.container_capacity)
                }));
                setModels(mappedModels);
                import('../utils/panelConfig').then(module => {
                    module.updatePanelConfig(data);
                });
            })
            .catch(err => console.error("Failed to fetch models:", err));
    }, []);

    useEffect(() => {
        fetchModels();
    }, [fetchModels]);

    const handleAddModelSubmit = (e) => {
        e.preventDefault();
        fetch('http://localhost:5000/api/machine_recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newModelForm)
        })
        .then(res => res.json())
        .then(() => {
            fetchModels();
            setShowAddModel(false);
            setNewModelForm({ model_id: '', name: '', cut_length: 1.0, total_containers: 5, container_capacity: 25 });
        })
        .catch(err => console.error("Failed to save new model:", err));
    };

    // Use dynamic config
    const config = getPanelConfig(selectedModel);
    const cutLength = config.cutLength;
    const actualSPM = (feedRate / cutLength) || 0;
    const cycleTime = actualSPM > 0 ? (60 / actualSPM) : 0;

    const targetQuantity = targetCount || 500;
    const totalPartsProduced = containerCount;
    const pendingProduction = Math.max(targetQuantity - totalPartsProduced, 0);
    const totalCoilLength = 500.0;
    const materialRemaining = pressStatus === 'COIL OVER' ? 0.0 : Math.max(0, totalCoilLength - ((totalPartsProduced * cutLength) || 0));

    const todayDate = new Date().toISOString().split('T')[0];

    const isRunning = pressStatus === 'FORMING' || pressStatus === 'DETECTING';

    // Save production run when machine stops
    const previousPlaying = React.useRef(isPlaying);
    useEffect(() => {
        if (previousPlaying.current === true && isPlaying === false) {
            // Machine just stopped, save the run if we have a model selected
            if (selectedModel && totalPartsProduced > 0) {
                fetch('http://localhost:5000/api/production_runs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model_id: selectedModel,
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
    }, [isPlaying, selectedModel, targetCount, totalPartsProduced, timers, todayDate]);

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

    // Store latest telemetry data in a ref to avoid resetting the interval
    const telemetryDataRef = React.useRef();
    useEffect(() => {
        telemetryDataRef.current = {
            spm: actualSPM,
            cycle_time: cycleTime,
            parts_produced: totalPartsProduced,
            press_status: pressStatus,
            coil_length: totalCoilLength,
            cut_length: cutLength,
            material_remaining: materialRemaining,
            date: todayDate,
            running_time: timers.running,
            downtime: timers.downtime,
            availability: availability * 100,
            performance: performance * 100,
            oee_score: oeeScore,
            stored_parts: storedParts || 0,
            full_containers: fullContainers || 0,
            estimated_additional: estimatedAdditional || 0,
            potential_total_output: potentialTotalOutput || 0
        };
    }, [actualSPM, cycleTime, totalPartsProduced, pressStatus, materialRemaining, todayDate, timers, availability, performance, oeeScore, storedParts, fullContainers, estimatedAdditional, potentialTotalOutput]);

    // Push data to the backend every 2 seconds continuously
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (telemetryDataRef.current) {
                fetch('http://localhost:5000/api/telemetry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(telemetryDataRef.current)
                }).catch(err => console.error("Telemetry sync failed:", err));
            }
        }, 2000);

        return () => clearInterval(intervalId);
    }, []);

    const [showHistory, setShowHistory] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('runs');
    const [historyData, setHistoryData] = React.useState([]);
    const [auditData, setAuditData] = React.useState([]);
    const [telemetryHistory, setTelemetryHistory] = React.useState([]);
    const [dailySummary, setDailySummary] = React.useState([]);
    const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0]);

    const fetchHistory = React.useCallback(() => {
        Promise.all([
            fetch(`http://localhost:5000/api/production_runs/history?date=${selectedDate}`).then(res => res.json()),
            fetch(`http://localhost:5000/api/audit_logs?date=${selectedDate}`).then(res => res.json()),
            fetch(`http://localhost:5000/api/telemetry/history?date=${selectedDate}`).then(res => res.json()),
            fetch(`http://localhost:5000/api/daily_summary?date=${selectedDate}`).then(res => res.json())
        ]).then(([runs, audits, telemetry, summary]) => {
            setHistoryData(Array.isArray(runs) ? runs : []);
            setAuditData(Array.isArray(audits) ? audits : []);
            setTelemetryHistory(Array.isArray(telemetry) ? telemetry : []);
            setDailySummary(Array.isArray(summary) ? summary : []);
            setShowHistory(true);
        }).catch(err => console.error("Failed to fetch history:", err));
    }, [selectedDate]);

    React.useEffect(() => {
        if (showHistory) fetchHistory();
    }, [selectedDate, fetchHistory]);

    return (
        <aside className="premium-dashboard">

            <div className="premium-panel">
                <div className="panel-header">Production Configuration</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <span className="metric-label">Model Variant</span>
                            <button 
                                onClick={() => setShowAddModel(true)}
                                style={{ background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 8px', cursor: 'pointer' }}>
                                + Add Model
                            </button>
                        </div>
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
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Production Output & Storage</span>
                    <button
                        onClick={onEmptyContainer}
                        disabled={(dashboardStats?.fullContainers || 0) <= 0}
                        style={{
                            background: (dashboardStats?.fullContainers || 0) <= 0 ? 'rgba(100, 100, 100, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            border: (dashboardStats?.fullContainers || 0) <= 0 ? '1px solid #666' : '1px solid #ef4444',
                            color: (dashboardStats?.fullContainers || 0) <= 0 ? '#666' : '#ef4444',
                            padding: '4px 8px', borderRadius: '4px',
                            cursor: (dashboardStats?.fullContainers || 0) <= 0 ? 'not-allowed' : 'pointer',
                            fontSize: '0.75rem',
                            opacity: (dashboardStats?.fullContainers || 0) <= 0 ? 0.5 : 1
                        }}
                    >
                        Empty 1 Full Container
                    </button>
                </div>
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
                        <span className="metric-label">Stored / Pending</span>
                        <span className="metric-value highlight">
                            {storedParts || 0}
                            <span className="metric-unit"> / {pendingProduction}</span>
                        </span>
                    </div>
                    <div className="metric">
                        <span className="metric-label">Containers (Full/Total)</span>
                        <span className="metric-value">
                            {fullContainers || 0}
                            <span className="metric-unit"> / {totalContainers || 0}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="premium-panel">
                <div className="panel-header">Material Tracking & Prediction</div>
                <div className="metric-grid">
                    <div className="metric">
                        <span className="metric-label">Required Cut Length</span>
                        <span className="metric-value">
                            {cutLength.toFixed(2)}
                            <span className="metric-unit">m</span>
                        </span>
                    </div>
                    <div className="metric">
                        <span className="metric-label">Est. Additional Parts</span>
                        <span className="metric-value" style={{ color: '#38bdf8' }}>
                            {estimatedAdditional || 0}
                        </span>
                    </div>
                    <div className="metric">
                        <span className="metric-label">Potential Total Output</span>
                        <span className="metric-value" style={{ color: '#a855f7' }}>
                            {potentialTotalOutput || 0}
                        </span>
                    </div>
                    <div className="metric" style={{ gridColumn: 'span 3' }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#38bdf8' }}>Historical Database Logs</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#f8fafc' }}
                                />
                                <button onClick={() => setShowHistory(false)} style={{
                                    background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer'
                                }}>&times;</button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                            <button onClick={() => setActiveTab('summary')} style={{ background: activeTab === 'summary' ? '#38bdf8' : '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Daily Summary</button>
                            <button onClick={() => setActiveTab('runs')} style={{ background: activeTab === 'runs' ? '#38bdf8' : '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Production Runs</button>
                            <button onClick={() => setActiveTab('audits')} style={{ background: activeTab === 'audits' ? '#38bdf8' : '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Audit Logs</button>
                            <button onClick={() => setActiveTab('telemetry')} style={{ background: activeTab === 'telemetry' ? '#38bdf8' : '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Telemetry (2s interval)</button>
                        </div>

                        {activeTab === 'summary' && (
                            <>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                                            <th style={{ padding: '8px' }}>Model Variant</th>
                                            <th style={{ padding: '8px' }}>Total Parts Produced </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailySummary.map((row, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                                                <td style={{ padding: '8px', color: '#38bdf8', fontWeight: 'bold' }}>{row.model_name || 'N/A'}</td>
                                                <td style={{ padding: '8px', color: '#10b981', fontSize: '1rem', fontWeight: 'bold' }}>{row.total_parts}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {dailySummary.length === 0 && (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                                        No production data found for {selectedDate}.
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'runs' && (
                            <>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                                            <th style={{ padding: '8px' }}>Timestamp</th>
                                            <th style={{ padding: '8px' }}>Model</th>
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
                                        No production runs found in database.
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'audits' && (
                            <>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                                            <th style={{ padding: '8px' }}>Timestamp</th>
                                            <th style={{ padding: '8px' }}>Event Type</th>
                                            <th style={{ padding: '8px' }}>Severity</th>
                                            <th style={{ padding: '8px' }}>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditData.map((row, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                                                <td style={{ padding: '8px' }}>{new Date(row.timestamp).toLocaleString()}</td>
                                                <td style={{ padding: '8px', fontWeight: 'bold' }}>{row.event_type}</td>
                                                <td style={{ padding: '8px', color: row.severity === 'CRITICAL' ? '#ef4444' : row.severity === 'WARNING' ? '#eab308' : '#38bdf8' }}>{row.severity}</td>
                                                <td style={{ padding: '8px' }}>{row.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {auditData.length === 0 && (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                                        No audit logs found.
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'telemetry' && (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem', whiteSpace: 'nowrap' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                                                <th style={{ padding: '8px' }}>Timestamp</th>
                                                <th style={{ padding: '8px' }}>Status</th>
                                                <th style={{ padding: '8px' }}>SPM</th>
                                                <th style={{ padding: '8px' }}>Cycle (s)</th>
                                                <th style={{ padding: '8px' }}>OEE %</th>
                                                <th style={{ padding: '8px' }}>Parts</th>
                                                <th style={{ padding: '8px' }}>Stored</th>
                                                <th style={{ padding: '8px' }}>Mat. Rem (m)</th>
                                                <th style={{ padding: '8px' }}>Predicted</th>
                                                <th style={{ padding: '8px' }}>Run Time</th>
                                                <th style={{ padding: '8px' }}>Downtime</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {telemetryHistory.map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                                                    <td style={{ padding: '8px' }}>{new Date(row.timestamp).toLocaleTimeString()}</td>
                                                    <td style={{ padding: '8px', color: '#10b981' }}>{row.press_status}</td>
                                                    <td style={{ padding: '8px' }}>{Number(row.spm).toFixed(1)}</td>
                                                    <td style={{ padding: '8px' }}>{Number(row.cycle_time).toFixed(2)}</td>
                                                    <td style={{ padding: '8px', color: '#eab308' }}>{Number(row.oee_score).toFixed(1)}%</td>
                                                    <td style={{ padding: '8px' }}>{row.parts_produced}</td>
                                                    <td style={{ padding: '8px' }}>{row.stored_parts}</td>
                                                    <td style={{ padding: '8px' }}>{Number(row.material_remaining).toFixed(1)}</td>
                                                    <td style={{ padding: '8px', color: '#a855f7' }}>{row.potential_total_output}</td>
                                                    <td style={{ padding: '8px' }}>{row.running_time}s</td>
                                                    <td style={{ padding: '8px', color: '#ef4444' }}>{row.downtime}s</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {telemetryHistory.length === 0 && (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                                        No telemetry data found for {selectedDate}.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Add Model Modal */}
            {showAddModel && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: '#0f172a', border: '1px solid #334155', borderRadius: '8px',
                        padding: '24px', width: '400px', maxWidth: '90%', color: '#f8fafc'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#38bdf8' }}>Add New Model</h2>
                            <button onClick={() => setShowAddModel(false)} style={{
                                background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer'
                            }}>&times;</button>
                        </div>
                        
                        <form onSubmit={handleAddModelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Model ID (no spaces)</label>
                                <input type="text" required value={newModelForm.model_id} onChange={e => setNewModelForm({...newModelForm, model_id: e.target.value})} style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Model Name</label>
                                <input type="text" required value={newModelForm.name} onChange={e => setNewModelForm({...newModelForm, name: e.target.value})} style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Cut Length (m)</label>
                                <input type="number" step="0.1" required value={newModelForm.cut_length} onChange={e => setNewModelForm({...newModelForm, cut_length: e.target.value})} style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Total Containers</label>
                                <input type="number" required value={newModelForm.total_containers} onChange={e => setNewModelForm({...newModelForm, total_containers: e.target.value})} style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Parts per Container</label>
                                <input type="number" required value={newModelForm.container_capacity} onChange={e => setNewModelForm({...newModelForm, container_capacity: e.target.value})} style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                            </div>
                            
                            <button type="submit" style={{
                                background: '#38bdf8', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', fontWeight: 'bold'
                            }}>
                                Save Model to Database
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </aside>
    );
}
