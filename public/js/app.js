console.log("IdleSteam loaded");


/* =========================
   SERVER STATUS
========================= */

async function checkServerStatus() {

    try {

        const response = await fetch("/api/status");

        const data = await response.json();

        console.log("Server:", data);

    } catch (error) {

        console.error("Server tidak dapat dihubungi.");

    }

}

checkServerStatus();


/* =========================
   LOGIN
========================= */

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const email =
                document.getElementById(
                    "loginEmail"
                ).value;

            const password =
                document.getElementById(
                    "loginPassword"
                ).value;

            try {

                const response =
                    await fetch("/api/login", {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            email,
                            password
                        })

                    });

                const data =
                    await response.json();

                if (!response.ok) {

                    alert(data.message);

                    return;

                }

                window.location.href =
                    "dashboard.html";

            } catch (error) {

                alert(
                    "Tidak dapat terhubung ke server."
                );

            }

        }
    );

}


/* =========================
   REGISTER
========================= */

const registerForm =
    document.getElementById(
        "registerForm"
    );

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const username =
                document.getElementById(
                    "registerUsername"
                ).value;

            const email =
                document.getElementById(
                    "registerEmail"
                ).value;

            const password =
                document.getElementById(
                    "registerPassword"
                ).value;

            const confirm =
                document.getElementById(
                    "registerConfirm"
                ).value;


            if (password !== confirm) {

                alert(
                    "Password dan konfirmasi password tidak sama."
                );

                return;

            }


            try {

                const response =
                    await fetch("/api/register", {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            username,
                            email,
                            password
                        })

                    });


                const data =
                    await response.json();


                if (!response.ok) {

                    alert(data.message);

                    return;

                }


                alert(
                    "Registrasi berhasil! Silakan login."
                );

                window.location.href =
                    "login.html";


            } catch (error) {

                alert(
                    "Tidak dapat terhubung ke server."
                );

            }

        }
    );

}


/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {

    const dashboard =
        document.querySelector(
            ".dashboard-content"
        );

    if (!dashboard) return;


    try {

        const response =
            await fetch("/api/dashboard");


        if (response.status === 401) {

            window.location.href =
                "login.html";

            return;

        }


        const data =
            await response.json();


        if (!data.success) return;


        const username =
            data.user.username;


        const userNameElement =
            document.querySelector(
                ".user-profile strong"
            );

        if (userNameElement) {

            userNameElement.textContent =
                username;

        }


        const avatar =
            document.querySelector(
                ".avatar"
            );

        if (avatar) {

            avatar.textContent =
                username
                    .charAt(0)
                    .toUpperCase();

        }


        await loadActiveIdle();

        await loadActivity();


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }

}

async function loadActiveIdle() {

    try {

        const response =
            await fetch(
                "/api/idle/active"
            );

        if (response.status === 401) {

            return;

        }

        const data =
            await response.json();


        const activeGame =
            document.querySelector(
                ".active-game"
            );

        if (!activeGame) return;


        if (!data.active) {

            activeGame.innerHTML = `

                <div class="big-game-icon">
                    🎮
                </div>

                <div class="active-game-info">

                    <h3>No Game Running</h3>

                    <p>
                        Belum ada game yang sedang dijalankan.
                    </p>

                </div>

                <a
                    href="games.html"
                    class="btn-primary">

                    + Add Game

                </a>

            `;

            return;

        }


        const session =
            data.session;


        activeGame.innerHTML = `

            <div class="big-game-icon">
                🎮
            </div>

            <div class="active-game-info">

                <h3>
                    ${escapeHtml(
                        session.game_name
                    )}
                </h3>

                <p>
                    Steam App ID:
                    ${escapeHtml(
                        session.steam_app_id
                    )}
                </p>

                <span class="running-label">
                    ● RUNNING
                </span>

            </div>

            <button
                class="stop-idle-button"
                onclick="stopIdle()">

                ■ Stop Idle

            </button>

        `;


        // Update server status
        updateRunningStats(
            session.started_at
        );


    } catch (error) {

        console.error(error);

    }

}

async function loadActivity() {

    try {

        const response =
            await fetch(
                "/api/activity"
            );

        if (response.status === 401) {

            return;

        }

        const data =
            await response.json();


        const activity =
            document.querySelector(
                ".activity-empty"
            );

        if (!activity) return;


        if (
            !data.activities ||
            data.activities.length === 0
        ) {

            return;

        }


        activity.innerHTML = `

            <div class="activity-list">

                ${data.activities.map(item => `

                    <div class="activity-item">

                        <div class="activity-icon">
                            ⚡
                        </div>

                        <div>

                            <strong>
                                ${escapeHtml(
                                    item.action
                                )}
                            </strong>

                            <p>
                                ${
                                    item.game_name
                                        ? escapeHtml(
                                            item.game_name
                                          )
                                        : "IdleSteam"
                                }
                            </p>

                        </div>

                        <time>
                            ${formatDate(
                                item.created_at
                            )}
                        </time>

                    </div>

                `).join("")}

            </div>

        `;

    } catch (error) {

        console.error(error);

    }

}

