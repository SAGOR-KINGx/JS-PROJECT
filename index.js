const { spawn } = require("child_process");
const axios = require("axios");
const logger = require("./utils/log");
const express = require('express');
const path = require('path');

/* ==================== 🔥 SAGOR BOT LAUNCHER 🔥 ==================== */

console.log("\n" + "=".repeat(60));
console.log("🚀 SAGOR BOT - LAUNCHER SYSTEM 🚀");
console.log("=".repeat(60) + "\n");

// ==================== WEBSITE FOR UPTIME/DASHBOARD ====================

const app = express();
const port = process.env.PORT || 5000;

// Configure Express
app.set('trust proxy', true);
app.set('json spaces', 2);

// Middleware
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Powered-By', 'SAGOR BOT');
    next();
});

// Serve HTML dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/includes/index.html'));
});

// Bot status endpoint
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        botName: 'SAGOR BOT',
        uptime: process.uptime(),
        restartCount: global.countRestart || 0,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
    console.log("\n" + "=".repeat(50));
    console.log(`🌐 WEB DASHBOARD: http://localhost:${port}`);
    console.log(`📊 STATUS: http://localhost:${port}/status`);
    console.log(`🩺 HEALTH: http://localhost:${port}/health`);
    console.log("=".repeat(50) + "\n");

    logger(`Server running on port ${port}`, "[ WEB ]");
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        logger(`⚠️ Port ${port} is already in use!`, "[ ERROR ]");
        logger(`Trying alternative port ${port + 1}...`, "[ WEB ]");

        // Try next port
        server.close();
        app.listen(port + 1, '0.0.0.0', () => {
            logger(`Server running on port ${port + 1}`, "[ WEB ]");
        });
    } else if (err.code === 'EACCES') {
        logger(`❌ Permission denied for port ${port}`, "[ ERROR ]");
    } else {
        logger(`❌ Server error: ${err.message}`, "[ ERROR ]");
    }
});

// ==================== BOT PROCESS MANAGEMENT ====================

// Initialize global variables
global.countRestart = global.countRestart || 0;
global.botProcess = null;
global.maxRestarts = 10;
global.restartDelay = 5000; // 5 seconds

// Configuration
const BOT_SCRIPT = "SaGor.js";
const NODE_OPTIONS = ["--trace-warnings", "--async-stack-traces", "--max-old-space-size=512"];

/**
 * Start the bot process
 * @param {string} message - Optional start message
 */
function startBot(message) {
    if (message) {
        console.log("\n" + "=".repeat(50));
        console.log(`🤖 ${message}`);
        console.log("=".repeat(50) + "\n");
    }

    // Check if bot script exists
    const fs = require('fs');
    if (!fs.existsSync(path.join(__dirname, BOT_SCRIPT))) {
        logger(`❌ Bot script "${BOT_SCRIPT}" not found!`, "[ ERROR ]");
        logger(`📁 Current directory: ${__dirname}`, "[ DEBUG ]");
        logger(`📄 Available files: ${fs.readdirSync(__dirname).join(', ')}`, "[ DEBUG ]");
        return;
    }

    // Spawn bot process
    const botProcess = spawn("node", [...NODE_OPTIONS, BOT_SCRIPT], {
        cwd: __dirname,
        stdio: "inherit",
        shell: true,
        env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || 'production'
        }
    });

    // Store process reference
    global.botProcess = botProcess;

    // Log process ID
    logger(`Bot started with PID: ${botProcess.pid}`, "[ BOT ]");

    // Handle process exit
    botProcess.on("close", (code, signal) => {
        const exitCode = code !== null ? code : signal;

        if (exitCode !== 0 && global.countRestart < global.maxRestarts) {
            global.countRestart++;

            console.log("\n" + "!".repeat(50));
            logger(`Bot exited with code ${exitCode}`, "[ EXIT ]");
            logger(`Restart attempt ${global.countRestart}/${global.maxRestarts}...`, "[ RESTART ]");
            console.log("!".repeat(50) + "\n");

            // Wait before restarting
            setTimeout(() => {
                startBot(`Restarting bot (${global.countRestart}/${global.maxRestarts})...`);
            }, global.restartDelay);

        } else if (exitCode !== 0) {
            console.log("\n" + "!".repeat(50));
            logger(`Bot stopped after ${global.countRestart} restart attempts`, "[ STOPPED ]");
            logger("Maximum restart limit reached. Please check manually.", "[ ERROR ]");
            console.log("!".repeat(50) + "\n");

        } else {
            console.log("\n" + "=".repeat(50));
            logger("Bot stopped normally", "[ STOPPED ]");
            console.log("=".repeat(50) + "\n");
        }
    });

    // Handle process errors
    botProcess.on("error", (error) => {
        console.log("\n" + "!".repeat(50));
        logger(`Process error: ${error.message}`, "[ ERROR ]");

        if (error.code === 'ENOENT') {
            logger("Node.js may not be installed or in PATH", "[ ERROR ]");
        }
        console.log("!".repeat(50) + "\n");
    });

    // Handle process disconnect
    botProcess.on("disconnect", () => {
        logger("Bot process disconnected", "[ WARN ]");
    });

    // Handle stdout/stderr
    botProcess.stdout?.on('data', (data) => {
        // Pass through, already handled by inherit
    });

    botProcess.stderr?.on('data', (data) => {
        // Pass through, already handled by inherit
    });
}

