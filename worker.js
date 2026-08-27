require("dotenv").config();


/* =========================
   CONFIG
========================= */

const API_URL =
    process.env.IDLESTEAM_API_URL;

const WORKER_TOKEN =
    process.env.WORKER_TOKEN;

const CHECK_INTERVAL =
    30 * 1000;


/* =========================
   VALIDATE CONFIG
========================= */

if (!API_URL) {

    console.error(
        "ERROR: IDLESTEAM_API_URL belum diatur di .env"
    );

    process.exit(1);

}

if (!WORKER_TOKEN) {

    console.error(
        "ERROR: WORKER_TOKEN belum diatur di .env"
    );

    process.exit(1);

}


/* =========================
   WORKER STATE
========================= */

let currentSessionId = null;


/* =========================
   HEADER
========================= */

console.log("=================================");
console.log("       IDLESTEAM WORKER");
console.log("=================================");
console.log("API:", API_URL);
console.log("Worker: Configured");
console.log("Mode: STATUS ONLY");
console.log("Steam: DISABLED");
console.log("=================================");


/* =========================
   API REQUEST
========================= */

async function apiRequest(
    endpoint,
    options = {}
) {

    const headers = {

        "Content-Type":
            "application/json",

        "x-worker-token":
            WORKER_TOKEN,

        ...(options.headers || {})

    };


    const response =
        await fetch(
            `${API_URL}${endpoint}`,
            {
                ...options,
                headers
            }
        );


    const text =
        await response.text();


    let data;

    try {

        data =
            JSON.parse(text);

    } catch (error) {

        throw new Error(
            `Server mengembalikan response bukan JSON: ${text.substring(0, 200)}`
        );

    }


    if (!response.ok) {

        throw new Error(
            data.message ||
            `HTTP ${response.status}`
        );

    }


    return data;

}


/* =========================
   HEARTBEAT
========================= */

async function heartbeat() {

    try {

        const data =
            await apiRequest(
                "/api/worker/heartbeat",
                {
                    method: "POST"
                }
            );


        console.log(
            new Date().toLocaleTimeString(),
            "Server:",
            data.status
        );


    } catch (error) {

        console.error(
            new Date().toLocaleTimeString(),
            "Heartbeat error:",
            error.message
        );

    }

}


/* =========================
   CHECK JOB
========================= */

async function checkJob() {

    try {

        const data =
            await apiRequest(
                "/api/worker/job",
                {
                    method: "GET"
                }
            );


        /* =========================
           NO JOB
        ========================= */

        if (!data.job) {

            if (
                currentSessionId !== null
            ) {

                console.log("");
                console.log(
                    "================================="
                );
                console.log(
                    "       IDLE SESSION SELESAI"
                );
                console.log(
                    "================================="
                );
                console.log(
                    "Session ID:",
                    currentSessionId
                );
                console.log("");

            } else {

                console.log(
                    new Date().toLocaleTimeString(),
                    "Tidak ada job."
                );

            }


            currentSessionId = null;

            return;

        }


        /* =========================
           JOB
        ========================= */

        const job =
            data.job;


        /* =========================
           SAME JOB
        ========================= */

        if (
            currentSessionId ===
            job.session_id
        ) {

            console.log(
                new Date().toLocaleTimeString(),
                "RUNNING:",
                job.game_name,
                "| Session:",
                job.session_id
            );

            return;

        }


        /* =========================
           NEW JOB
        ========================= */

        currentSessionId =
            job.session_id;


        console.log("");
        console.log(
            "================================="
        );
        console.log(
            "       IDLE SESSION RUNNING"
        );
        console.log(
            "================================="
        );
        console.log(
            "Session ID:",
            job.session_id
        );
        console.log(
            "Game:",
            job.game_name
        );
        console.log(
            "Steam App ID:",
            job.steam_app_id
        );
        console.log(
            "---------------------------------"
        );
        console.log(
            "Mode: STATUS ONLY"
        );
        console.log(
            "Steam tidak dijalankan."
        );
        console.log(
            "Game tidak dibuka."
        );
        console.log(
            "================================="
        );
        console.log("");


    } catch (error) {

        console.error(
            new Date().toLocaleTimeString(),
            "Check job error:",
            error.message
        );

    }

}


/* =========================
   WORKER LOOP
========================= */

async function workerLoop() {

    await heartbeat();

    await checkJob();

}


/* =========================
   START WORKER
========================= */

workerLoop();


setInterval(
    workerLoop,
    CHECK_INTERVAL
);


/* =========================
   SHUTDOWN
========================= */

process.on(
    "SIGINT",
    () => {

        console.log("");
        console.log(
            "Stopping IdleSteam Worker..."
        );

        process.exit(0);

    }
);


process.on(
    "SIGTERM",
    () => {

        console.log("");
        console.log(
            "Stopping IdleSteam Worker..."
        );

        process.exit(0);

    }
);