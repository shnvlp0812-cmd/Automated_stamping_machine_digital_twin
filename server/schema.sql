CREATE DATABASE digital_twin;

\c digital_twin;

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
    shift VARCHAR(50),
    running_time REAL,
    downtime REAL,
    availability REAL,
    performance REAL,
    oee_score REAL
);

CREATE TABLE models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE shapes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE production_runs (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES models(id),
    shape_id INTEGER REFERENCES shapes(id),
    target_count INTEGER,
    parts_produced INTEGER,
    downtime REAL,
    running_time REAL,
    production_date DATE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