function updateRunningStats(
    startedAt
) {

    const uptimeElement =
        document.querySelector(
            ".dashboard-stat:nth-child(4) strong"
        );

    if (!uptimeElement) return;


    function update() {

        const start =
            new Date(startedAt)
                .getTime();

        const now =
            Date.now();

        let seconds =
            Math.floor(
                (now - start) / 1000
            );


        if (seconds < 0) {

            seconds = 0;

        }


        const hours =
            Math.floor(
                seconds / 3600
            );

        seconds %= 3600;


        const minutes =
            Math.floor(
                seconds / 60
            );

        seconds %= 60;


        uptimeElement.textContent =
            `${String(hours).padStart(2, "0")}:` +
            `${String(minutes).padStart(2, "0")}:` +
            `${String(seconds).padStart(2, "0")}`;

    }


    update();

    setInterval(update, 1000);

}

function formatDate(date) {

    return new Date(date)
        .toLocaleString(
            "id-ID",
            {
                dateStyle: "short",
                timeStyle: "short"
            }
        );

}


/* =========================
   LOGOUT
========================= */

const logoutButton =
    document.querySelector(
        ".logout"
    );

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async function(event) {

            event.preventDefault();

            await fetch(
                "/api/logout",
                {
                    method: "POST"
                }
            );

            window.location.href =
                "/";

        }
    );

}


/* =========================
   ADD GAME MODAL
========================= */

function showAddGame() {

    const modal =
        document.getElementById(
            "addGameModal"
        );

    if (modal) {

        modal.style.display = "flex";

    }

}


function hideAddGame() {

    const modal =
        document.getElementById(
            "addGameModal"
        );

    if (modal) {

        modal.style.display = "none";

    }

}


/* =========================
   ADD GAME
========================= */

async function addGame() {

    const gameName =
        document.getElementById(
            "gameName"
        ).value;

    const appId =
        document.getElementById(
            "appId"
        ).value;


    if (!gameName || !appId) {

        alert(
            "Nama game dan Steam App ID wajib diisi."
        );

        return;

    }


    try {

        const response =
            await fetch("/api/games", {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    gameName,
                    appId
                })

            });


        const data =
            await response.json();


        if (response.status === 401) {

            window.location.href =
                "login.html";

            return;

        }


        if (!response.ok) {

            alert(data.message);

            return;

        }


        alert(
            "Game berhasil ditambahkan!"
        );


        hideAddGame();

        document.getElementById(
            "gameName"
        ).value = "";

        document.getElementById(
            "appId"
        ).value = "";

        loadGames();

    } catch (error) {

        alert(
            "Gagal menghubungi server."
        );

    }

}


/* =========================
   LOAD GAMES
========================= */

async function loadGames() {

    const gamesPage =
        document.querySelector(
            ".games-empty"
        );

    if (!gamesPage) return;


    try {

        const response =
            await fetch("/api/games");


        if (response.status === 401) {

            window.location.href =
                "login.html";

            return;

        }


        const data =
            await response.json();


        if (!data.success) return;


        if (data.games.length === 0) {

            return;

        }


        gamesPage.innerHTML = `

            <div class="game-list">

                ${data.games.map(game => `

                    <div class="saved-game">

                        <div class="big-game-icon">
                            🎮
                        </div>

                        <div class="saved-game-info">

                            <h3>
                                ${escapeHtml(game.game_name)}
                            </h3>

                            <p>
                                Steam App ID:
                                ${escapeHtml(game.steam_app_id)}
                            </p>

                        </div>

                        <div class="game-actions">

                            <button
                                class="idle-button"
                                onclick="startIdle(${game.id})">

                                ▶ Start Idle

                            </button>

                            <button
                                class="delete-button"
                                onclick="deleteGame(${game.id})">

                                Delete

                            </button>

                        </div>

                    </div>

                `).join("")}

            </div>

        `;

    } catch (error) {

        console.error(error);

    }

}

loadGames();


/* =========================
   DELETE GAME
========================= */

async function deleteGame(id) {

    if (!confirm(
        "Hapus game ini?"
    )) {

        return;

    }


    const response =
        await fetch(
            `/api/games/${id}`,
            {
                method: "DELETE"
            }
        );


    const data =
        await response.json();


    if (data.success) {

        loadGames();

    } else {

        alert(data.message);

    }

}


/* =========================
   START IDLE
========================= */

async function startIdle(id) {

    try {

        const response = await fetch(
            "/api/idle/start",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    gameId: id
                })
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            alert(data.message);

            return;

        }

        alert(
            "Idle session berhasil dimulai!"
        );

        window.location.href =
            "dashboard.html";

    } catch (error) {

        alert(
            "Tidak dapat menghubungi server."
        );

    }

}

async function stopIdle() {

    if (!confirm(
        "Hentikan idle session?"
    )) {

        return;

    }

    try {

        const response =
            await fetch(
                "/api/idle/stop",
                {
                    method: "POST"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(data.message);

            return;

        }

        alert(
            "Idle session dihentikan."
        );

        loadDashboard();

    } catch (error) {

        alert(
            "Tidak dapat menghubungi server."
        );

    }

}


/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}