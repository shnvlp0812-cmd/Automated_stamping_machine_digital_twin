import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes

// 1. Post live telemetry data from the machine
app.post('/api/telemetry', async (req, res) => {
    try {
        const { spm, cycle_time, parts_produced, press_status, coil_length, cut_length, material_remaining, date, shift, running_time, downtime, availability, performance, oee_score } = req.body;
        
        console.log(`[${new Date().toLocaleTimeString()}] Data Received! SPM: ${spm.toFixed(1)}, Parts: ${parts_produced}, OEE: ${oee_score}%`);

        const newTelemetry = await db.query(
            `INSERT INTO telemetry 
            (spm, cycle_time, parts_produced, press_status, coil_length, cut_length, material_remaining, production_date, shift, running_time, downtime, availability, performance, oee_score) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
            RETURNING *`,
            [spm, cycle_time, parts_produced, press_status, coil_length, cut_length, material_remaining, date, shift, running_time, downtime, availability, performance, oee_score]
        );
        
        res.json(newTelemetry.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 2. Get latest telemetry (for external dashboards)
app.get('/api/telemetry/latest', async (req, res) => {
    try {
        const latest = await db.query('SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 1');
        res.json(latest.rows[0] || {});
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 3. Get historical telemetry (for historical history viewer)
app.get('/api/telemetry/history', async (req, res) => {
    try {
        const history = await db.query('SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 50');
        res.json(history.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 4. Get all models
app.get('/api/models', async (req, res) => {
    try {
        const models = await db.query('SELECT * FROM models ORDER BY id ASC');
        res.json(models.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 5. Get all shapes
app.get('/api/shapes', async (req, res) => {
    try {
        const shapes = await db.query('SELECT * FROM shapes ORDER BY id ASC');
        res.json(shapes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 6. Post a completed production run
app.post('/api/production_runs', async (req, res) => {
    try {
        const { model_id, shape_id, target_count, parts_produced, downtime, running_time, production_date } = req.body;
        const newRun = await db.query(
            `INSERT INTO production_runs 
            (model_id, shape_id, target_count, parts_produced, downtime, running_time, production_date) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *`,
            [model_id, shape_id, target_count, parts_produced, downtime, running_time, production_date]
        );
        res.json(newRun.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 7. Get historical production runs
app.get('/api/production_runs/history', async (req, res) => {
    try {
        const history = await db.query(`
            SELECT pr.*, m.name as model_name, s.name as shape_name 
            FROM production_runs pr
            LEFT JOIN models m ON pr.model_id = m.id
            LEFT JOIN shapes s ON pr.shape_id = s.id
            ORDER BY pr.timestamp DESC LIMIT 50
        `);
        res.json(history.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Digital Twin Server running on port ${PORT}`);
});
