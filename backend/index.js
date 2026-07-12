const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Use a secure fallback secret if one isn't defined in the .env file yet
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_defense_secret_key_2026';

// --- Security & Middleware ---
app.use(helmet());
app.use(cors()); // CORS successfully deployed
app.use(express.json());

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("[SYSTEM] Secure Vault Connected (MongoDB)"))
    .catch((err) => console.error("[ERROR] Vault Connection Failed:", err));


// --- Database Schemas (The Blueprints) ---

// 1. Threat Schema
const threatSchema = new mongoose.Schema({
    location: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, default: 'NORMAL' },
    status: { type: String, default: 'PENDING' },
    timestamp: { type: Date, default: Date.now }
});
const Threat = mongoose.model('Threat', threatSchema);

// 2. User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'OPERATOR' } // e.g., OPERATOR, COMMANDER, POLICE, MILITARY, PRESIDENT
});
const User = mongoose.model('User', userSchema);


// --- Security Middleware (The Gatekeeper) ---
const authenticateToken = (req, res, next) => {
    // Look for the token in the 'Authorization' header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Splits "Bearer <TOKEN>"

    if (!token) {
        console.log("[SECURITY ALERT] Unauthorized access attempt blocked: Missing Token.");
        return res.status(401).json({ error: "Access Denied. Security token required." });
    }

    // Cryptographically verify the token signature
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log("[SECURITY ALERT] Unauthorized access attempt blocked: Invalid or Tampered Token.");
            return res.status(403).json({ error: "Access Denied. Invalid or expired token." });
        }
        // Token is authentic! Store the user data in the request and proceed
        req.user = user;
        next();
    });
};


// --- Open Routes ---

// System Status Endpoint
app.get('/api/status', (req, res) => {
    res.status(200).json({ system: "Defense Central API", status: "Online and Secure" });
});

// Civilian Threat Reporting Endpoint (Open box so anyone can report)
app.post('/api/report-threat', async (req, res) => {
    try {
        const { location, description, severity } = req.body;
        if (!location || !description) {
            return res.status(400).json({ error: "Location and description are strictly required." });
        }
        const newThreat = await Threat.create({ location, description, severity });
        console.log(`[ALERT] Threat securely saved to Vault! Database ID: ${newThreat._id}`);
        res.status(201).json({ message: "Threat report securely stored.", trackingId: newThreat._id });
    } catch (error) {
        console.error("[ERROR] Failed to process threat:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// --- Authentication Endpoints ---

// 1. Operator Registration Route
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required." });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "Username is already registered in the system." });
        }

        // Cryptographically hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            username,
            password: hashedPassword,
            role: role || 'OPERATOR'
        });

        console.log(`[SYSTEM] New operator registered: ${username} [Role: ${newUser.role}]`);
        res.status(201).json({ message: "Operator successfully registered." });
    } catch (error) {
        console.error("[ERROR] Registration failed:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2. Operator Login Route (Issues the Badge)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Locate user in vault
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: "Invalid username or password credentials." });
        }

        // Check if password hash matches
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: "Invalid username or password credentials." });
        }

        // Generate the JWT badge containing user info (expires in 1 hour)
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log(`[SYSTEM] Operator successfully authenticated: ${username} [Role: ${user.role}]`);
        res.status(200).json({ message: "Authentication successful.", token: token });
    } catch (error) {
        console.error("[ERROR] Login failed:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// --- Protected Routes ---

// Military Command Feed (Defended by the authenticateToken middleware AND RBAC firewall)
app.get('/api/threats', authenticateToken, async (req, res) => {
    try {
        // 1. Identify the rank of the logged-in user
        const rank = req.user.role; 
        let dbFilter = {}; // Empty filter

        // 2. Apply the Security Clearance logic
        if (rank === 'POLICE') {
            dbFilter = { severity: 'NORMAL' }; // Only local issues
        } else if (rank === 'MILITARY') {
            dbFilter = { severity: 'HIGH' }; // Only national threats
        } else if (rank === 'PRESIDENT' || rank === 'COMMANDER') {
            dbFilter = {}; // Empty filter means "fetch everything"
        }

        // 3. Fetch only the data they are cleared to see
        const threats = await Threat.find(dbFilter).sort({ timestamp: -1 });
        
        console.log(`[SYSTEM] Secure Intel requested by ${req.user.username} (Clearance: ${rank}). Serving ${threats.length} reports.`);
        res.status(200).json(threats);
    } catch (error) {
        console.error("[ERROR] Failed to fetch intel:", error);
        res.status(500).json({ error: "Failed to retrieve threat data" });
    }
});

// Command Action Route (PATCH)
// Updates a threat's status. Protected by the gatekeeper!
app.patch('/api/threats/:id', authenticateToken, async (req, res) => {
    try {
        const threatId = req.params.id; // Grabs the ID from the URL
        const { status } = req.body;    // Grabs the new status from the payload

        // Enforce strict military protocols
        const validStatuses = ['PENDING', 'ENGAGED', 'RESOLVED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status code. Use PENDING, ENGAGED, or RESOLVED." });
        }

        // Find the specific threat and update its status
        const updatedThreat = await Threat.findByIdAndUpdate(
            threatId,
            { status: status },
            { new: true } // Tells MongoDB to hand us back the updated version
        );

        if (!updatedThreat) {
            return res.status(404).json({ error: "Threat not found in vault." });
        }

        console.log(`[COMMAND] ${req.user.username} updated threat ${threatId} to ${status}`);
        res.status(200).json(updatedThreat);
    } catch (error) {
        console.error("[ERROR] Failed to update threat:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Command Action Route (DELETE)
// Permanently erases a threat from the vault. Protected by the gatekeeper!
app.delete('/api/threats/:id', authenticateToken, async (req, res) => {
    try {
        const threatId = req.params.id;

        // Find the specific threat and obliterate it
        const deletedThreat = await Threat.findByIdAndDelete(threatId);

        if (!deletedThreat) {
            return res.status(404).json({ error: "Threat not found in vault." });
        }

        console.log(`[COMMAND] ${req.user.username} PERMANENTLY DELETED threat ${threatId}`);
        res.status(200).json({ message: "Threat successfully scrubbed from the vault." });
    } catch (error) {
        console.error("[ERROR] Failed to delete threat:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- Start the Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SYSTEM] Secure Server running on port ${PORT}`);
});