// ==================== GITHUB UPDATE CHECKER ====================

/**
 * Check for updates from GitHub repository
 */
async function checkForUpdates() {
    const GITHUB_REPO = "SAGOR-KINGx/JS-PROJECT"; // Change this to your repo
    const CURRENT_VERSION = require('./package.json').version;

    try {
        console.log("\n" + "-".repeat(50));
        logger("Checking for updates...", "[ UPDATER ]");

        const response = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
            timeout: 10000,
            headers: {
                'User-Agent': 'SAGOR-BOT'
            }
        });

        const latestVersion = response.data.tag_name.replace('v', '');

        if (latestVersion !== CURRENT_VERSION) {
            console.log("\n" + "📢 UPDATE AVAILABLE! 📢".yellow);
            console.log(`Current version: v${CURRENT_VERSION}`);
            console.log(`Latest version: v${latestVersion}`);
            console.log(`Download: ${response.data.html_url}`);
            console.log("-".repeat(50) + "\n");

            logger(`Update available: v${CURRENT_VERSION} → v${latestVersion}`, "[ UPDATER ]");
        } else {
            logger(`Bot is up to date (v${CURRENT_VERSION})`, "[ UPDATER ]");
        }

    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            logger("Unable to check updates (no internet)", "[ UPDATER ]");
        } else if (error.response?.status === 404) {
            logger("GitHub repository not found", "[ UPDATER ]");
        } else {
            logger(`Update check failed: ${error.message}`, "[ UPDATER ]");
        }
    }
}

// ==================== GRACEFUL SHUTDOWN ====================

/**
 * Handle graceful shutdown
 */
function shutdown(signal) {
    console.log("\n" + "=".repeat(50));
    logger(`Received ${signal}. Shutting down...`, "[ SHUTDOWN ]");

    if (global.botProcess && !global.botProcess.killed) {
        logger("Stopping bot process...", "[ SHUTDOWN ]");
        global.botProcess.kill('SIGTERM');

        // Force kill after timeout
        setTimeout(() => {
            if (global.botProcess && !global.botProcess.killed) {
                global.botProcess.kill('SIGKILL');
            }
            process.exit(0);
        }, 5000);
    } else {
        process.exit(0);
    }
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGQUIT', () => shutdown('SIGQUIT'));

// ==================== MAIN EXECUTION ====================

// Display banner
console.log("\n" + "⭐".repeat(30));
console.log("    SAGOR BOT - LAUNCHER v2.0");
console.log("⭐".repeat(30) + "\n");

// Check for updates (optional, can be disabled)
if (process.env.CHECK_UPDATES !== 'false') {
    checkForUpdates();
}

// Start the bot
setTimeout(() => {
    startBot("🚀 Starting SAGOR BOT...");
}, 1000);

// ==================== MEMORY MONITORING ====================

/**
 * Monitor memory usage
 */
setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const memoryInMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
    };

    // Log if memory usage is high
    if (memoryInMB.heapUsed > 400) {
        logger(`High memory usage: ${memoryInMB.heapUsed}MB`, "[ MEMORY ]");
    }

    // Store in global for status endpoint
    global.memoryUsage = memoryInMB;

}, 60000); // Check every minute

// ==================== END OF LAUNCHER ====================
