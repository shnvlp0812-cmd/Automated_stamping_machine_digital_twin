CREATE DATABASE digital_twin;

\c digital_twin;

-- 1. Machine Configurations (Replaces panelConfig.js)
CREATE TABLE machine_recipes (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    cut_length REAL NOT NULL,
    total_containers INTEGER NOT NULL,
    container_capacity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial seed data for recipes
INSERT INTO machine_recipes (model_id, name, cut_length, total_containers, container_capacity) VALUES
('back_panel', 'Back Panel (Default)', 1.3, 5, 25),
('front_panel_ac', 'Front Panel of AC', 1.3, 5, 25),
('side_panel_ac', 'Side Panels of AC', 0.8, 8, 25);

-- 2. Audit Logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'INFO'
);

-- 3. Telemetry (Time-series data)
CREATE TABLE telemetry (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    spm REAL,
    cycle_time REAL,
    parts_produced INTEGER,
    press_status VARCHAR(50),
    coil_length REAL,
    cut_length REAL,
    material_remaining REAL,
    production_date DATE,
    running_time REAL,
    downtime REAL,
    availability REAL,
    performance REAL,
    oee_score REAL,
    stored_parts INTEGER,
    full_containers INTEGER,
    estimated_additional INTEGER,
    potential_total_output INTEGER
);

-- 4. Production Runs (Historical run data)
CREATE TABLE production_runs (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(50) REFERENCES machine_recipes(model_id),
    target_count INTEGER,
    parts_produced INTEGER,
    downtime REAL,
    running_time REAL,
    production_date DATE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Active Simulation State (Snapshot of the current digital twin state)
CREATE TABLE simulation_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    current_model_id VARCHAR(50) REFERENCES machine_recipes(model_id),
    target_count INTEGER,
    is_playing BOOLEAN,
    safeguard_visible BOOLEAN,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
