const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
require("dotenv").config();

const pool = require("./db");

const app = express();
app.set("trust proxy", 1);


/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);


/* =========================
   STATIC FILES
========================= */

app.use(express.static(path.join(__dirname, "public")));


/* =========================
   HEALTH CHECK
========================= */

app.get("/health", async (req, res) => {

    try {

        await pool.query("SELECT 1");

        res.status(200).json({
            status: "online",
            service: "idle-steam",
            database: "connected",
            timestamp: new Date().toISOString()
        });

    } catch (error) {

        console.error("HEALTH DATABASE ERROR:", error);

        res.status(503).json({
            status: "offline",
            service: "idle-steam",
            database: "disconnected",
            timestamp: new Date().toISOString()
        });

    }

});


/* =========================
   SERVER STATUS
========================= */

app.get("/api/status", (req, res) => {

    res.json({
        online: true,
        server: "Idle Steam Server",
        uptime: process.uptime()
    });

});


/* =========================
   REGISTER
========================= */

app.post("/api/register", async (req, res) => {

    try {

        const {
            username,
            email,
            password
        } = req.body;

        if (!username || !email || !password) {

            return res.status(400).json({
                success: false,
                message: "Semua field wajib diisi."
            });

        }

        if (password.length < 6) {

            return res.status(400).json({
                success: false,
                message: "Password minimal 6 karakter."
            });

        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1 OR username = $2",
            [email, username]
        );

        if (existingUser.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Username atau email sudah digunakan."
            });

        }

        const hashedPassword =
            await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users
            (username, email, password)
            VALUES ($1, $2, $3)
            RETURNING id, username, email`,
            [
                username,
                email,
                hashedPassword
            ]
        );

        res.status(201).json({
            success: true,
            message: "Registrasi berhasil.",
            user: result.rows[0]
        });

    } catch (error) {

        console.error("REGISTER ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Terjadi kesalahan server."
        });

    }

});


/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: "Email dan password wajib diisi."
            });

        }

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Email atau password salah."
            });

        }

        const user = result.rows[0];

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );

if (!passwordMatch) {

    return res.status(401).json({
        success: false,
        message: "Email atau password salah."
    });

}

req.session.userId = user.id;
req.session.username = user.username;

req.session.save((err) => {

    if (err) {

        console.error("SESSION SAVE ERROR:", err);

        return res.status(500).json({
            success: false,
            message: "Gagal menyimpan session."
        });

    }

    res.json({
        success: true,
        message: "Login berhasil.",
        user: {
            id: user.id,
            username: user.username,
            email: user.email
        }
    });

});

    } catch (error) {

        console.error("LOGIN ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Terjadi kesalahan server."
        });

    }

});


/* =========================
   CURRENT USER
========================= */

app.get("/api/me", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Belum login."
            });

        }

        const result = await pool.query(
            `SELECT id, username, email, created_at
             FROM users
             WHERE id = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {

            req.session.destroy();

            return res.status(401).json({
                success: false,
                message: "User tidak ditemukan."
            });

        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {

        console.error("ME ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Terjadi kesalahan server."
        });

    }

});


/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            return res.status(500).json({
                success: false,
                message: "Gagal logout."
            });

        }

        res.json({
            success: true,
            message: "Logout berhasil."
        });

    });

});


/* =========================
   PROTECTED DASHBOARD
========================= */

app.get("/api/dashboard", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });

        }

        const result = await pool.query(
            `SELECT id, username, email
             FROM users
             WHERE id = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {

            return res.status(401).json({
                success: false,
                message: "User tidak ditemukan."
            });

        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {

        console.error("DASHBOARD ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });

    }

});


/* =========================
   GET GAMES
========================= */

app.get("/api/games", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });

        }

        const result = await pool.query(
            `SELECT id, game_name, steam_app_id, created_at
             FROM games
             WHERE user_id = $1
             ORDER BY id DESC`,
            [req.session.userId]
        );

        res.json({
            success: true,
            games: result.rows
        });

    } catch (error) {

        console.error("GET GAMES ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil game."
        });

    }

});


/* =========================
   ADD GAME
========================= */

app.post("/api/games", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });

        }

        const {
            gameName,
            appId
        } = req.body;

        if (!gameName || !appId) {

            return res.status(400).json({
                success: false,
                message: "Nama game dan App ID wajib diisi."
            });

        }

        const result = await pool.query(
            `INSERT INTO games
            (user_id, game_name, steam_app_id)
            VALUES ($1, $2, $3)
            RETURNING id, game_name, steam_app_id`,
            [
                req.session.userId,
                gameName,
                appId
            ]
        );

        res.status(201).json({
            success: true,
            message: "Game berhasil ditambahkan.",
            game: result.rows[0]
        });

    } catch (error) {

        console.error("ADD GAME ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan game."
        });

    }

});

/* =========================
   START IDLE SESSION
========================= */

app.post("/api/idle/start", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });

        }

        const { gameId } = req.body;

        if (!gameId) {

            return res.status(400).json({
                success: false,
                message: "Game ID wajib diisi."
            });

        }

        // Pastikan game milik user
        const gameResult = await pool.query(
            `SELECT id, game_name, steam_app_id
             FROM games
             WHERE id = $1
             AND user_id = $2`,
            [
                gameId,
                req.session.userId
            ]
        );

        if (gameResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Game tidak ditemukan."
            });

        }

        // Cek apakah sudah ada session aktif
        const activeSession = await pool.query(
            `SELECT id
             FROM idle_sessions
             WHERE user_id = $1
             AND status = 'running'`,
            [req.session.userId]
        );

        if (activeSession.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Masih ada idle session yang berjalan."
            });

        }

        const result = await pool.query(
            `INSERT INTO idle_sessions
            (user_id, game_id, status)
            VALUES ($1, $2, 'running')
            RETURNING id, started_at`,
            [
                req.session.userId,
                gameId
            ]
        );

        await pool.query(
            `INSERT INTO activity_logs
            (user_id, game_id, action)
            VALUES ($1, $2, $3)`,
            [
                req.session.userId,
                gameId,
                "Started idle session"
            ]
        );

        res.status(201).json({
            success: true,
            message: "Idle session dimulai.",
            session: result.rows[0],
            game: gameResult.rows[0]
        });

    } catch (error) {

        console.error("START IDLE ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal memulai idle session."
        });

    }

});


/* =========================
   STOP IDLE SESSION
========================= */

app.post("/api/idle/stop", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });

        }

        const activeSession = await pool.query(
            `SELECT id, game_id
             FROM idle_sessions
             WHERE user_id = $1
             AND status = 'running'
             LIMIT 1`,
            [req.session.userId]
        );

        if (activeSession.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Tidak ada idle session aktif."
            });

        }

        const sessionData =
            activeSession.rows[0];

        await pool.query(
            `UPDATE idle_sessions
             SET status = 'stopped',
                 stopped_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [sessionData.id]
        );

        await pool.query(
            `INSERT INTO activity_logs
            (user_id, game_id, action)
            VALUES ($1, $2, $3)`,
            [
                req.session.userId,
                sessionData.game_id,
                "Stopped idle session"
            ]
        );

        res.json({
            success: true,
            message: "Idle session dihentikan."
        });

    } catch (error) {

        console.error("STOP IDLE ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menghentikan idle session."
        });

    }

});


