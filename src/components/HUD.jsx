import React from 'react';

export default function HUD({
    rpm,
    feedRate,
    sliderValue,
    onSliderChange,
    isPlaying,
    onTogglePlay,
    pressStatus = 'WAITING',
    containerCount = 0
}) {
    return (
        <aside id="hud" aria-label="Decoiler Line Control Panel">
            <h1>DECOILER UNIT 04</h1>
            <div className="sub">Sheet Steel Uncoiling Station</div>

            <div className="readout-row">
                <span className="readout-label">SPINDLE SPEED</span>
                <span>
                    <span className="readout-value" id="rpmValue">{rpm.toFixed(1)}</span>
                    <span className="readout-unit">RPM</span>
                </span>
            </div>

            <input
                type="range"
                id="speedSlider"
                min="15"
                max="140"
                value={sliderValue}
                onChange={(e) => onSliderChange(parseFloat(e.target.value))}
                aria-label="Spindle speed target setting"
            />

            <div className="readout-row">
                <span className="readout-label">FEED VELOCITY</span>
                <span>
                    <span className="readout-value" id="feedValue">{feedRate.toFixed(1)}</span>
                    <span className="readout-unit">m/min*</span>
                </span>
            </div>

            <div className="status-grid">
                <div className="status-pill">
                    <span className="status-dot" style={{ backgroundColor: pressStatus === 'FORMING' ? '#ff3b30' : pressStatus === 'DETECTING' ? '#ffb400' : '#35d15a' }}></span>
                    <span className="status-text">PRESS: {pressStatus}</span>
                </div>
                <div className="status-pill">
                    <span className="status-text">PARTS: {containerCount} / 5</span>
                </div>
            </div>

            <button
                id="playBtn"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause production line' : 'Resume production line'}
            >
                {isPlaying ? 'PAUSE LINE' : 'RESUME LINE'}
            </button>

            <div className="stripe" aria-hidden="true"></div>
        </aside>
    );
}
