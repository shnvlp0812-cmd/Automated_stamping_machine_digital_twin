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
        const { spm, cycle_time, parts_produced, press_status, coil_length, cut_length, material_remaining, date, running_time, downtime, availability, performance, oee_score, stored_parts, full_containers, estimated_additional, potential_total_output } = req.body;
        
        console.log(`[${new Date().toLocaleTimeString()}] Telemetry | Status: ${press_status} | Parts: ${parts_produced} | Stored: ${stored_parts}`);

        const newTelemetry = await db.query(
            `INSERT INTO telemetry 
            (spm, cycle_time, parts_produced, press_status, coil_length, cut_length, material_remaining, production_date, running_time, downtime, availability, performance, oee_score, stored_parts, full_containers, estimated_additional, potential_total_output) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
            RETURNING *`,
            [spm, cycle_time, parts_produced, press_status, coil_length, cut_length, material_remaining, date, running_time, downtime, availability, performance, oee_score, stored_parts || 0, full_containers || 0, estimated_additional || 0, potential_total_output || 0]
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
        const { date } = req.query;
        let query = 'SELECT * FROM telemetry';
        const params = [];
        if (date) {
            query += ' WHERE DATE(timestamp) = $1';
            params.push(date);
        }
        query += ' ORDER BY timestamp DESC LIMIT 100';
        
        const history = await db.query(query, params);
        res.json(history.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 4. Get all machine recipes (Replaces hardcoded panelConfig.js)
app.get('/api/machine_recipes', async (req, res) => {
    try {
        const recipes = await db.query('SELECT * FROM machine_recipes ORDER BY id ASC');
        res.json(recipes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 5. Post a new machine recipe
app.post('/api/machine_recipes', async (req, res) => {
    try {
        const { model_id, name, cut_length, total_containers, container_capacity } = req.body;
        const newRecipe = await db.query(
            `INSERT INTO machine_recipes (model_id, name, cut_length, total_containers, container_capacity) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [model_id, name, cut_length, total_containers, container_capacity]
        );
        res.json(newRecipe.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 6. Post a completed production run
app.post('/api/production_runs', async (req, res) => {
    try {
        const { model_id, target_count, parts_produced, downtime, running_time, production_date } = req.body;

        const newRun = await db.query(
            `INSERT INTO production_runs 
            (model_id, target_count, parts_produced, downtime, running_time, production_date) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *`,
            [model_id, target_count, parts_produced, downtime, running_time, production_date]
        );
        res.json(newRun.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 6. Get historical production runs
app.get('/api/production_runs/history', async (req, res) => {
    try {
        const { date } = req.query;
        let query = `
            SELECT pr.*, mr.name as model_name 
            FROM production_runs pr
            LEFT JOIN machine_recipes mr ON pr.model_id = mr.model_id
        `;
        const params = [];
        if (date) {
            query += ` WHERE DATE(pr.production_date) = $1 `;
            params.push(date);
        }
        query += ` ORDER BY pr.timestamp DESC LIMIT 100 `;
        
        const history = await db.query(query, params);
        res.json(history.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 7. Post an audit log event
app.post('/api/audit_logs', async (req, res) => {
    try {
        const { event_type, description, severity } = req.body;
        const newLog = await db.query(
            `INSERT INTO audit_logs (event_type, description, severity) VALUES ($1, $2, $3) RETURNING *`,
            [event_type, description, severity || 'INFO']
        );
        res.json(newLog.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 8. Get historical audit logs
app.get('/api/audit_logs', async (req, res) => {
    try {
        const { date } = req.query;
        let query = 'SELECT * FROM audit_logs';
        const params = [];
        if (date) {
            query += ' WHERE DATE(timestamp) = $1';
            params.push(date);
        }
        query += ' ORDER BY timestamp DESC LIMIT 100';
        
        const history = await db.query(query, params);
        res.json(history.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 8.5 Get daily summary
app.get('/api/daily_summary', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.json([]);
        
        const summary = await db.query(`
            SELECT mr.name as model_name, SUM(pr.parts_produced) as total_parts
            FROM production_runs pr
            JOIN machine_recipes mr ON pr.model_id = mr.model_id
            WHERE DATE(pr.production_date) = $1
            GROUP BY mr.name
        `, [date]);
        res.json(summary.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// 9. Update Simulation State
app.post('/api/simulation_state', async (req, res) => {
    try {
        const { current_model_id, target_count, is_playing, safeguard_visible } = req.body;
        
        // Upsert logic for ID 1
        const state = await db.query(
            `INSERT INTO simulation_state (id, current_model_id, target_count, is_playing, safeguard_visible, last_updated) 
             VALUES (1, $1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET 
             current_model_id = EXCLUDED.current_model_id,
             target_count = EXCLUDED.target_count,
             is_playing = EXCLUDED.is_playing,
             safeguard_visible = EXCLUDED.safeguard_visible,
             last_updated = CURRENT_TIMESTAMP
             RETURNING *`,
            [current_model_id, target_count, is_playing, safeguard_visible]
        );
        res.json(state.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Digital Twin Server running on port ${PORT}`);
});