/* =========================
   ACTIVE IDLE SESSION
========================= */

app.get("/api/idle/active", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });

        }

        const result = await pool.query(
            `SELECT
                idle_sessions.id,
                idle_sessions.status,
                idle_sessions.started_at,
                games.id AS game_id,
                games.game_name,
                games.steam_app_id
             FROM idle_sessions
             INNER JOIN games
                ON games.id = idle_sessions.game_id
             WHERE idle_sessions.user_id = $1
             AND idle_sessions.status = 'running'
             LIMIT 1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {

            return res.json({
                success: true,
                active: false
            });

        }

        res.json({
            success: true,
            active: true,
            session: result.rows[0]
        });

    } catch (error) {

        console.error("ACTIVE IDLE ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil idle session."
        });

    }

});
/* =========================
   RECENT ACTIVITY
========================= */

app.get("/api/activity", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });

        }

        const result = await pool.query(
            `SELECT
                activity_logs.id,
                activity_logs.action,
                activity_logs.created_at,
                games.game_name
             FROM activity_logs
             LEFT JOIN games
                ON games.id = activity_logs.game_id
             WHERE activity_logs.user_id = $1
             ORDER BY activity_logs.id DESC
             LIMIT 10`,
            [req.session.userId]
        );

        res.json({
            success: true,
            activities: result.rows
        });

    } catch (error) {

        console.error("ACTIVITY ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil activity."
        });

    }

});

/* =========================
   STEAM WORKER
========================= */

const WORKER_TOKEN = process.env.WORKER_TOKEN;

function verifyWorker(req, res, next) {

    const token = req.headers["x-worker-token"];

    if (!WORKER_TOKEN || token !== WORKER_TOKEN) {

        return res.status(401).json({
            success: false,
            message: "Worker unauthorized."
        });

    }

    next();

}


/* =========================
   WORKER HEARTBEAT
========================= */

app.post(
    "/api/worker/heartbeat",
    verifyWorker,
    async (req, res) => {

        try {

            console.log(
                "STEAM WORKER HEARTBEAT:",
                new Date().toISOString()
            );

            res.json({
                success: true,
                status: "online",
                timestamp: new Date().toISOString()
            });

        } catch (error) {

            console.error(
                "WORKER HEARTBEAT ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Worker heartbeat failed."
            });

        }

    }
);
/* =========================
   WORKER GET JOB
========================= */

app.get(
    "/api/worker/job",
    verifyWorker,
    async (req, res) => {

        try {

            const result = await pool.query(
                `SELECT
                    idle_sessions.id AS session_id,
                    idle_sessions.user_id,
                    idle_sessions.game_id,
                    games.game_name,
                    games.steam_app_id
                 FROM idle_sessions
                 INNER JOIN games
                    ON games.id = idle_sessions.game_id
                 WHERE idle_sessions.status = 'running'
                 ORDER BY idle_sessions.started_at ASC
                 LIMIT 1`
            );


            if (result.rows.length === 0) {

                return res.json({
                    success: true,
                    job: null
                });

            }


            const job = result.rows[0];


            res.json({
                success: true,
                job: job
            });


        } catch (error) {

            console.error(
                "WORKER JOB ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Gagal mengambil worker job."
            });

        }

    }
);
/* =========================
   DELETE GAME
========================= */

app.delete("/api/games/:id", async (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });

        }

        await pool.query(
            `DELETE FROM games
             WHERE id = $1
             AND user_id = $2`,
            [
                req.params.id,
                req.session.userId
            ]
        );

        res.json({
            success: true,
            message: "Game berhasil dihapus."
        });

    } catch (error) {

        console.error("DELETE GAME ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menghapus game."
        });

    }

});


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

    console.log("=================================");
    console.log("       IDLE STEAM SERVER");
    console.log("=================================");
    console.log(`Running on http://localhost:${PORT}`);
    console.log("=================================");

});
