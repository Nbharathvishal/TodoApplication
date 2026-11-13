// =============================================================
// TaskVerse — Centralized Environment & API Configuration
// Automatic Backend Selection:
// - Local development (localhost / 127.0.0.1 / file:) -> http://localhost:8080
// - Production (deployed / live host)                 -> https://todo-backend-zyqf.onrender.com
// =============================================================

const ENV_CONFIG = {
    development: {
        API_BASE_URL: "http://localhost:8080"
    },
    production: {
        API_BASE_URL: "https://todo-backend-zyqf.onrender.com"
    }
};

const CLOUD_SERVER_URL = ENV_CONFIG.production.API_BASE_URL;
const LOCAL_SERVER_URL = ENV_CONFIG.development.API_BASE_URL;

function isLocalEnvironment() {
    if (typeof window === "undefined" || !window.location) return true;
    const hostname = window.location.hostname;
    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "[::1]" ||
        hostname.endsWith(".localhost") ||
        window.location.protocol === "file:"
    );
}

function getServerUrl() {
    // 1. Support runtime environment injection (window.__ENV__ or process.env)
    if (typeof window !== "undefined" && window.__ENV__ && window.__ENV__.API_BASE_URL) {
        return window.__ENV__.API_BASE_URL;
    }
    // 2. Automatically select environment by hostname
    return isLocalEnvironment()
        ? ENV_CONFIG.development.API_BASE_URL
        : ENV_CONFIG.production.API_BASE_URL;
}

// Clear any obsolete manual selection from previous sessions so environment is always automatic
try {
    if (typeof localStorage !== "undefined") {
        localStorage.removeItem("taskverse_server_url");
    }
} catch (e) {}

let SERVER_URL = getServerUrl();

function switchBackend() {
    console.warn("Manual backend switching is disabled. TaskVerse automatically connects to the appropriate environment.");
}

function updateServerSelectorUI() {
    SERVER_URL = getServerUrl();
    const isCloud = SERVER_URL.includes("onrender.com");

    const settingsDisplay = document.getElementById("settings-server-url");
    const envBadge = document.getElementById("settings-server-env-badge");

    if (settingsDisplay) {
        settingsDisplay.textContent = `${SERVER_URL} (${isCloud ? "Production" : "Local Development"})`;
    }
    if (envBadge) {
        envBadge.textContent = isCloud ? "Production" : "Local";
    }
}

function handleFetchError(error, contextMsg = "Request failed") {
    console.error("API Fetch Error:", error);
    const current = getServerUrl();
    const isLocalTarget = current.includes("localhost") || current.includes("127.0.0.1");

    if (error && error.message && (error.message.includes("403") || error.message.includes("401") || error.message.includes("Session expired"))) {
        localStorage.removeItem("token");
        showToast("Session expired or access denied (HTTP 403). Please sign in again.", "error");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 1200);
        return;
    }

    if (error && (error.name === "AbortError" || (error.message && error.message.includes("aborted")))) {
        showToast(
            `Connection timed out (${current}). Free Render servers take ~50s to cold start, or local server is stopped.`,
            "error"
        );
        return;
    }

    if (error.message === "Failed to fetch" || error.name === "TypeError") {
        if (isLocalTarget) {
            showToast(
                `Local backend connection refused at ${current}. Please ensure Spring Boot is running on port 8080.`,
                "error"
            );
        } else {
            showToast(
                `Cannot reach Cloud backend at ${current}. Note: Free Render instances take ~30-50s to wake up if inactive. Please retry shortly.`,
                "error"
            );
        }
    } else {
        showToast(error.message || contextMsg, "error");
    }
}

// Application Global State
const state = {
    todos: [],
    currentView: "dashboard",
    activeFilter: "all",
    activeCategory: "all",
    searchQuery: "",
    sortBy: "dueDate",
    calendarMonth: new Date().getMonth(),
    calendarYear: new Date().getFullYear(),
    habitTrackerMonth: new Date().getMonth(),
    habitTrackerYear: new Date().getFullYear(),
    habitViewMode: localStorage.getItem("taskverse_view_mode") || "spreadsheet",
    selectedCalendarDate: getTodayDateString(),
    customCategories: ["Work", "Personal", "Learning", "Shopping", "Other"],
    soundEnabled: false,
    hasCelebratedKolaMassToday: false,
    confirmActionCallback: null,
    isSubmittingTask: false
};

// -------------------------------------------------------------
// Authentication Utilities (Preserved)
// -------------------------------------------------------------
function getToken() {
    return localStorage.getItem("token");
}

function isTokenExpired(token) {
    if (!token) return true;
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return true;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (!payload.exp) return false;
        // Expired if current time is past exp (with a 5-second buffer)
        return Date.now() >= (payload.exp * 1000) - 5000;
    } catch (e) {
        return true;
    }
}

function getLoggedInEmail() {
    return localStorage.getItem("userEmail") || "User";
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    showToast("Signed out successfully", "info");
    setTimeout(() => {
        window.location.href = "login.html";
    }, 400);
}

// Login logic (Preserved & Enhanced with Toast & Smart Error Handling)
function login() {
    const emailElem = document.getElementById("email");
    const passwordElem = document.getElementById("password");
    const btn = document.getElementById("login-btn");

    if (!emailElem || !passwordElem) return;

    const email = emailElem.value.trim().toLowerCase();
    const password = passwordElem.value;

    if (!email || !password) {
        showToast("Please enter both email and password", "error");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Authenticating...";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const isCloud = getServerUrl().includes("onrender.com");
    let wakeNoticeTimer = null;
    if (isCloud) {
        wakeNoticeTimer = setTimeout(() => {
            showToast("Cloud server is spinning up (free tier cold start can take ~30-50s)...", "info");
        }, 3500);
    }

    fetch(`${getServerUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                let msg = text;
                try {
                    const parsed = JSON.parse(text);
                    if (parsed && (parsed.message || parsed.error)) {
                        msg = parsed.message || parsed.error;
                    }
                } catch (e) {}
                throw new Error(msg || "Login Failed");
            });
        }
        return response.json();
    })
    .then(data => {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userEmail", email);
        showToast("Welcome back! Redirecting...", "success");
        setTimeout(() => {
            window.location.href = "todos.html";
        }, 500);
    })
    .catch(error => {
        handleFetchError(error, "Login Failed");
    })
    .finally(() => {
        clearTimeout(timeoutId);
        if (wakeNoticeTimer) clearTimeout(wakeNoticeTimer);
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Sign In";
        }
    });
}

// Register logic (Preserved & Enhanced with Toast & Smart Error Handling)
function register() {
    const emailElem = document.getElementById("email");
    const passwordElem = document.getElementById("password");
    const btn = document.getElementById("register-btn");

    if (!emailElem || !passwordElem) return;

    const email = emailElem.value.trim().toLowerCase();
    const password = passwordElem.value;

    if (!email || !password) {
        showToast("Please enter both email and password", "error");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Creating Account...";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const isCloud = getServerUrl().includes("onrender.com");
    let wakeNoticeTimer = null;
    if (isCloud) {
        wakeNoticeTimer = setTimeout(() => {
            showToast("Cloud server is spinning up (free tier cold start can take ~30-50s)...", "info");
        }, 3500);
    }

    fetch(`${getServerUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
    })
    .then(response => {
        if (response.ok) {
            // Newly registered users receive Light Mode by default
            try {
                localStorage.setItem("taskverse_theme", "light");
                localStorage.setItem(`taskverse_prefs_${email}`, JSON.stringify({ theme: "light" }));
            } catch (e) {}
            showToast("Registration successful! Please login.", "success");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 600);
        } else {
            return response.text().then(text => {
                let msg = text;
                try {
                    const parsed = JSON.parse(text);
                    if (parsed && (parsed.message || parsed.error)) {
                        msg = parsed.message || parsed.error;
                    }
                } catch (e) {}
                throw new Error(msg || "Registration Failed");
            });
        }
    })
    .catch(error => {
        handleFetchError(error, "Registration Failed");
    })
    .finally(() => {
        clearTimeout(timeoutId);
        if (wakeNoticeTimer) clearTimeout(wakeNoticeTimer);
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Register Account";
        }
    });
}

// -------------------------------------------------------------
// Date & Metadata Helpers
// -------------------------------------------------------------
function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return "No deadline";
    try {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            const date = new Date(parts[0], parts[1] - 1, parts[2]);
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
}

function getRelativeDateStatus(dueDateStr, isCompleted) {
    if (!dueDateStr) return { text: "No Due Date", class: "" };
    if (isCompleted) return { text: formatDateDisplay(dueDateStr), class: "" };

    const todayStr = getTodayDateString();
    if (dueDateStr === todayStr) {
        return { text: "Due Today", class: "today" };
    } else if (dueDateStr < todayStr) {
        return { text: `Overdue (${formatDateDisplay(dueDateStr)})`, class: "overdue" };
    } else {
        return { text: formatDateDisplay(dueDateStr), class: "" };
    }
}

// Encodes/Decodes rich metadata inside Todo description
// Format: userDescription\n<!--taskverse:{"priority":"High","dueDate":"2026-10-28","category":"Work","recurrence":{...},"goal":30,"completedDates":[]}-->
function parseTodoMetadata(rawTodo) {
    const todo = {
        ...rawTodo,
        completed: rawTodo.completed ?? rawTodo.isCompleted ?? false
    };

    const desc = rawTodo.description || "";
    const metaRegex = /<!--taskverse:(\{.*?\})-->/;
    const match = desc.match(metaRegex);

    let priority = "Medium";
    let dueDate = getTodayDateString();
    let category = "Work";
    let cleanDescription = desc;
    let goal = 30;
    let completedDates = [];
    let recurrence = {
        frequency: "none",
        customDays: [1, 2, 3, 4, 5],
        endType: "never",
        endDate: null,
        endCount: 10,
        seriesId: null,
        isPaused: false,
        isOccurrence: false
    };

    if (match && match[1]) {
        try {
            const parsed = JSON.parse(match[1]);
            if (parsed.priority) priority = parsed.priority;
            if (parsed.dueDate) dueDate = parsed.dueDate;
            if (parsed.category) category = parsed.category;
            if (parsed.recurrence) recurrence = { ...recurrence, ...parsed.recurrence };
            if (parsed.goal !== undefined && parsed.goal !== null) goal = Number(parsed.goal) || 30;
            if (Array.isArray(parsed.completedDates)) completedDates = parsed.completedDates;
            cleanDescription = desc.replace(/<!--taskverse:[\s\S]*?-->/g, "").trim();
        } catch (e) {
            console.warn("Failed to parse taskverse metadata:", e);
        }
    } else {
        cleanDescription = desc.replace(/<!--taskverse:[\s\S]*?-->/g, "").trim();
    }

    // Merge persistent local habit tracking history if available
    const cacheKey = "taskverse_habit_dates_" + (rawTodo.id || rawTodo.title);
    try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
            const cachedArr = JSON.parse(cachedRaw);
            if (Array.isArray(cachedArr)) {
                completedDates = Array.from(new Set([...completedDates, ...cachedArr]));
            }
        }
    } catch (e) {}

    // If cleanDescription was automatically defaulted to title, treat it as empty for UI
    if (cleanDescription === todo.title) {
        cleanDescription = "";
    }

    // Synchronize: if marked completed and dueDate is set, ensure dueDate is included in completedDates
    if (todo.completed && dueDate && !completedDates.includes(dueDate)) {
        completedDates.push(dueDate);
    }

    return {
        ...todo,
        cleanDescription,
        priority,
        dueDate,
        category,
        recurrence,
        goal,
        completedDates
    };
}

function serializeTodoForBackend(todoInput) {
    let cleanRecurrence = todoInput.recurrence || { frequency: "none" };
    if (!cleanRecurrence.frequency || cleanRecurrence.frequency === "none") {
        cleanRecurrence = { frequency: "none" };
    }

    const meta = {
        priority: todoInput.priority || "Medium",
        dueDate: todoInput.dueDate || getTodayDateString(),
        category: todoInput.category || "Work",
        recurrence: cleanRecurrence,
        goal: todoInput.goal !== undefined && todoInput.goal !== null ? Number(todoInput.goal) : 30,
        completedDates: Array.isArray(todoInput.completedDates) ? todoInput.completedDates : []
    };

    const metaTag = `<!--taskverse:${JSON.stringify(meta)}-->`;
    const inputDesc = (todoInput.cleanDescription !== undefined ? todoInput.cleanDescription : (todoInput.description || "")).trim();
    const strippedDesc = inputDesc.replace(/<!--taskverse:[\s\S]*?-->/g, "").trim();

    let finalDescription = "";
    if (!strippedDesc || strippedDesc === todoInput.title) {
        finalDescription = `${todoInput.title}\n${metaTag}`;
    } else {
        finalDescription = `${strippedDesc}\n${metaTag}`;
    }

    const isComp = Boolean(todoInput.completed ?? todoInput.isCompleted);
    const result = {
        title: todoInput.title,
        description: finalDescription,
        completed: isComp,
        isCompleted: isComp
    };

    if (todoInput.id !== undefined && todoInput.id !== null && todoInput.id !== "") {
        result.id = Number(todoInput.id);
    }

    return result;
}

// -------------------------------------------------------------
// Recurring Tasks & Schedule Engine
// -------------------------------------------------------------
function handleRecurrenceChange(freq) {
    const customWrapper = document.getElementById("modal-custom-days-wrapper");
    const endWrapper = document.getElementById("modal-repeat-end-wrapper");

    if (customWrapper) customWrapper.style.display = freq === "custom_days" ? "block" : "none";
    if (endWrapper) endWrapper.style.display = freq !== "none" ? "block" : "none";
}

function toggleCustomDay(dayIndex) {
    const btn = document.querySelector(`.btn-day-toggle[data-day="${dayIndex}"]`);
    if (btn) btn.classList.toggle("active");
}

function getSelectedCustomDays() {
    const btns = document.querySelectorAll(".btn-day-toggle.active");
    const days = [];
    btns.forEach(b => days.push(Number(b.getAttribute("data-day"))));
    return days.length > 0 ? days : [1, 2, 3, 4, 5];
}

function setSelectedCustomDays(daysArray) {
    const target = daysArray || [1, 2, 3, 4, 5];
    document.querySelectorAll(".btn-day-toggle").forEach(btn => {
        const d = Number(btn.getAttribute("data-day"));
        btn.classList.toggle("active", target.includes(d));
    });
}

function handleEndConditionChange(endType) {
    const dateInput = document.getElementById("modal-repeat-end-date");
    const countInput = document.getElementById("modal-repeat-end-count");

    if (dateInput) dateInput.disabled = endType !== "date";
    if (countInput) countInput.disabled = endType !== "count";
}

function formatFrequency(freq) {
    switch (freq) {
        case "daily": return "Daily";
        case "weekday": return "Weekdays";
        case "weekly": return "Weekly";
        case "monthly": return "Monthly";
        case "custom_days": return "Custom Days";
        default: return "Does not repeat";
    }
}

function calculateSeriesDates(startDateStr, recurrence, maxOccurrences = 60, horizonDays = 90) {
    if (!recurrence || recurrence.frequency === "none") {
        return [startDateStr];
    }

    const dates = [];
    const startParts = startDateStr.split("-").map(Number);
    let cursor = new Date(startParts[0], startParts[1] - 1, startParts[2]);

    const today = new Date();
    const maxHorizonDate = new Date(today);
    maxHorizonDate.setDate(maxHorizonDate.getDate() + horizonDays);

    let targetEndDate = null;
    if (recurrence.endType === "date" && recurrence.endDate) {
        const endParts = recurrence.endDate.split("-").map(Number);
        targetEndDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    }

    const maxCount = recurrence.endType === "count" ? (Number(recurrence.endCount) || 10) : maxOccurrences;
    const anchorDayOfMonth = startParts[2];

    let count = 0;
    for (let step = 0; step < 500 && count < maxCount; step++) {
        const curYear = cursor.getFullYear();
        const curMonth = String(cursor.getMonth() + 1).padStart(2, "0");
        const curDay = String(cursor.getDate()).padStart(2, "0");
        const curDateStr = `${curYear}-${curMonth}-${curDay}`;

        if (targetEndDate && cursor > targetEndDate) break;
        if (!targetEndDate && cursor > maxHorizonDate && count >= 1) break;

        let matches = false;
        const dayOfWeek = cursor.getDay(); // 0 = Sun, ..., 6 = Sat

        if (recurrence.frequency === "daily") {
            matches = true;
        } else if (recurrence.frequency === "weekday") {
            matches = dayOfWeek >= 1 && dayOfWeek <= 5;
        } else if (recurrence.frequency === "weekly") {
            matches = true;
        } else if (recurrence.frequency === "monthly") {
            matches = true;
        } else if (recurrence.frequency === "custom_days") {
            const custom = recurrence.customDays || [1, 2, 3, 4, 5];
            matches = custom.includes(dayOfWeek);
        }

        if (matches) {
            dates.push(curDateStr);
            count++;
        }

        // Advance cursor
        if (recurrence.frequency === "weekly") {
            cursor.setDate(cursor.getDate() + 7);
        } else if (recurrence.frequency === "monthly") {
            let nextMonth = cursor.getMonth() + 1;
            let nextYear = cursor.getFullYear();
            if (nextMonth > 11) {
                nextMonth = 0;
                nextYear++;
            }
            const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
            const safeDay = Math.min(anchorDayOfMonth, daysInNextMonth);
            cursor = new Date(nextYear, nextMonth, safeDay);
        } else {
            cursor.setDate(cursor.getDate() + 1);
        }
    }

    return dates.length > 0 ? dates : [startDateStr];
}

async function updateRecurringSeries(seriesId, updatedFields) {
    const currentToken = getToken();
    if (!currentToken) return;

    const matchingTasks = state.todos.filter(t => t.recurrence && t.recurrence.seriesId === seriesId);
    if (matchingTasks.length === 0) return;

    showToast(`Updating ${matchingTasks.length} missions in series...`, "info");

    const updatePromises = matchingTasks.map(t => {
        const payload = serializeTodoForBackend({
            id: t.id,
            title: updatedFields.title,
            description: updatedFields.cleanDescription || updatedFields.description,
            dueDate: t.dueDate,
            priority: updatedFields.priority,
            category: updatedFields.category,
            completed: t.completed,
            recurrence: {
                ...t.recurrence,
                ...updatedFields.recurrence,
                seriesId: seriesId
            }
        });

        return fetch(`${getServerUrl()}/api/todo`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify(payload)
        });
    });

    try {
        await Promise.all(updatePromises);
        closeTaskModal();
        showToast("Entire recurring series updated!", "success");
        loadTodos();
    } catch (err) {
        handleFetchError(err, "Failed to update entire series");
    } finally {
        state.isSubmittingTask = false;
        const saveBtn = document.getElementById("modal-task-save-btn");
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Mission";
        }
    }
}

async function deleteRecurringSeries(seriesId) {
    const currentToken = getToken();
    if (!currentToken) return;

    const matchingTasks = state.todos.filter(t => t.recurrence && t.recurrence.seriesId === seriesId);
    if (matchingTasks.length === 0) return;

    closeSeriesModal();
    showToast(`Deleting ${matchingTasks.length} missions in series...`, "info");

    const deletePromises = matchingTasks.map(t => {
        return fetch(`${getServerUrl()}/api/todo/${t.id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${currentToken}`
            }
        });
    });

    try {
        await Promise.all(deletePromises);
        showToast("Recurring series deleted.", "info");
        loadTodos();
    } catch (err) {
        handleFetchError(err, "Failed to delete recurring series");
    }
}

async function togglePauseSeries(seriesId, shouldPause) {
    const currentToken = getToken();
    if (!currentToken) return;

    const matchingTasks = state.todos.filter(t => t.recurrence && t.recurrence.seriesId === seriesId);
    if (matchingTasks.length === 0) return;

    closeSeriesModal();
    showToast(`${shouldPause ? "Pausing" : "Resuming"} series...`, "info");

    const updatePromises = matchingTasks.map(t => {
        const payload = serializeTodoForBackend({
            id: t.id,
            title: t.title,
            description: t.cleanDescription || t.description,
            dueDate: t.dueDate,
            priority: t.priority,
            category: t.category,
            completed: t.completed,
            recurrence: {
                ...t.recurrence,
                isPaused: shouldPause
            }
        });

        return fetch(`${getServerUrl()}/api/todo`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify(payload)
        });
    });

    try {
        await Promise.all(updatePromises);
        showToast(`Series ${shouldPause ? "paused ⏸️" : "resumed 🔁"}!`, "success");
        loadTodos();
    } catch (err) {
        handleFetchError(err, "Failed to update series state");
    }
}

function openSeriesActionModal(todo) {
    const modal = document.getElementById("series-modal");
    const title = document.getElementById("series-modal-title");
    const msg = document.getElementById("series-modal-msg");
    const actions = document.getElementById("series-modal-actions");

    if (!modal || !todo.recurrence || !todo.recurrence.seriesId) {
        deleteTodo(todo.id);
        return;
    }

    const seriesId = todo.recurrence.seriesId;
    const seriesTasks = state.todos.filter(t => t.recurrence && t.recurrence.seriesId === seriesId);
    const isPaused = Boolean(todo.recurrence.isPaused);

    if (title) title.textContent = "Recurring Mission Action";
    if (msg) msg.textContent = `"${todo.title}" is part of a recurring series with ${seriesTasks.length} scheduled occurrences.`;

    if (actions) {
        actions.innerHTML = `
            <button type="button" class="btn-series-opt danger" onclick="deleteSingleOccurrence(${todo.id})">
                <span>Delete Only This Occurrence</span>
                <span class="btn-series-opt-desc">Removes only the mission due on ${formatDateDisplay(todo.dueDate)}. Other occurrences remain.</span>
            </button>
            <button type="button" class="btn-series-opt danger" onclick="deleteRecurringSeries('${seriesId}')">
                <span>Delete Entire Series</span>
                <span class="btn-series-opt-desc">Permanently deletes all ${seriesTasks.length} scheduled occurrences in this series.</span>
            </button>
            <button type="button" class="btn-series-opt" onclick="togglePauseSeries('${seriesId}', ${!isPaused})">
                <span>${isPaused ? "▶️ Resume Series" : "⏸️ Pause Series"}</span>
                <span class="btn-series-opt-desc">${isPaused ? "Re-activates generation and updates status to active." : "Freezes this series without deleting existing occurrences."}</span>
            </button>
        `;
    }

    modal.classList.add("open");
}

function closeSeriesModal() {
    const modal = document.getElementById("series-modal");
    if (modal) modal.classList.remove("open");
}

function deleteSingleOccurrence(id) {
    closeSeriesModal();
    const currentToken = getToken();
    if (!currentToken || isTokenExpired(currentToken)) {
        localStorage.removeItem("token");
        showToast("Session expired or access denied (HTTP 403). Please log in again.", "error");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 800);
        return;
    }

    fetch(`${getServerUrl()}/api/todo/${id}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${currentToken}`
        }
    })
    .then(async response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("token");
                showToast("Access forbidden or session expired (HTTP 403). Please sign in again.", "error");
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 1000);
                throw new Error("Session expired or access denied (HTTP 403)");
            }
            const errorText = await response.text();
            throw new Error(errorText || `Failed to delete occurrence (HTTP ${response.status})`);
        }
        showToast("Single occurrence deleted.", "info");
        loadTodos();
    })
    .catch(error => {
        handleFetchError(error, "Failed to delete occurrence");
    });
}

// -------------------------------------------------------------
// Data Loading & Persistence (CRUD)
// -------------------------------------------------------------
function loadTodos() {
    const currentToken = getToken();
    if (!currentToken || isTokenExpired(currentToken)) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return;
    }

    // Update user info displays
    const email = getLoggedInEmail();
    const userEmailElems = document.querySelectorAll("#user-email, #settings-user-email");
    userEmailElems.forEach(el => el.textContent = email);

    const userAvatar = document.getElementById("user-avatar");
    if (userAvatar && email) {
        userAvatar.textContent = email.charAt(0).toUpperCase();
    }

    // Load custom categories & preferences from localStorage
    loadUserPreferences();

    fetch(`${getServerUrl()}/api/todo`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${currentToken}`
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("token");
                throw new Error("Session expired. Please log in again.");
            }
            throw new Error("Failed to load Todos");
        }
        return response.json();
    })
    .then(rawTodos => {
        state.todos = (rawTodos || []).map(parseTodoMetadata);
        renderCurrentView();
        updateAnalytics();
        renderMassMeterAndAchievements();
        updateStreaks();
        updateNotifications();
    })
    .catch(error => {
        handleFetchError(error, "Failed to load Todos");
        if (error.message && error.message.includes("Session expired")) {
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1000);
        }
    });
}

async function addTodo(taskData = {}) {
    const currentToken = getToken();
    if (!currentToken || isTokenExpired(currentToken)) {
        state.isSubmittingTask = false;
        const saveBtn = document.getElementById("modal-task-save-btn");
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Mission";
        }
        localStorage.removeItem("token");
        showToast("Session expired or missing. Please sign in again.", "error");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 800);
        return;
    }

    const title = taskData.title || document.getElementById("modal-task-title")?.value.trim();
    if (!title) {
        state.isSubmittingTask = false;
        const saveBtn = document.getElementById("modal-task-save-btn");
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Mission";
        }
        showToast("Task title is required", "error");
        return;
    }

    const desc = taskData.description !== undefined ? taskData.description : (document.getElementById("modal-task-desc")?.value.trim() || "");
    const dueDate = taskData.dueDate || document.getElementById("modal-task-due")?.value || getTodayDateString();
    const priority = taskData.priority || document.getElementById("modal-task-priority")?.value || "Medium";
    const category = taskData.category || document.getElementById("modal-task-category")?.value || "Work";
    const goal = taskData.goal !== undefined && taskData.goal !== null ? Number(taskData.goal) : (Number(document.getElementById("modal-task-goal")?.value) || 30);
    const completedDates = Array.isArray(taskData.completedDates) ? taskData.completedDates : [];

    const recurrence = taskData.recurrence || {
        frequency: document.getElementById("modal-task-repeat")?.value || "none",
        customDays: getSelectedCustomDays(),
        endType: document.querySelector('input[name="modal-repeat-end"]:checked')?.value || "never",
        endDate: document.getElementById("modal-repeat-end-date")?.value || null,
        endCount: Number(document.getElementById("modal-repeat-end-count")?.value) || 10
    };

    const isRecurring = recurrence && recurrence.frequency && recurrence.frequency !== "none";
    const seriesId = isRecurring
        ? (recurrence.seriesId || ("series_" + Date.now() + "_" + Math.floor(Math.random() * 1000)))
        : null;
    const taskRecurrence = isRecurring
        ? {
            ...recurrence,
            seriesId,
            isPaused: false
        }
        : { frequency: "none" };

    const saveBtn = document.getElementById("modal-task-save-btn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = isRecurring ? "Scheduling..." : "Saving...";
    }
    state.isSubmittingTask = true;

    const abortCtrl = new AbortController();
    state.activeTaskAbortController = abortCtrl;

    // Progressive status updates for remote cold start (e.g., Render free tier)
    const wakeTimer1 = setTimeout(() => {
        if (state.isSubmittingTask && saveBtn) {
            saveBtn.textContent = "Waking server... ⏳";
        }
    }, 2800);

    const wakeTimer2 = setTimeout(() => {
        if (state.isSubmittingTask && saveBtn) {
            saveBtn.textContent = "Almost ready... ☕";
        }
    }, 12000);

    const timeoutTimer = setTimeout(() => {
        try {
            abortCtrl.abort();
        } catch (e) {}
    }, 45000);

    try {
        const payload = serializeTodoForBackend({
            title,
            description: desc,
            dueDate,
            priority,
            category,
            completed: false,
            goal,
            completedDates,
            recurrence: taskRecurrence
        });

        // Exactly one create request per click
        const res = await fetch(`${getServerUrl()}/api/todo/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify(payload),
            signal: abortCtrl.signal
        });

        clearTimeout(wakeTimer1);
        clearTimeout(wakeTimer2);
        clearTimeout(timeoutTimer);

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem("token");
                showToast("Access forbidden or session expired (HTTP 403). Please sign in again.", "error");
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 1000);
                return;
            }
            const errorMsg = await res.text();
            throw new Error(errorMsg || `Failed to create mission (HTTP ${res.status})`);
        }

        const createdTask = await res.json();
        closeTaskModal();
        const successMsg = isRecurring
            ? `Recurring mission "${createdTask.title || title}" scheduled successfully! 🔁`
            : "Mission created successfully!";
        showToast(successMsg, "success");
        loadTodos();
    } catch (error) {
        clearTimeout(wakeTimer1);
        clearTimeout(wakeTimer2);
        clearTimeout(timeoutTimer);
        if (error.name === "AbortError") {
            showToast("Server took too long to respond. The server is now awake — please click Save again!", "warning");
        } else {
            handleFetchError(error, "Failed to create mission");
        }
    } finally {
        clearTimeout(wakeTimer1);
        clearTimeout(wakeTimer2);
        clearTimeout(timeoutTimer);
        state.isSubmittingTask = false;
        state.activeTaskAbortController = null;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Mission";
        }
    }
}

function updateTodoStatus(todo, onRevert) {
    const currentToken = getToken();
    if (!currentToken || isTokenExpired(currentToken)) {
        if (typeof onRevert === "function") onRevert();
        localStorage.removeItem("token");
        showToast("Session expired or access denied (HTTP 403). Please log in again.", "error");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 800);
        return;
    }

    const payload = serializeTodoForBackend({
        id: todo.id,
        title: todo.title,
        cleanDescription: todo.cleanDescription !== undefined ? todo.cleanDescription : "",
        dueDate: todo.dueDate,
        priority: todo.priority,
        category: todo.category,
        completed: todo.completed,
        goal: todo.goal,
        completedDates: todo.completedDates,
        recurrence: todo.recurrence
    });

    fetch(`${getServerUrl()}/api/todo`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify(payload)
    })
    .then(async response => {
        if (!response.ok) {
            // Self-heal: If /api/todo returned 404 (task id not found under current user in DB),
            // recreate under authenticated user so completion state & metadata are preserved seamlessly
            if (response.status === 404) {
                try {
                    const healPayload = { ...payload };
                    delete healPayload.id;
                    const createRes = await fetch(`${getServerUrl()}/api/todo/create`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${currentToken}`
                        },
                        body: JSON.stringify(healPayload)
                    });
                    if (createRes.ok) {
                        const newlyCreated = await createRes.json();
                        const oldId = payload.id;
                        if (oldId) {
                            const found = state.todos.find(t => t.id == oldId);
                            if (found) {
                                found.id = newlyCreated.id;
                            }
                        }
                        return newlyCreated;
                    }
                } catch (healErr) {
                    console.warn("Self-healing recreation failed:", healErr);
                }
            }
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("token");
                showToast("Access forbidden or session expired (HTTP 403). Please sign in again.", "error");
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 1000);
                throw new Error("Session expired or access denied (HTTP 403)");
            }
            const errorText = await response.text();
            throw new Error(errorText || `Failed to update task (HTTP ${response.status})`);
        }
        return response.json();
    })
    .then(updated => {
        const msg = todo.completed ? "Mission completed! 🔥" : "Mission reopened";
        showToast(msg, "info");
        // Update local state without full reload so UI stays snappy
        const idx = state.todos.findIndex(t => t.id == todo.id);
        if (idx !== -1 && updated) {
            state.todos[idx] = parseTodoMetadata(updated);
        }
        updateAnalytics();
        renderMassMeterAndAchievements();
        updateStreaks();
    })
    .catch(error => {
        if (typeof onRevert === "function") onRevert();
        handleFetchError(error, "Failed to update task status");
    });
}

function updateTodoDetails(taskData) {
    const currentToken = getToken();
    if (!currentToken || isTokenExpired(currentToken)) {
        localStorage.removeItem("token");
        showToast("Session expired or access denied (HTTP 403). Please log in again.", "error");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 800);
        return;
    }

    const payload = serializeTodoForBackend(taskData);

    const saveBtn = document.getElementById("modal-task-save-btn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Updating...";
    }
    state.isSubmittingTask = true;

    fetch(`${getServerUrl()}/api/todo`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify(payload)
    })
    .then(async response => {
        if (!response.ok) {
            if (response.status === 404) {
                try {
                    const healPayload = { ...payload };
                    delete healPayload.id;
                    const createRes = await fetch(`${getServerUrl()}/api/todo/create`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${currentToken}`
                        },
                        body: JSON.stringify(healPayload)
                    });
                    if (createRes.ok) {
                        return createRes.json();
                    }
                } catch (healErr) {
                    console.warn("Self-healing recreation failed:", healErr);
                }
            }
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("token");
                showToast("Access forbidden or session expired (HTTP 403). Please sign in again.", "error");
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 1000);
                throw new Error("Session expired or access denied (HTTP 403)");
            }
            const errorText = await response.text();
            throw new Error(errorText || `Failed to update task (HTTP ${response.status})`);
        }
        return response.json();
    })
    .then(updated => {
        closeTaskModal();
        showToast("Mission updated successfully!", "success");
        loadTodos();
    })
    .catch(error => {
        handleFetchError(error, "Failed to update task details");
    })
    .finally(() => {
        state.isSubmittingTask = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Mission";
        }
    });
}

function deleteTodo(id) {
    showConfirmModal("Are you sure you want to delete this mission? This cannot be undone.", () => {
        const currentToken = getToken();
        if (!currentToken || isTokenExpired(currentToken)) {
            localStorage.removeItem("token");
            showToast("Session expired or access denied (HTTP 403). Please log in again.", "error");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 800);
            return;
        }

        fetch(`${getServerUrl()}/api/todo/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${currentToken}`
            }
        })
        .then(async response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem("token");
                    showToast("Access forbidden or session expired (HTTP 403). Please sign in again.", "error");
                    setTimeout(() => {
                        window.location.href = "login.html";
                    }, 1000);
                    throw new Error("Session expired or access denied (HTTP 403)");
                }
                const errorText = await response.text();
                throw new Error(errorText || `Failed to delete mission (HTTP ${response.status})`);
            }
            showToast("Mission deleted.", "info");
            loadTodos();
        })
        .catch(error => {
            handleFetchError(error, "Failed to delete task");
        });
    });
}

// -------------------------------------------------------------
// UI Navigation, Route Sync & View Switcher
// -------------------------------------------------------------
function switchView(viewName, filterParam, updateHistory = true) {
    let targetSection = viewName;
    let targetFilter = filterParam;
    let activeNavKey = viewName;

    // Canonicalize route & section targets
    if (viewName === "today") {
        targetSection = "tasks";
        targetFilter = "today";
        activeNavKey = "today";
    } else if (viewName === "completed") {
        targetSection = "tasks";
        targetFilter = "completed";
        activeNavKey = "completed";
    } else if (viewName === "tasks" || viewName === "habits") {
        targetSection = "tasks";
        if (filterParam === "today") {
            activeNavKey = "today";
            targetFilter = "today";
        } else if (filterParam === "completed") {
            activeNavKey = "completed";
            targetFilter = "completed";
        } else {
            activeNavKey = "tasks";
            targetFilter = filterParam || "all";
        }
    } else if (viewName === "dashboard") {
        targetSection = "dashboard";
        activeNavKey = "dashboard";
    } else if (viewName === "categories") {
        targetSection = "categories";
        activeNavKey = "categories";
    } else if (viewName === "settings") {
        targetSection = "settings";
        activeNavKey = "settings";
    }

    state.currentView = targetSection;
    state.activeNav = activeNavKey;

    // 1. Toggle active content view section in DOM
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    const activeSec = document.getElementById(`view-${targetSection}`);
    if (activeSec) activeSec.classList.add("active");

    // 2. Synchronize active state on sidebar navigation item strictly
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(btn => {
        const itemKey = btn.getAttribute("data-view");
        btn.classList.toggle("active", itemKey === activeNavKey);
    });

    // 3. Update URL hash for direct access, refresh, back/forward navigation
    if (updateHistory && typeof window !== "undefined" && window.location) {
        let routeHash = activeNavKey;
        if (activeNavKey === "tasks") routeHash = "habits";
        if (window.location.hash !== `#${routeHash}`) {
            history.pushState({ route: routeHash }, "", `#${routeHash}`);
        }
    }

    // 4. Contextual Titles & Specific View Actions
    const titleElem = document.getElementById("page-title");
    const subElem = document.getElementById("page-subtitle");

    if (activeNavKey === "today") {
        if (titleElem) titleElem.textContent = "Today's Habits";
        if (subElem) subElem.textContent = "Focus on what needs to be executed today";
        applyTaskFilter("today", false);
    } else if (activeNavKey === "completed") {
        if (titleElem) titleElem.textContent = "Completed Habits";
        if (subElem) subElem.textContent = "Review finished habits and milestones";
        applyTaskFilter("completed", false);
    } else if (activeNavKey === "tasks") {
        if (titleElem) titleElem.textContent = "Habit Tracker";
        if (subElem) subElem.textContent = "Daily habits, targets, and consistency";
        if (targetFilter) applyTaskFilter(targetFilter, false);
    } else if (activeNavKey === "categories") {
        if (titleElem) titleElem.textContent = "Task Categories";
        if (subElem) subElem.textContent = "Domains and tags configuration";
        renderCategoriesView();
    } else if (activeNavKey === "settings") {
        if (titleElem) titleElem.textContent = "Settings";
        if (subElem) subElem.textContent = "Preferences & System Configuration";
    } else {
        if (titleElem) titleElem.textContent = "Dashboard";
        if (subElem) subElem.textContent = "Command Center & Analytics";
    }

    // Close mobile drawer if open
    toggleMobileSidebar(false);
    renderCurrentView();
}

function toggleMobileSidebar(open) {
    const sidebar = document.getElementById("app-sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (!sidebar || !backdrop) return;

    if (open) {
        sidebar.classList.add("drawer-open");
        backdrop.classList.add("active");
    } else {
        sidebar.classList.remove("drawer-open");
        backdrop.classList.remove("active");
    }
}

// -------------------------------------------------------------
// Task Card Component Renderer
// -------------------------------------------------------------
function createTodoCard(todo) {
    const card = document.createElement("div");
    card.className = "task-card-item";

    const isOverdue = !todo.completed && todo.dueDate && todo.dueDate < getTodayDateString();
    if (isOverdue) card.classList.add("is-overdue");
    if (todo.completed) card.classList.add("is-completed");

    // Checkbox Wrapper
    const checkboxWrap = document.createElement("label");
    checkboxWrap.className = "task-checkbox-wrap";
    checkboxWrap.title = todo.completed ? "Mark incomplete" : "Mark completed";

    const nativeCheckbox = document.createElement("input");
    nativeCheckbox.type = "checkbox";
    nativeCheckbox.className = "task-checkbox-native";
    nativeCheckbox.checked = todo.completed;

    nativeCheckbox.addEventListener("change", function () {
        const wasChecked = !nativeCheckbox.checked;
        const updatedTodo = {
            ...todo,
            completed: nativeCheckbox.checked
        };
        onTaskCheckboxUpdated(updatedTodo);
        updateTodoStatus(updatedTodo, () => {
            nativeCheckbox.checked = wasChecked;
            const reverted = { ...todo, completed: wasChecked };
            onTaskCheckboxUpdated(reverted);
        });
    });

    const customCheckbox = document.createElement("div");
    customCheckbox.className = "task-custom-checkbox";
    customCheckbox.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    `;

    checkboxWrap.appendChild(nativeCheckbox);
    checkboxWrap.appendChild(customCheckbox);

    // Task Info Block
    const infoBlock = document.createElement("div");
    infoBlock.className = "task-info-block";

    const titleRow = document.createElement("div");
    titleRow.className = "task-title-row";

    const titleSpan = document.createElement("span");
    titleSpan.className = "task-title-text";
    titleSpan.textContent = todo.title;
    titleRow.appendChild(titleSpan);
    infoBlock.appendChild(titleRow);

    if (todo.cleanDescription) {
        const descP = document.createElement("p");
        descP.className = "task-desc-text";
        descP.textContent = todo.cleanDescription;
        infoBlock.appendChild(descP);
    }

    // Meta Row: Badges
    const metaRow = document.createElement("div");
    metaRow.className = "task-meta-row";

    // Priority Badge
    const priorityClass = `badge-priority-${(todo.priority || "Medium").toLowerCase()}`;
    const priorityBadge = document.createElement("span");
    priorityBadge.className = `badge ${priorityClass}`;
    priorityBadge.textContent = todo.priority || "Medium";
    metaRow.appendChild(priorityBadge);

    // Category Badge
    const catBadge = document.createElement("span");
    catBadge.className = "badge badge-category";
    catBadge.textContent = todo.category || "Work";
    metaRow.appendChild(catBadge);

    // Due Date Badge
    const dueStatus = getRelativeDateStatus(todo.dueDate, todo.completed);
    const dueBadge = document.createElement("span");
    dueBadge.className = `badge badge-due ${dueStatus.class}`;
    dueBadge.textContent = dueStatus.text;
    metaRow.appendChild(dueBadge);

    // Recurrence Badge if applicable
    if (todo.recurrence && todo.recurrence.frequency && todo.recurrence.frequency !== "none") {
        const repeatBadge = document.createElement("span");
        if (todo.recurrence.isPaused) {
            repeatBadge.className = "badge badge-paused";
            repeatBadge.textContent = "⏸️ Paused";
        } else {
            repeatBadge.className = "badge badge-repeat";
            repeatBadge.textContent = `🔁 ${formatFrequency(todo.recurrence.frequency)}`;
        }
        metaRow.appendChild(repeatBadge);
    }

    infoBlock.appendChild(metaRow);

    // Actions Block
    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-task-action";
    editBtn.title = "Edit Mission";
    editBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
    `;
    editBtn.onclick = function (e) {
        e.stopPropagation();
        openEditTaskModal(todo);
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-task-action delete";
    deleteBtn.title = "Delete Mission";
    deleteBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
    `;
    deleteBtn.onclick = function (e) {
        e.stopPropagation();
        if (todo.recurrence && todo.recurrence.seriesId) {
            openSeriesActionModal(todo);
        } else {
            deleteTodo(todo.id);
        }
    };

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(checkboxWrap);
    card.appendChild(infoBlock);
    card.appendChild(actions);

    return card;
}

// -------------------------------------------------------------
// View Renderers
// -------------------------------------------------------------
function renderCurrentView() {
    if (state.currentView === "dashboard") {
        renderDashboardView();
    } else if (state.currentView === "tasks") {
        renderTasksView();
    } else if (state.currentView === "categories") {
        renderCategoriesView();
    }
}

function renderDashboardView() {
    // Dashboard widgets (Daily Mass Meter, Streaks & Milestones) are updated via updateDashboardMetrics()
}

function renderTasksView() {
    const list = document.getElementById("todo-list");
    const container = document.getElementById("habit-tracker-container");
    const emptyState = document.getElementById("empty-message");
    if (!list) return;

    // Render Category Pills in task view
    renderCategoryPills();

    // Filter tasks
    let filtered = filterTasks(state.todos, state.activeFilter, state.activeCategory, state.searchQuery);

    // Sort tasks
    filtered = sortTasks(filtered, state.sortBy);

    if (filtered.length === 0) {
        if (container) container.style.display = "none";
        list.style.display = "none";
        if (emptyState) {
            emptyState.style.display = "flex";
            const emptyTitle = document.getElementById("empty-state-title");
            const emptyDesc = document.getElementById("empty-state-desc");
            if (emptyTitle && emptyDesc) {
                if (state.searchQuery) {
                    emptyTitle.textContent = "No Habits Found";
                    emptyDesc.textContent = `No habits matched your query "${state.searchQuery}".`;
                } else if (state.activeFilter === "overdue") {
                    emptyTitle.textContent = "No Overdue Habits! 🎉";
                    emptyDesc.textContent = "All your scheduled habits are up to date or completed.";
                } else {
                    emptyTitle.textContent = "No Habits in this Filter";
                    emptyDesc.textContent = "Create a new habit or load starter habits from the reference sheet.";
                }
            }
        }
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    const mode = state.habitViewMode || "spreadsheet";
    const btnSpreadsheet = document.getElementById("btn-view-spreadsheet");
    const btnCards = document.getElementById("btn-view-cards");

    if (mode === "spreadsheet") {
        if (btnSpreadsheet) btnSpreadsheet.classList.add("active");
        if (btnCards) btnCards.classList.remove("active");
        if (container) container.style.display = "flex";
        list.style.display = "none";
        renderHabitTrackerView();
    } else {
        if (btnCards) btnCards.classList.add("active");
        if (btnSpreadsheet) btnSpreadsheet.classList.remove("active");
        if (container) container.style.display = "none";
        list.style.display = "grid";
        list.innerHTML = "";
        filtered.forEach(todo => {
            list.appendChild(createTodoCard(todo));
        });
    }
}

// -------------------------------------------------------------
// Spreadsheet Habit Tracker Engine (Reference Design Inspired)
// -------------------------------------------------------------

function getHabitIcon(rawTitle, category) {
    if (!rawTitle) return { icon: "✨", cleanTitle: "Untitled Habit" };

    const titleStr = rawTitle.trim();
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
    const match = titleStr.match(emojiRegex);

    let icon = match ? match[0] : "";
    let cleanTitle = titleStr;

    if (!icon) {
        const lower = titleStr.toLowerCase();
        if (lower.includes("wake") || lower.includes("alarm") || lower.includes("morning")) icon = "⏰";
        else if (lower.includes("snooze") || lower.includes("snoozing")) icon = "🚫⏰";
        else if (lower.includes("water") || lower.includes("drink") || lower.includes("hydrate")) icon = "💧";
        else if (lower.includes("gym") || lower.includes("workout") || lower.includes("fitness") || lower.includes("lift")) icon = "🏋️";
        else if (lower.includes("stretch") || lower.includes("stretching") || lower.includes("flex")) icon = "🧘";
        else if (lower.includes("read") || lower.includes("book") || lower.includes("pages")) icon = "📖";
        else if (lower.includes("meditat") || lower.includes("mindfulness")) icon = "🧘";
        else if (lower.includes("study") || lower.includes("learn") || lower.includes("exam") || lower.includes("course") || lower.includes("degree")) icon = "🎓";
        else if (lower.includes("skin") || lower.includes("skincare") || lower.includes("face")) icon = "✨";
        else if (lower.includes("social") || lower.includes("phone") || lower.includes("screen") || lower.includes("instagram")) icon = "📵";
        else if (lower.includes("alcohol") || lower.includes("beer") || lower.includes("wine") || lower.includes("drink")) icon = "🚫🍷";
        else if (lower.includes("expense") || lower.includes("money") || lower.includes("budget") || lower.includes("save") || lower.includes("dollar")) icon = "💵";
        else if (lower.includes("code") || lower.includes("program") || lower.includes("develop") || lower.includes("git")) icon = "💻";
        else if (lower.includes("walk") || lower.includes("run") || lower.includes("steps") || lower.includes("jog")) icon = "🏃";
        else if (lower.includes("eat") || lower.includes("food") || lower.includes("diet") || lower.includes("meal")) icon = "🥗";
        else if (lower.includes("write") || lower.includes("journal") || lower.includes("blog")) icon = "✍️";
        else if (lower.includes("clean") || lower.includes("chores") || lower.includes("tidy")) icon = "🧹";
        else if (lower.includes("sleep") || lower.includes("bed") || lower.includes("rest")) icon = "😴";
        else {
            const cat = (category || "").toLowerCase();
            if (cat.includes("health") || cat.includes("fitness")) icon = "🏃";
            else if (cat.includes("learning") || cat.includes("education")) icon = "📚";
            else if (cat.includes("work")) icon = "💼";
            else if (cat.includes("shopping")) icon = "🛒";
            else icon = "🎯";
        }
    }

    return { icon, cleanTitle };
}

function setHabitTrackerViewMode(mode) {
    state.habitViewMode = mode;
    localStorage.setItem("taskverse_view_mode", mode);
    renderTasksView();
}

function navigateHabitTrackerMonth(delta) {
    state.habitTrackerMonth += delta;
    if (state.habitTrackerMonth > 11) {
        state.habitTrackerMonth = 0;
        state.habitTrackerYear++;
    } else if (state.habitTrackerMonth < 0) {
        state.habitTrackerMonth = 11;
        state.habitTrackerYear--;
    }
    renderHabitTrackerView();
}

function resetHabitTrackerToCurrentMonth() {
    const now = new Date();
    state.habitTrackerMonth = now.getMonth();
    state.habitTrackerYear = now.getFullYear();
    renderHabitTrackerView();
}

function isHabitScheduledForDate(task, dateStr) {
    if (!task) return false;
    const compDates = Array.isArray(task.completedDates) ? task.completedDates : [];
    if (compDates.includes(dateStr) || (task.dueDate === dateStr && task.completed)) {
        return true;
    }
    const recurrence = task.recurrence || { frequency: "none" };
    const freq = recurrence.frequency || "none";
    if (recurrence.endType === "date" && recurrence.endDate && dateStr > recurrence.endDate) {
        return false;
    }
    const parts = dateStr.split("-").map(Number);
    const cellDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = cellDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    if (freq === "daily") return true;
    if (freq === "weekday") return dayOfWeek >= 1 && dayOfWeek <= 5;
    if (freq === "custom_days") {
        const custom = Array.isArray(recurrence.customDays) ? recurrence.customDays : [1, 2, 3, 4, 5];
        return custom.includes(dayOfWeek);
    }
    if (freq === "weekly") {
        if (task.dueDate) {
            const startParts = task.dueDate.split("-").map(Number);
            const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
            return dayOfWeek === startDate.getDay();
        }
        return dayOfWeek === 1;
    }
    if (freq === "monthly") {
        if (task.dueDate) {
            const startParts = task.dueDate.split("-").map(Number);
            return parts[2] === startParts[2];
        }
        return parts[2] === 1;
    }
    if (freq === "none") {
        return task.dueDate ? task.dueDate === dateStr : true;
    }
    return true;
}

function toggleHabitDay(taskId, dateStr, isChecked) {
    const todayStr = getTodayDateString();

    // Lock past dates: cannot mark or unmark once date has passed
    if (dateStr < todayStr) {
        showToast("Past dates are permanently locked.", "error");
        renderHabitTrackerView();
        return;
    }

    // Lock future dates: cannot mark ahead of time
    if (dateStr > todayStr) {
        showToast("Future dates cannot be marked in advance.", "error");
        renderHabitTrackerView();
        return;
    }

    const todo = state.todos.find(t => t.id == taskId);
    if (!todo) return;

    let completedDates = Array.isArray(todo.completedDates) ? [...todo.completedDates] : [];

    if (isChecked) {
        if (!completedDates.includes(dateStr)) {
            completedDates.push(dateStr);
        }
    } else {
        completedDates = completedDates.filter(d => d !== dateStr);
    }

    let newCompleted = todo.completed;
    if (dateStr === todayStr || dateStr === todo.dueDate) {
        newCompleted = isChecked;
    }

    const resolvedId = (todo.id !== undefined && todo.id !== null) ? Number(todo.id) : (taskId !== undefined ? Number(taskId) : undefined);

    const updatedTodo = {
        ...todo,
        id: resolvedId,
        completedDates,
        completed: newCompleted,
        isCompleted: newCompleted
    };

    // Optimistic in-memory update
    const idx = state.todos.findIndex(t => t.id == taskId);
    if (idx !== -1) {
        state.todos[idx] = updatedTodo;
    }

    // Persist to local cache immediately
    const cacheKey = "taskverse_habit_dates_" + (resolvedId || todo.title);
    try {
        localStorage.setItem(cacheKey, JSON.stringify(completedDates));
    } catch (e) {}

    // Trigger achievement effects if toggled for today
    if (dateStr === todayStr) {
        onTaskCheckboxUpdated(updatedTodo);
    }

    updateAnalytics();
    updateStreaks();
    renderHabitTrackerView();

    // Persist to backend
    updateTodoStatus(updatedTodo, () => {
        if (idx !== -1) {
            state.todos[idx] = todo;
            renderHabitTrackerView();
            updateAnalytics();
        }
    });
}

function renderHabitTrackerView() {
    const thead = document.getElementById("ht-table-thead");
    const tbody = document.getElementById("ht-table-tbody");
    const tfoot = document.getElementById("ht-table-tfoot");
    const periodLabel = document.getElementById("ht-period-label");
    const metricCount = document.getElementById("ht-metric-count");
    const metricToday = document.getElementById("ht-metric-today");
    const metricConsistency = document.getElementById("ht-metric-consistency");

    if (!thead || !tbody || !tfoot) return;

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const year = state.habitTrackerYear;
    const month = state.habitTrackerMonth;

    if (periodLabel) {
        periodLabel.textContent = `${monthNames[month]} ${year}`;
    }

    // Filter tasks using existing active filter and search
    let filtered = filterTasks(state.todos, state.activeFilter, state.activeCategory, state.searchQuery);
    filtered = sortTasks(filtered, state.sortBy);

    // Days in current viewed month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthDays = [];
    const todayStr = getTodayDateString();

    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const dayOfWeek = dayNamesShort[dateObj.getDay()];
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        monthDays.push({ dayNum: d, dayName: dayOfWeek, dateStr });
    }

    // Group days into weeks (Week 1: days 1..7, Week 2: days 8..14, etc.)
    const weeks = [];
    for (let i = 0; i < monthDays.length; i += 7) {
        weeks.push({
            weekIndex: Math.floor(i / 7) + 1,
            days: monthDays.slice(i, i + 7)
        });
    }

    // 1. Build THEAD
    let headHtml = `
        <tr>
            <th class="ht-col-num ht-th-sticky-1" rowspan="2">#</th>
            <th class="ht-col-habit ht-th-sticky-2" rowspan="2">DAILY HABITS</th>
            <th class="ht-col-goal ht-th-sticky-3" rowspan="2">GOALS</th>
    `;

    weeks.forEach(w => {
        headHtml += `<th class="ht-th-week" colspan="${w.days.length}">WEEK ${w.weekIndex}</th>`;
    });
    headHtml += `</tr><tr>`;

    monthDays.forEach(d => {
        const isToday = d.dateStr === todayStr;
        headHtml += `
            <th class="ht-th-day ${isToday ? 'is-today' : ''}" title="${d.dateStr}">
                <span class="ht-day-name">${d.dayName}</span>
                <span class="ht-day-num">${d.dayNum}</span>
            </th>
        `;
    });
    headHtml += `</tr>`;
    thead.innerHTML = headHtml;

    // 2. Build TBODY
    tbody.innerHTML = "";

    const dayCompletedTotals = {};
    monthDays.forEach(d => { dayCompletedTotals[d.dateStr] = 0; });

    let totalHabitsTodayEligible = 0;
    let totalHabitsTodayCompleted = 0;
    let totalCompletedMonthAll = 0;
    let totalGoalAll = 0;

    filtered.forEach((task, idx) => {
        const tr = document.createElement("tr");
        tr.className = "ht-row";
        tr.setAttribute("data-task-id", task.id);

        const iconInfo = getHabitIcon(task.title, task.category);
        const goal = task.goal !== undefined && task.goal !== null ? Number(task.goal) : 30;
        totalGoalAll += goal;

        const compDates = Array.isArray(task.completedDates) ? task.completedDates : [];
        let monthCompletions = 0;

        monthDays.forEach(d => {
            const isDone = compDates.includes(d.dateStr) || (d.dateStr === task.dueDate && task.completed);
            if (isDone) {
                monthCompletions++;
                dayCompletedTotals[d.dateStr]++;
            }
        });
        totalCompletedMonthAll += monthCompletions;

        const isTodayDone = compDates.includes(todayStr) || (task.dueDate === todayStr && task.completed);
        totalHabitsTodayEligible++;
        if (isTodayDone) totalHabitsTodayCompleted++;

        // Cell 1: Number (Sticky 1)
        const tdNum = document.createElement("td");
        tdNum.className = "ht-cell-num ht-td-sticky-1";
        tdNum.textContent = idx + 1;
        tr.appendChild(tdNum);

        // Cell 2: Habit Details (Sticky 2)
        const tdHabit = document.createElement("td");
        tdHabit.className = "ht-cell-habit ht-td-sticky-2";

        const habitWrap = document.createElement("div");
        habitWrap.className = "ht-habit-content-wrapper";

        const iconSpan = document.createElement("span");
        iconSpan.className = "ht-habit-icon";
        iconSpan.textContent = iconInfo.icon;
        habitWrap.appendChild(iconSpan);

        const detailsDiv = document.createElement("div");
        detailsDiv.className = "ht-habit-details";

        const titleSpan = document.createElement("span");
        titleSpan.className = "ht-habit-title";
        titleSpan.textContent = iconInfo.cleanTitle;
        titleSpan.title = task.title;
        detailsDiv.appendChild(titleSpan);

        const catBadge = document.createElement("span");
        catBadge.className = "badge badge-category ht-badge-mini";
        catBadge.textContent = task.category || "Work";
        detailsDiv.appendChild(catBadge);
        habitWrap.appendChild(detailsDiv);

        // Hover action buttons (Edit, Delete)
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "ht-row-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "ht-action-btn";
        editBtn.title = "Edit Habit";
        editBtn.innerHTML = `✏️`;
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openEditTaskModal(task);
        };

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "ht-action-btn delete";
        delBtn.title = "Delete Habit";
        delBtn.innerHTML = `🗑️`;
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (task.recurrence && task.recurrence.seriesId) {
                openSeriesActionModal(task);
            } else {
                deleteTodo(task.id);
            }
        };

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(delBtn);
        habitWrap.appendChild(actionsDiv);

        tdHabit.appendChild(habitWrap);
        tr.appendChild(tdHabit);

        // Cell 3: Goals (Sticky 3)
        const tdGoal = document.createElement("td");
        tdGoal.className = "ht-cell-goal ht-td-sticky-3";
        const isAchieved = monthCompletions >= goal;
        tdGoal.innerHTML = `
            <div class="ht-goal-wrap ${isAchieved ? 'is-achieved' : ''}" title="${monthCompletions}/${goal} completed this month">
                <span class="ht-goal-target">${goal}</span>
                <span class="ht-goal-progress">${monthCompletions} done</span>
            </div>
        `;
        tr.appendChild(tdGoal);

        // Day Checkbox Cells
        monthDays.forEach(d => {
            const tdDay = document.createElement("td");
            const isToday = d.dateStr === todayStr;
            const isPast = d.dateStr < todayStr;
            const isFuture = d.dateStr > todayStr;
            const isDone = compDates.includes(d.dateStr) || (d.dateStr === task.dueDate && task.completed);
            const isScheduled = isHabitScheduledForDate(task, d.dateStr);

            let cellClass = `ht-cell-day ${isToday ? 'ht-cell-today' : ''}`;
            if (isPast && !isDone && isScheduled) {
                cellClass += " ht-cell-missed";
            }
            tdDay.className = cellClass;

            if (isDone) {
                // Scenario A: Past completed (or Scenario C completed for today)
                const wrap = document.createElement("label");
                wrap.className = `ht-checkbox-wrap ${isPast ? 'is-locked-done' : ''}`;
                wrap.title = `${task.title} - ${d.dateStr} (Completed${isPast ? ' - Locked' : ''})`;

                const input = document.createElement("input");
                input.type = "checkbox";
                input.className = "ht-checkbox-native";
                input.checked = true;
                if (isPast) {
                    input.disabled = true;
                } else {
                    input.onchange = function () {
                        toggleHabitDay(task.id, d.dateStr, input.checked);
                    };
                }

                const visual = document.createElement("div");
                visual.className = "ht-checkbox-visual";
                visual.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                `;

                wrap.appendChild(input);
                wrap.appendChild(visual);
                tdDay.appendChild(wrap);
            } else if (isPast) {
                // Scenario B: Past Incomplete
                if (isScheduled) {
                    // Missed Habit -> Red X (✕) locked
                    const wrap = document.createElement("label");
                    wrap.className = "ht-checkbox-wrap is-locked-missed";
                    wrap.title = `Missed: ${task.title} - ${d.dateStr} (Locked)`;

                    const input = document.createElement("input");
                    input.type = "checkbox";
                    input.className = "ht-checkbox-native";
                    input.disabled = true;

                    const visual = document.createElement("div");
                    visual.className = "ht-checkbox-visual is-missed";
                    visual.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    `;

                    wrap.appendChild(input);
                    wrap.appendChild(visual);
                    tdDay.appendChild(wrap);
                } else {
                    // Past date, not scheduled for this habit
                    const notSched = document.createElement("div");
                    notSched.className = "ht-not-scheduled-indicator";
                    notSched.title = `${task.title} - Not scheduled for ${d.dateStr}`;
                    notSched.innerHTML = `<span>—</span>`;
                    tdDay.appendChild(notSched);
                }
            } else if (isToday) {
                // Scenario C: Today Incomplete -> Enabled and functional
                const wrap = document.createElement("label");
                wrap.className = "ht-checkbox-wrap";
                wrap.title = `${task.title} - Today (${d.dateStr})`;

                const input = document.createElement("input");
                input.type = "checkbox";
                input.className = "ht-checkbox-native";
                input.checked = false;
                input.onchange = function () {
                    toggleHabitDay(task.id, d.dateStr, input.checked);
                };

                const visual = document.createElement("div");
                visual.className = "ht-checkbox-visual";
                visual.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                `;

                wrap.appendChild(input);
                wrap.appendChild(visual);
                tdDay.appendChild(wrap);
            } else {
                // Scenario D: Future dates -> Disabled
                if (isScheduled) {
                    const wrap = document.createElement("label");
                    wrap.className = "ht-checkbox-wrap is-future-locked";
                    wrap.title = `${task.title} - ${d.dateStr} (Future date)`;

                    const input = document.createElement("input");
                    input.type = "checkbox";
                    input.className = "ht-checkbox-native";
                    input.disabled = true;

                    const visual = document.createElement("div");
                    visual.className = "ht-checkbox-visual";
                    visual.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    `;

                    wrap.appendChild(input);
                    wrap.appendChild(visual);
                    tdDay.appendChild(wrap);
                } else {
                    const notSched = document.createElement("div");
                    notSched.className = "ht-not-scheduled-indicator";
                    notSched.title = `${task.title} - Not scheduled for ${d.dateStr}`;
                    notSched.innerHTML = `<span>—</span>`;
                    tdDay.appendChild(notSched);
                }
            }
            tr.appendChild(tdDay);
        });

        tbody.appendChild(tr);
    });

    // 3. Build TFOOT (Daily completion summary)
    tfoot.innerHTML = "";
    const trFoot = document.createElement("tr");
    trFoot.className = "ht-summary-row";

    const tdFootNum = document.createElement("td");
    tdFootNum.className = "ht-td-sticky-1";
    trFoot.appendChild(tdFootNum);

    const tdFootLabel = document.createElement("td");
    tdFootLabel.className = "ht-td-sticky-2 ht-summary-label";
    tdFootLabel.textContent = "DAILY COMPLETION";
    trFoot.appendChild(tdFootLabel);

    const tdFootGoal = document.createElement("td");
    tdFootGoal.className = "ht-td-sticky-3 ht-summary-goal";
    tdFootGoal.textContent = totalGoalAll;
    tdFootGoal.title = "Total Goals Target for Month";
    trFoot.appendChild(tdFootGoal);

    monthDays.forEach(d => {
        const count = dayCompletedTotals[d.dateStr] || 0;
        const total = filtered.length;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isToday = d.dateStr === todayStr;

        const tdSummary = document.createElement("td");
        tdSummary.className = `ht-cell-day ${isToday ? 'ht-cell-today' : ''}`;
        tdSummary.innerHTML = `
            <div class="ht-cell-summary" title="${d.dateStr}: ${count}/${total} (${pct}%)">
                <span class="ht-summary-count">${count}</span>
                <span class="ht-summary-pct">${pct}%</span>
            </div>
        `;
        trFoot.appendChild(tdSummary);
    });

    tfoot.appendChild(trFoot);

    // 4. Update Header Metrics
    if (metricCount) metricCount.textContent = filtered.length;
    if (metricToday) metricToday.textContent = `${totalHabitsTodayCompleted}/${totalHabitsTodayEligible}`;
    const overallConsistency = totalGoalAll > 0
        ? Math.min(100, Math.round((totalCompletedMonthAll / totalGoalAll) * 100))
        : (filtered.length > 0 ? Math.round((totalHabitsTodayCompleted / filtered.length) * 100) : 0);
    if (metricConsistency) metricConsistency.textContent = `${overallConsistency}%`;
}

async function loadStarterHabitTemplates() {
    const starterHabits = [
        { title: "Wake up at 6AM ⏰", goal: 30, category: "Personal", priority: "High" },
        { title: "No Snoozing 🚫⏰", goal: 30, category: "Personal", priority: "Medium" },
        { title: "Drink 3L Water 💧", goal: 30, category: "Personal", priority: "High" },
        { title: "Gym Workout 🏋️", goal: 20, category: "Personal", priority: "High" },
        { title: "Stretching 🧘", goal: 30, category: "Personal", priority: "Medium" },
        { title: "Read 10 Pages 📖", goal: 30, category: "Learning", priority: "Medium" },
        { title: "Meditation 🧘", goal: 30, category: "Personal", priority: "Medium" },
        { title: "Study 1 Hour 🎓", goal: 30, category: "Learning", priority: "High" },
        { title: "Skincare Routine ✨", goal: 30, category: "Personal", priority: "Low" },
        { title: "Limit Social Media 📵", goal: 30, category: "Personal", priority: "High" },
        { title: "No Alcohol 🚫🍷", goal: 30, category: "Personal", priority: "High" },
        { title: "Track Expenses 💵", goal: 30, category: "Work", priority: "Medium" }
    ];

    const currentToken = getToken();
    if (!currentToken || isTokenExpired(currentToken)) {
        localStorage.removeItem("token");
        showToast("Session expired or missing. Please sign in again.", "error");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 800);
        return;
    }

    showToast("Adding reference habit tracker templates...", "info");
    const todayStr = getTodayDateString();

    try {
        for (const h of starterHabits) {
            const alreadyExists = state.todos.some(t => t.title.toLowerCase() === h.title.toLowerCase());
            if (!alreadyExists) {
                const payload = serializeTodoForBackend({
                    title: h.title,
                    description: "",
                    dueDate: todayStr,
                    priority: h.priority,
                    category: h.category,
                    completed: false,
                    goal: h.goal,
                    completedDates: [],
                    recurrence: { frequency: "daily" }
                });

                const res = await fetch(`${getServerUrl()}/api/todo/create`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${currentToken}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        localStorage.removeItem("token");
                        showToast("Session expired (HTTP 403). Please sign in again.", "error");
                        setTimeout(() => {
                            window.location.href = "login.html";
                        }, 1000);
                        return;
                    }
                }
            }
        }
        showToast("Starter habits loaded successfully! 🚀", "success");
        loadTodos();
    } catch (e) {
        handleFetchError(e, "Failed to load starter habits");
    }
}

function filterTasks(todos, filterType, category, query) {
    const todayStr = getTodayDateString();

    return todos.filter(todo => {
        // Query search across title and description
        if (query) {
            const q = query.toLowerCase();
            const matchTitle = (todo.title || "").toLowerCase().includes(q);
            const matchDesc = (todo.cleanDescription || "").toLowerCase().includes(q);
            const matchCat = (todo.category || "").toLowerCase().includes(q);
            if (!matchTitle && !matchDesc && !matchCat) return false;
        }

        // Category filter
        if (category && category !== "all") {
            if ((todo.category || "Work").toLowerCase() !== category.toLowerCase()) return false;
        }

        // Status / Date Filter
        switch (filterType) {
            case "today":
                return todo.dueDate === todayStr;
            case "upcoming":
                return todo.dueDate && todo.dueDate > todayStr && !todo.completed;
            case "pending":
                return !todo.completed;
            case "completed":
                return todo.completed;
            case "overdue":
                return !todo.completed && todo.dueDate && todo.dueDate < todayStr;
            case "high":
                return (todo.priority || "").toLowerCase() === "high";
            case "all":
            default:
                return true;
        }
    });
}

function sortTasks(todos, sortBy) {
    const priorityWeight = { High: 3, Medium: 2, Low: 1 };
    const list = [...todos];

    list.sort((a, b) => {
        if (sortBy === "priority") {
            const pA = priorityWeight[a.priority] || 2;
            const pB = priorityWeight[b.priority] || 2;
            if (pB !== pA) return pB - pA;
            return (a.dueDate || "9999") > (b.dueDate || "9999") ? 1 : -1;
        } else if (sortBy === "newest") {
            return (b.id || 0) - (a.id || 0);
        } else if (sortBy === "title") {
            return (a.title || "").localeCompare(b.title || "");
        } else {
            // dueDate earliest first (nulls last)
            const dateA = a.dueDate || "9999-12-31";
            const dateB = b.dueDate || "9999-12-31";
            return dateA.localeCompare(dateB);
        }
    });

    return list;
}

function applyTaskFilter(filterName, syncNav = true) {
    state.activeFilter = filterName;
    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.classList.toggle("active", pill.getAttribute("data-filter") === filterName);
    });

    if (syncNav) {
        let activeNavKey = "tasks";
        let routeHash = "habits";
        if (filterName === "today") {
            activeNavKey = "today";
            routeHash = "today";
        } else if (filterName === "completed") {
            activeNavKey = "completed";
            routeHash = "completed";
        }

        state.activeNav = activeNavKey;

        // Synchronize sidebar nav item
        document.querySelectorAll(".sidebar-nav .nav-item").forEach(btn => {
            const itemKey = btn.getAttribute("data-view");
            btn.classList.toggle("active", itemKey === activeNavKey);
        });

        // Update URL hash without reload
        if (typeof window !== "undefined" && window.location && window.location.hash !== `#${routeHash}`) {
            history.pushState({ route: routeHash }, "", `#${routeHash}`);
        }

        // Update Contextual Title
        const titleElem = document.getElementById("page-title");
        const subElem = document.getElementById("page-subtitle");
        if (activeNavKey === "today") {
            if (titleElem) titleElem.textContent = "Today's Habits";
            if (subElem) subElem.textContent = "Focus on what needs to be executed today";
        } else if (activeNavKey === "completed") {
            if (titleElem) titleElem.textContent = "Completed Habits";
            if (subElem) subElem.textContent = "Review finished habits and milestones";
        } else {
            if (titleElem) titleElem.textContent = "Habit Tracker";
            if (subElem) subElem.textContent = "Daily habits, targets, and consistency";
        }
    }

    renderTasksView();
}

function applyCategoryFilter(catName) {
    state.activeCategory = catName;
    renderTasksView();
}

function applyTaskSort(sortVal) {
    state.sortBy = sortVal;
    renderTasksView();
}

function handleSearch(query) {
    state.searchQuery = query.trim();
    if (state.currentView !== "tasks") {
        switchView("tasks");
    } else {
        renderTasksView();
    }
}

// -------------------------------------------------------------
// Category Navigation & View
// -------------------------------------------------------------
function renderCategoryPills() {
    const bar = document.getElementById("category-pills-bar");
    if (!bar) return;

    bar.innerHTML = "";

    const allPill = document.createElement("button");
    allPill.className = `cat-pill ${state.activeCategory === "all" ? "active" : ""}`;
    allPill.textContent = "All Categories";
    allPill.onclick = () => applyCategoryFilter("all");
    bar.appendChild(allPill);

    state.customCategories.forEach(cat => {
        const count = state.todos.filter(t => (t.category || "Work").toLowerCase() === cat.toLowerCase()).length;
        const pill = document.createElement("button");
        pill.className = `cat-pill ${state.activeCategory.toLowerCase() === cat.toLowerCase() ? "active" : ""}`;
        pill.textContent = `${cat} (${count})`;
        pill.onclick = () => applyCategoryFilter(cat);
        bar.appendChild(pill);
    });
}

function renderCategoriesView() {
    const grid = document.getElementById("categories-grid");
    if (!grid) return;

    grid.innerHTML = "";

    state.customCategories.forEach(cat => {
        const catTasks = state.todos.filter(t => (t.category || "Work").toLowerCase() === cat.toLowerCase());
        const completedCount = catTasks.filter(t => t.completed).length;
        const isDefault = ["Work", "Personal", "Learning", "Shopping", "Other"].includes(cat);

        const card = document.createElement("div");
        card.className = "category-card";

        card.innerHTML = `
            <div class="category-card-top">
                <div>
                    <h4 class="category-card-title">${cat}</h4>
                    <span class="category-card-count">${completedCount} of ${catTasks.length} missions completed</span>
                </div>
                ${!isDefault ? `
                    <div class="category-actions">
                        <button class="btn-icon" style="width:30px; height:30px;" title="Rename Category" onclick="openRenameCategoryModal('${cat}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon" style="width:30px; height:30px; color:#f87171;" title="Delete Category" onclick="deleteCategory('${cat}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                ` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <button class="btn-secondary" style="flex:1; font-size: 0.8125rem;" onclick="viewCategoryTasks('${cat}')">
                    View Tasks
                </button>
                <button class="btn-primary" style="font-size: 0.8125rem; padding: 0.5rem 0.8rem;" onclick="openCreateTaskModal({ category: '${cat}' })">
                    + Add
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function viewCategoryTasks(cat) {
    state.activeCategory = cat;
    switchView("tasks");
}

function openCreateCategoryModal() {
    const modal = document.getElementById("category-modal");
    const nameInput = document.getElementById("modal-cat-name");
    const origInput = document.getElementById("modal-cat-original-name");
    const title = document.getElementById("category-modal-title");

    if (nameInput) nameInput.value = "";
    if (origInput) origInput.value = "";
    if (title) title.textContent = "New Category";
    if (modal) modal.classList.add("open");
}

function openRenameCategoryModal(oldName) {
    const modal = document.getElementById("category-modal");
    const nameInput = document.getElementById("modal-cat-name");
    const origInput = document.getElementById("modal-cat-original-name");
    const title = document.getElementById("category-modal-title");

    if (nameInput) nameInput.value = oldName;
    if (origInput) origInput.value = oldName;
    if (title) title.textContent = `Rename Category "${oldName}"`;
    if (modal) modal.classList.add("open");
}

function closeCategoryModal() {
    const modal = document.getElementById("category-modal");
    if (modal) modal.classList.remove("open");
}

function submitCategoryModal() {
    const nameInput = document.getElementById("modal-cat-name");
    const origInput = document.getElementById("modal-cat-original-name");
    const newName = (nameInput ? nameInput.value : "").trim();
    const origName = origInput ? origInput.value.trim() : "";

    if (!newName) {
        showToast("Category name cannot be empty", "error");
        return;
    }

    if (origName) {
        // Rename category
        const idx = state.customCategories.indexOf(origName);
        if (idx !== -1) {
            state.customCategories[idx] = newName;
            // Update tasks with that category
            state.todos.forEach(t => {
                if (t.category === origName) {
                    t.category = newName;
                    updateTodoStatus(t);
                }
            });
            saveUserPreferences();
            showToast(`Category renamed to "${newName}"`, "success");
        }
    } else {
        // New category
        if (state.customCategories.some(c => c.toLowerCase() === newName.toLowerCase())) {
            showToast("A category with this name already exists", "error");
            return;
        }
        state.customCategories.push(newName);
        saveUserPreferences();
        showToast(`Category "${newName}" created!`, "success");
    }

    closeCategoryModal();
    updateCategorySelectOptions();
    renderCategoriesView();
    renderCategoryPills();
}

function deleteCategory(catName) {
    showConfirmModal(`Delete category "${catName}"? Existing tasks will be safely reassigned to "Other".`, () => {
        state.customCategories = state.customCategories.filter(c => c !== catName);
        // Reassign existing tasks to Other
        state.todos.forEach(t => {
            if (t.category === catName) {
                t.category = "Other";
                updateTodoStatus(t);
            }
        });
        saveUserPreferences();
        updateCategorySelectOptions();
        renderCategoriesView();
        renderCategoryPills();
        showToast(`Category "${catName}" deleted and tasks preserved`, "info");
    });
}

function updateCategorySelectOptions() {
    const select = document.getElementById("modal-task-category");
    if (!select) return;

    select.innerHTML = "";
    state.customCategories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
}

// -------------------------------------------------------------
// Calendar View Renderer & Controls
// -------------------------------------------------------------
function renderCalendar() {
    const monthTitle = document.getElementById("cal-month-title");
    const grid = document.getElementById("calendar-days-grid");
    if (!monthTitle || !grid) return;

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    monthTitle.textContent = `${monthNames[state.calendarMonth]} ${state.calendarYear}`;
    grid.innerHTML = "";

    const firstDayIndex = new Date(state.calendarYear, state.calendarMonth, 1).getDay();
    const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
    const prevDaysInMonth = new Date(state.calendarYear, state.calendarMonth, 0).getDate();

    const todayStr = getTodayDateString();

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day-cell other-month";
        dayCell.innerHTML = `<span class="day-number">${prevDaysInMonth - i}</span>`;
        grid.appendChild(dayCell);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const monthPad = String(state.calendarMonth + 1).padStart(2, "0");
        const dayPad = String(day).padStart(2, "0");
        const dateKey = `${state.calendarYear}-${monthPad}-${dayPad}`;

        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day-cell";
        if (dateKey === todayStr) dayCell.classList.add("today");
        if (dateKey === state.selectedCalendarDate) dayCell.classList.add("selected");

        // Day tasks
        const dayTasks = state.todos.filter(t => t.dueDate === dateKey);

        let dotsHtml = "";
        dayTasks.slice(0, 4).forEach(t => {
            const pClass = t.completed ? "completed" : (t.priority || "Medium").toLowerCase();
            dotsHtml += `<div class="day-task-dot ${pClass}"></div>`;
        });
        if (dayTasks.length > 4) {
            dotsHtml += `<span style="font-size:0.6rem; color:var(--text-muted);">+${dayTasks.length - 4}</span>`;
        }

        dayCell.innerHTML = `
            <span class="day-number">${day}</span>
            <div class="day-task-indicators">${dotsHtml}</div>
        `;

        dayCell.onclick = () => selectCalendarDate(dateKey);
        grid.appendChild(dayCell);
    }

    renderSelectedDateTasks();
}

function selectCalendarDate(dateKey) {
    state.selectedCalendarDate = dateKey;
    renderCalendar();
}

function navigateCalendarMonth(step) {
    state.calendarMonth += step;
    if (state.calendarMonth > 11) {
        state.calendarMonth = 0;
        state.calendarYear++;
    } else if (state.calendarMonth < 0) {
        state.calendarMonth = 11;
        state.calendarYear--;
    }
    renderCalendar();
}

function resetCalendarToCurrentMonth() {
    const now = new Date();
    state.calendarMonth = now.getMonth();
    state.calendarYear = now.getFullYear();
    state.selectedCalendarDate = getTodayDateString();
    renderCalendar();
}

function renderSelectedDateTasks() {
    const list = document.getElementById("cal-selected-tasks-list");
    const title = document.getElementById("cal-selected-date-title");
    if (!list) return;

    if (title) {
        title.textContent = formatDateDisplay(state.selectedCalendarDate);
    }

    list.innerHTML = "";
    const tasks = state.todos.filter(t => t.dueDate === state.selectedCalendarDate);

    if (tasks.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding: 1.5rem;">
                <p style="color: var(--text-muted); font-size: 0.8125rem;">No tasks scheduled for this date.</p>
            </div>
        `;
    } else {
        tasks.forEach(t => list.appendChild(createTodoCard(t)));
    }
}

function openCreateTaskModalForSelectedDate() {
    openCreateTaskModal({ dueDate: state.selectedCalendarDate });
}

// -------------------------------------------------------------
// SIGNATURE FEATURE: Dynamic Time-Based & Task-Driven Achievement System
// -------------------------------------------------------------
const ACHIEVEMENT_VIDEO_MAP = {
    CHOPPALANGI: "assets/videos/Choppalangi.mp4",
    PARTIAL: "assets/videos/Romba Kastam bro.mp4",
    KOLA_MASS: "assets/videos/kola mass uh.mp4"
};

const ACHIEVEMENT_STORAGE_KEY = "taskverse_daily_achievement_playback";
const MAX_DAILY_VIDEO_STARTS = 2;

const achievementVideoManager = {
    isInitialized: false,
    lastAchievementState: null,
    isPlaying: false,
    currentVideoSrc: null,
    hasCountedCurrentPlayback: false,
    pendingPlayState: null,
    lastError: "None",
    listenersBound: false
};

function updateAchievementDebug() {
    const video = document.getElementById("achievement-video");
    const todayTasks = state.todos.filter(t => t.dueDate === getTodayDateString());
    const calc = getDailyAchievementCalculation(todayTasks);
    const record = getDailyPlaybackRecord();
    const values = {
        "achievement-debug-time": getAchievementCurrentTime().toLocaleString(),
        "achievement-debug-state": calc.stateKey,
        "achievement-debug-path": achievementVideoManager.currentVideoSrc || calc.videoSrc || "None",
        "achievement-debug-ready": video ? `${video.readyState} (${["HAVE_NOTHING", "HAVE_METADATA", "HAVE_CURRENT_DATA", "HAVE_FUTURE_DATA", "HAVE_ENOUGH_DATA"][video.readyState] || "unknown"})` : "No video element",
        "achievement-debug-playback": video ? (video.error ? "error" : video.paused ? "paused" : "playing") : "No video element",
        "achievement-debug-count": `${record.count} starts today`,
        "achievement-debug-error": achievementVideoManager.lastError
    };
    Object.entries(values).forEach(([id, value]) => {
        const node = document.getElementById(id);
        if (node) node.textContent = String(value);
    });
}

function bindAchievementVideoEvents(video) {
    if (achievementVideoManager.listenersBound) return;
    achievementVideoManager.listenersBound = true;
    console.info("[Achievement video] Video element created", video);
    ["loadedmetadata", "canplay", "play", "playing", "ended", "error"].forEach(eventName => {
        video.addEventListener(eventName, () => {
            console.info(`[Achievement video] ${eventName}`, {
                src: video.currentSrc || video.src,
                readyState: video.readyState,
                paused: video.paused,
                error: video.error ? `${video.error.code}: ${video.error.message || "media error"}` : null
            });
            if (eventName === "error") {
                const mediaError = video.error;
                achievementVideoManager.lastError = mediaError
                    ? `MediaError ${mediaError.code}: ${mediaError.message || "The browser could not decode or load this media."}`
                    : "Video resource error";
                achievementVideoManager.isPlaying = false;
                showQuoteCardWithPlayOption(achievementVideoManager.lastAchievementState, achievementVideoManager.currentVideoSrc);
            }
            if (eventName === "ended") {
                if (achievementVideoManager.isPlaying) {
                    console.warn("[Achievement video] Loop ended unexpectedly; restarting active video");
                    restartActiveAchievementVideo(video);
                } else {
                    achievementVideoManager.isPlaying = false;
                    showQuoteCard();
                }
            }
            if (eventName === "playing" && !achievementVideoManager.hasCountedCurrentPlayback) {
                achievementVideoManager.hasCountedCurrentPlayback = true;
                incrementDailyPlaybackCount();
            }
            if (eventName === "playing") {
                achievementVideoManager.isPlaying = true;
                const fallback = document.getElementById("video-autoplay-fallback");
                if (fallback) fallback.style.display = "none";
            }
            updateAchievementDebug();
        });
    });
    ["loadedmetadata", "canplay", "play", "playing", "ended", "error"].forEach(eventName => {
        video.addEventListener(eventName, () => {
            if (eventName === "ended" || eventName === "error") return;
            updateAchievementDebug();
        });
    });
}

function getAchievementCurrentTime() {
    if (typeof window !== "undefined" && window.__achievementTimeOverride instanceof Date) {
        return window.__achievementTimeOverride;
    }
    return new Date();
}

function isAtOrAfter4PM(date) {
    const d = date || getAchievementCurrentTime();
    return d.getHours() >= 16;
}

function getDailyAchievementCalculation(todayTasks) {
    const total = (todayTasks || []).length;
    const completed = (todayTasks || []).filter(t => Boolean(t.completed)).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    let stateKey = "EMPTY";
    if (total === 0) {
        stateKey = "EMPTY";
    } else if (completed === total) {
        stateKey = "KOLA_MASS";
    } else if (completed > 0) {
        stateKey = "PARTIAL";
    } else {
        stateKey = "CHOPPALANGI";
    }

    return {
        total,
        completed,
        pct,
        stateKey,
        videoSrc: ACHIEVEMENT_VIDEO_MAP[stateKey] || null
    };
}

function getDailyPlaybackRecord() {
    const todayStr = getTodayDateString();
    try {
        if (typeof localStorage !== "undefined") {
            const raw = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (data && data.date === todayStr && typeof data.count === "number") {
                    return data;
                }
            }
        }
    } catch (e) {
        console.warn("Error reading achievement playback limit:", e);
    }
    const fresh = { date: todayStr, count: 0 };
    saveDailyPlaybackRecord(fresh);
    return fresh;
}

function saveDailyPlaybackRecord(record) {
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(record));
        }
    } catch (e) {
        console.warn("Error saving achievement playback limit:", e);
    }
}

function incrementDailyPlaybackCount() {
    const record = getDailyPlaybackRecord();
    record.count += 1;
    saveDailyPlaybackRecord(record);
    updatePlaybackLimitUI();
    updateAchievementDebug();
}

function hasReachedDailyPlaybackLimit() {
    return false;
}

function updatePlaybackLimitUI() {
    const notice = document.getElementById("achievement-limit-notice");
    const playButton = document.getElementById("btn-achievement-play");
    if (notice) notice.style.display = "none";
    if (playButton) playButton.style.display = "none";
}

function showQuoteCard() {
    const videoWrap = document.getElementById("achievement-video-wrap");
    const quoteCard = document.getElementById("achievement-quote-card");
    const video = document.getElementById("achievement-video");
    const playBtn = document.getElementById("btn-achievement-play");
    const fallbackOverlay = document.getElementById("video-autoplay-fallback");

    if (video) {
        try {
            video.pause();
        } catch (e) { console.error("[Achievement video] pause failed", e); }
    }

    if (fallbackOverlay) fallbackOverlay.style.display = "none";
    if (videoWrap) videoWrap.style.display = "none";
    if (quoteCard) quoteCard.style.display = "flex";
    if (playBtn) playBtn.style.display = "none";

    achievementVideoManager.isPlaying = false;
    updatePlaybackLimitUI();
    updateAchievementDebug();
}

function showQuoteCardWithPlayOption(stateKey, videoSrc) {
    showQuoteCard();
}

function playAchievementVideo(stateKey, videoSrc) {
    if (!videoSrc) {
        showQuoteCard();
        return;
    }

    const videoWrap = document.getElementById("achievement-video-wrap");
    const quoteCard = document.getElementById("achievement-quote-card");
    const video = document.getElementById("achievement-video");
    const fallbackOverlay = document.getElementById("video-autoplay-fallback");

    if (!video || !videoWrap || !quoteCard) return;

    bindAchievementVideoEvents(video);

    achievementVideoManager.hasCountedCurrentPlayback = false;
    achievementVideoManager.currentVideoSrc = videoSrc;
    achievementVideoManager.lastAchievementState = stateKey;
    achievementVideoManager.pendingPlayState = { stateKey, videoSrc };
    achievementVideoManager.isPlaying = true;
    achievementVideoManager.lastError = "None";

    // Replace the quote card with the video wrap
    quoteCard.style.display = "none";
    videoWrap.style.display = "flex";
    if (fallbackOverlay) fallbackOverlay.style.display = "none";

    // Configure video element for GIF-like autoplay with continuous motion
    video.autoplay = true;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.controls = false;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("loop", "");
    video.setAttribute("autoplay", "");

    const encodedSrc = encodeURI(videoSrc);
    const currentSrcAttr = video.getAttribute("src") || "";
    if (currentSrcAttr !== encodedSrc && currentSrcAttr !== videoSrc) {
        video.src = encodedSrc;
        console.info("[Achievement video] Source assigned", video.src);
        video.load();
    }

    updateAchievementDebug();

    // Trigger video playback
    attemptAchievementPlayback(video, stateKey, videoSrc);
}

function attemptAchievementPlayback(video, stateKey, videoSrc) {
    achievementVideoManager.currentVideoSrc = videoSrc;
    achievementVideoManager.lastAchievementState = stateKey;
    achievementVideoManager.pendingPlayState = { stateKey, videoSrc };
    achievementVideoManager.isPlaying = true;
    const fallbackOverlay = document.getElementById("video-autoplay-fallback");

    const doPlay = () => {
        const promise = video.play();
        if (promise && typeof promise.then === "function") {
            promise.then(() => {
                achievementVideoManager.isPlaying = true;
                if (fallbackOverlay) fallbackOverlay.style.display = "none";
                updateAchievementDebug();
            }).catch(error => {
                console.warn("[Achievement video] video.play() note:", error.name, error.message);
                achievementVideoManager.lastError = (error.name || "Error") + ": " + (error.message || String(error));
                if (error.name === "AbortError") {
                    const onCanPlay = () => {
                        video.removeEventListener("canplay", onCanPlay);
                        if (achievementVideoManager.isPlaying) {
                            video.play().catch(e => console.warn("Retry play error:", e));
                        }
                    };
                    video.addEventListener("canplay", onCanPlay, { once: true });
                } else if (error.name === "NotAllowedError") {
                    if (fallbackOverlay) fallbackOverlay.style.display = "flex";
                } else {
                    showQuoteCardWithPlayOption(stateKey, videoSrc);
                }
                updateAchievementDebug();
            });
        }
    };

    if (video.readyState >= 2) {
        doPlay();
    } else {
        const onReady = () => {
            video.removeEventListener("canplay", onReady);
            video.removeEventListener("loadeddata", onReady);
            doPlay();
        };
        video.addEventListener("canplay", onReady, { once: true });
        video.addEventListener("loadeddata", onReady, { once: true });
        doPlay();
    }
}

function restartActiveAchievementVideo(video) {
    if (!achievementVideoManager.isPlaying) {
        showQuoteCard();
        return;
    }
    // A loop restart is part of the current start and does not consume another.
    video.currentTime = 0;
    const promise = video.play();
    if (promise && typeof promise.catch === "function") {
        promise.catch(error => {
            console.warn("[Achievement video] Loop restart note:", error);
        });
    }
}

function handleAchievementVideoSync(calc) {
    updatePlaybackLimitUI();
    achievementVideoManager.currentVideoSrc = calc.videoSrc;
    updateAchievementDebug();

    // Determine target video based on task completion and 4 PM rule:
    // 1. KOLA_MASS (100% completed): play kola mass uh.mp4
    // 2. PARTIAL (partially completed): play Romba Kastam bro.mp4
    // 3. CHOPPALANGI (0 tasks completed):
    //    - If by 4pm (at/after 4pm): Choppalangi video must play default
    //    - If before 4pm: show quote card
    // 4. EMPTY (0 tasks scheduled): show quote card

    let targetVideoSrc = null;
    let targetState = calc.stateKey;

    if (calc.stateKey === "KOLA_MASS") {
        targetVideoSrc = calc.videoSrc;
    } else if (calc.stateKey === "PARTIAL") {
        targetVideoSrc = calc.videoSrc;
    } else if (calc.stateKey === "CHOPPALANGI") {
        if (isAtOrAfter4PM()) {
            targetVideoSrc = calc.videoSrc;
        }
    }

    achievementVideoManager.isInitialized = true;
    achievementVideoManager.lastAchievementState = calc.stateKey;

    if (targetVideoSrc) {
        const video = document.getElementById("achievement-video");
        const encodedSrc = encodeURI(targetVideoSrc);
        const currentSrcAttr = video ? (video.getAttribute("src") || "") : "";
        const isSameVideo = (currentSrcAttr === encodedSrc || currentSrcAttr === targetVideoSrc);

        if (!achievementVideoManager.isPlaying || !isSameVideo) {
            playAchievementVideo(targetState, targetVideoSrc);
        }
    } else {
        showQuoteCard();
    }
}

function onTaskCheckboxUpdated(updatedTodo) {
    const todayStr = getTodayDateString();

    // Optimistically update in memory to recalculate immediately
    const idx = state.todos.findIndex(t => t.id === updatedTodo.id);
    if (idx !== -1) {
        state.todos[idx] = { ...state.todos[idx], completed: updatedTodo.completed };
    }

    // Update achievement display labels and meter, which triggers handleAchievementVideoSync
    renderMassMeterAndAchievements();
}

function setupAchievementEventListeners() {
    const playBtn = document.getElementById("btn-achievement-play");
    if (playBtn) {
        playBtn.addEventListener("click", function () {
            const todayStr = getTodayDateString();
            const todayTasks = state.todos.filter(t => t.dueDate === todayStr);
            const calc = getDailyAchievementCalculation(todayTasks);
            if (calc.videoSrc) {
                playAchievementVideo(calc.stateKey, calc.videoSrc);
            }
        });
    }

    const fallbackPlayBtn = document.getElementById("btn-video-fallback-play");
    if (fallbackPlayBtn) {
        fallbackPlayBtn.addEventListener("click", function () {
            const video = document.getElementById("achievement-video");
            const fallbackOverlay = document.getElementById("video-autoplay-fallback");
            if (fallbackOverlay) fallbackOverlay.style.display = "none";
            if (video) {
                const todayStr = getTodayDateString();
                const todayTasks = state.todos.filter(t => t.dueDate === todayStr);
                const calc = getDailyAchievementCalculation(todayTasks);
                if (calc.videoSrc) {
                    attemptAchievementPlayback(video, calc.stateKey, calc.videoSrc);
                }
            }
        });
    }
}

function renderMassMeterAndAchievements() {
    const todayStr = getTodayDateString();
    const todayTasks = state.todos.filter(t => t.dueDate === todayStr);

    const calc = getDailyAchievementCalculation(todayTasks);
    const { total, completed, pct, stateKey } = calc;

    const card = document.getElementById("achievement-card");
    const badge = document.getElementById("achievement-badge");
    const badgeText = document.getElementById("achievement-badge-text");
    const icon = document.getElementById("achievement-icon");
    const title = document.getElementById("achievement-title");
    const sub = document.getElementById("achievement-sub");
    const fill = document.getElementById("achievement-meter-fill");
    const ratio = document.getElementById("achievement-ratio");
    const dateElem = document.getElementById("achievement-date");

    if (!card || !title || !sub || !fill || !ratio) return;

    if (dateElem) {
        dateElem.textContent = formatDateDisplay(todayStr);
    }

    ratio.textContent = `${completed}/${total} Tasks (${pct}%)`;
    fill.style.width = `${pct}%`;

    // Reset styles
    card.classList.remove("status-kola-mass", "status-partial", "status-choppalangi", "status-empty");

    if (stateKey === "EMPTY") {
        // Empty State: Neutral, no tasks scheduled
        card.classList.add("status-empty");
        if (icon) icon.textContent = "😎";
        if (badgeText) badgeText.textContent = "Daily Mass Meter";
        title.textContent = "Innaiku plan pannala machi 😎";
        sub.textContent = "No tasks scheduled for today. Add a mission to start your daily mass!";
        fill.style.backgroundColor = "var(--text-muted)";
    } else if (stateKey === "KOLA_MASS") {
        // Condition A: 100% completed (SAAREY KOLA MASS UH 🔥)
        card.classList.add("status-kola-mass");
        if (icon) icon.textContent = "🔥";
        if (badgeText) badgeText.textContent = "HERO MASS LEVEL";
        title.textContent = "SAAREY KOLA MASS UH 🔥";
        sub.textContent = "Innaiku nee dhaan da hero!";
        fill.style.background = "linear-gradient(90deg, #ca8a04, #facc15)";

        // Celebratory confetti and audio (only triggered once per 100% completion state)
        if (!state.hasCelebratedKolaMassToday) {
            triggerConfetti();
            playAchievementChime();
            state.hasCelebratedKolaMassToday = true;
        }
    } else if (stateKey === "PARTIAL") {
        // Condition B: Partially completed (AH NEE THEDA MATTA ROMBA KASTAM 😂)
        card.classList.add("status-partial");
        if (icon) icon.textContent = "😂";
        if (badgeText) badgeText.textContent = "Progress In Action";
        title.textContent = "AH NEE THEDA MATTA ROMBA KASTAM 😂";
        sub.textContent = "Konjam balance irukku machi!";
        fill.style.background = "linear-gradient(90deg, #15803d, #22c55e)";
        state.hasCelebratedKolaMassToday = false;
    } else {
        // Condition C: Zero completed (CHOPPALANGI 🤡)
        card.classList.add("status-choppalangi");
        if (icon) icon.textContent = "🤡";
        if (badgeText) badgeText.textContent = "Work Pending";
        title.textContent = "CHOPPALANGI 🤡";
        sub.textContent = "Todo list ready… aana work mattum nadakkala!";
        fill.style.background = "linear-gradient(90deg, #7f1d1d, #A51C18)";
        state.hasCelebratedKolaMassToday = false;
    }

    // Synchronize achievement video & media section
    handleAchievementVideoSync(calc);
}

// -------------------------------------------------------------
// Streaks and Productivity History Engine
// -------------------------------------------------------------
function getStreakStorageKey() {
    return `taskverse_streak_${getLoggedInEmail()}`;
}

function loadStreakData() {
    try {
        const raw = localStorage.getItem(getStreakStorageKey());
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.warn("Failed to load streak data:", e);
    }
    return {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: null,
        history: {}
    };
}

function saveStreakData(streak) {
    try {
        localStorage.setItem(getStreakStorageKey(), JSON.stringify(streak));
    } catch (e) {
        console.warn("Failed to save streak data:", e);
    }
}

function updateStreaks() {
    const streakData = loadStreakData();
    const todayStr = getTodayDateString();

    const todayTasks = state.todos.filter(t => t.dueDate === todayStr);
    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.completed).length;
    const isToday100Pct = total > 0 && completed === total;

    // Record today's history
    if (total > 0) {
        streakData.history[todayStr] = {
            total,
            completed,
            pct: Math.round((completed / total) * 100)
        };
    }

    // Streak increment logic:
    // Only increment when today reaches 100% and it hasn't already been counted for today
    if (isToday100Pct) {
        if (streakData.lastCompletedDate !== todayStr) {
            // Check if last completed was yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

            if (streakData.lastCompletedDate === yesterdayStr) {
                streakData.currentStreak = (streakData.currentStreak || 0) + 1;
            } else {
                streakData.currentStreak = 1;
            }

            streakData.bestStreak = Math.max(streakData.bestStreak || 0, streakData.currentStreak);
            streakData.lastCompletedDate = todayStr;
            saveStreakData(streakData);
        }
    }

    // Weekly completion rate calculation
    const weeklyRate = calculateWeeklyRate(streakData);

    // Update DOM
    const currentElem = document.getElementById("streak-current");
    const bestElem = document.getElementById("streak-best");
    const weeklyElem = document.getElementById("streak-weekly-rate");

    if (currentElem) currentElem.textContent = streakData.currentStreak || 0;
    if (bestElem) bestElem.textContent = streakData.bestStreak || 0;
    if (weeklyElem) weeklyElem.textContent = `${weeklyRate}%`;

    // Milestones Update
    const m3 = document.getElementById("milestone-3-status");
    const m7 = document.getElementById("milestone-7-status");

    if (m3) {
        if ((streakData.bestStreak || 0) >= 3) {
            m3.textContent = "Unlocked 🏆";
            m3.className = "milestone-status unlocked";
        } else {
            m3.textContent = "3 Days Streak";
            m3.className = "milestone-status locked";
        }
    }

    if (m7) {
        if ((streakData.bestStreak || 0) >= 7) {
            m7.textContent = "Unlocked 🔥";
            m7.className = "milestone-status unlocked";
        } else {
            m7.textContent = "7 Days Streak";
            m7.className = "milestone-status locked";
        }
    }

    // Render 7-Day Mini Heatmap
    renderMiniHeatmap(streakData);
}

function calculateWeeklyRate(streakData) {
    let completedTotal = 0;
    let scheduledTotal = 0;

    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const record = streakData.history[dStr];
        if (record) {
            completedTotal += record.completed;
            scheduledTotal += record.total;
        }
    }

    if (scheduledTotal === 0) return 0;
    return Math.round((completedTotal / scheduledTotal) * 100);
}

function renderMiniHeatmap(streakData) {
    const row = document.getElementById("heatmap-row");
    if (!row) return;

    row.innerHTML = "";
    const daysShort = ["S", "M", "T", "W", "T", "F", "S"];

    // Render 7 days leading up to today
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const record = streakData.history[dStr];

        const dayCol = document.createElement("div");
        dayCol.className = "heatmap-day";

        const cell = document.createElement("div");
        cell.className = "heatmap-cell";

        if (record) {
            if (record.pct === 100) {
                cell.classList.add("completed-full");
                cell.title = `${dStr}: 100% Completed (${record.completed}/${record.total})`;
            } else if (record.pct > 0) {
                cell.classList.add("completed-partial");
                cell.title = `${dStr}: ${record.pct}% Completed (${record.completed}/${record.total})`;
            } else {
                cell.classList.add("completed-zero");
                cell.title = `${dStr}: 0% Completed`;
            }
        } else {
            cell.title = `${dStr}: No tasks`;
        }

        const lbl = document.createElement("span");
        lbl.className = "heatmap-label";
        lbl.textContent = daysShort[d.getDay()];

        dayCol.appendChild(cell);
        dayCol.appendChild(lbl);
        row.appendChild(dayCol);
    }
}

function confirmResetStreak() {
    showConfirmModal("Are you sure you want to reset your streak and achievement history?", () => {
        localStorage.removeItem(getStreakStorageKey());
        updateStreaks();
        showToast("Streak and history reset.", "info");
    });
}

// -------------------------------------------------------------
// Dashboard Analytics Cards
// -------------------------------------------------------------
function updateAnalytics() {
    const todayStr = getTodayDateString();

    const total = state.todos.length;
    const completed = state.todos.filter(t => t.completed).length;
    const pending = state.todos.filter(t => !t.completed).length;
    const overdue = state.todos.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;

    const overallPct = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Dom updates
    const elTotal = document.getElementById("stat-total-tasks");
    const elCompleted = document.getElementById("stat-completed-tasks");
    const elPending = document.getElementById("stat-pending-tasks");
    const elOverdue = document.getElementById("stat-overdue-tasks");
    const elPctBadge = document.getElementById("stat-completed-pct");

    const elBar = document.getElementById("overall-progress-bar");
    const elPctText = document.getElementById("overall-progress-pct");

    // Sidebar counts
    const navAll = document.getElementById("nav-count-all");
    const navToday = document.getElementById("nav-count-today");

    if (elTotal) elTotal.textContent = total;
    if (elCompleted) elCompleted.textContent = completed;
    if (elPending) elPending.textContent = pending;
    if (elOverdue) elOverdue.textContent = overdue;
    if (elPctBadge) elPctBadge.textContent = `${overallPct}%`;

    if (elBar) elBar.style.width = `${overallPct}%`;
    if (elPctText) elPctText.textContent = `${overallPct}% Completed (${completed}/${total})`;

    if (navAll) navAll.textContent = total;
    if (navToday) {
        const todayCount = state.todos.filter(t => t.dueDate === todayStr).length;
        navToday.textContent = todayCount;
    }
}

// -------------------------------------------------------------
// Notifications Popover & System
// -------------------------------------------------------------
function toggleNotificationPopover() {
    const popover = document.getElementById("notification-popover");
    if (popover) {
        popover.classList.toggle("open");
    }
}

function updateNotifications() {
    const todayStr = getTodayDateString();
    const overdueTasks = state.todos.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr);
    const todayTasks = state.todos.filter(t => !t.completed && t.dueDate === todayStr);

    const badge = document.getElementById("notif-badge");
    const label = document.getElementById("notif-count-label");
    const list = document.getElementById("notification-list");

    const criticalCount = overdueTasks.length;

    if (badge) {
        badge.style.display = criticalCount > 0 ? "block" : "none";
    }

    if (label) {
        label.textContent = `${criticalCount + todayTasks.length} Alerts`;
    }

    if (list) {
        list.innerHTML = "";
        if (criticalCount === 0 && todayTasks.length === 0) {
            list.innerHTML = `<p style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">No critical notifications. All clear!</p>`;
        } else {
            overdueTasks.forEach(t => {
                const item = document.createElement("div");
                item.className = "notification-item overdue";
                item.innerHTML = `
                    <div style="color: #f87171; font-weight: 700;">⚠️</div>
                    <div>
                        <div style="font-weight: 600; color: #fca5a5;">Overdue: ${t.title}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Was due on ${formatDateDisplay(t.dueDate)}</div>
                    </div>
                `;
                list.appendChild(item);
            });

            todayTasks.forEach(t => {
                const item = document.createElement("div");
                item.className = "notification-item";
                item.innerHTML = `
                    <div style="color: #f59e0b; font-weight: 700;">☀️</div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary);">${t.title}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Scheduled for today</div>
                    </div>
                `;
                list.appendChild(item);
            });
        }
    }
}

function requestBrowserNotifications() {
    if (!("Notification" in window)) {
        showToast("Browser notifications are not supported in this browser.", "info");
        return;
    }

    Notification.requestPermission().then(permission => {
        const btn = document.getElementById("btn-request-notifications");
        if (permission === "granted") {
            showToast("Notifications enabled!", "success");
            if (btn) btn.textContent = "Notifications Active ✓";
        } else {
            showToast("Notification permission was denied or dismissed.", "info");
            if (btn) btn.textContent = "Notifications Denied";
        }
    });
}

// -------------------------------------------------------------
// Create / Edit Task Modal Controls
// -------------------------------------------------------------
function openCreateTaskModal(defaults = {}) {
    state.isSubmittingTask = false;
    const modal = document.getElementById("task-modal");
    const title = document.getElementById("task-modal-title");
    const saveBtn = document.getElementById("modal-task-save-btn");

    if (title) title.textContent = "Create New Mission";
    if (saveBtn) {
        saveBtn.textContent = "Save Mission";
        saveBtn.disabled = false;
    }

    document.getElementById("modal-task-id").value = "";
    document.getElementById("modal-task-title").value = defaults.title || "";
    document.getElementById("modal-task-desc").value = defaults.description || "";
    document.getElementById("modal-task-due").value = defaults.dueDate || getTodayDateString();
    document.getElementById("modal-task-category").value = defaults.category || "Work";
    const goalInput = document.getElementById("modal-task-goal");
    if (goalInput) goalInput.value = defaults.goal !== undefined ? defaults.goal : 30;

    selectModalPriority(defaults.priority || "Medium");

    // Recurrence defaults
    const repeatVal = defaults.repeat || "none";
    const repeatSelect = document.getElementById("modal-task-repeat");
    if (repeatSelect) repeatSelect.value = repeatVal;
    handleRecurrenceChange(repeatVal);

    setSelectedCustomDays(defaults.customDays || [1, 2, 3, 4, 5]);

    const radioNever = document.querySelector('input[name="modal-repeat-end"][value="never"]');
    if (radioNever) radioNever.checked = true;
    handleEndConditionChange("never");

    const editOptions = document.getElementById("modal-recurring-edit-options");
    if (editOptions) editOptions.style.display = "none";

    const err = document.getElementById("modal-title-error");
    if (err) err.style.display = "none";

    if (modal) {
        modal.classList.add("open");
        const modalBody = modal.querySelector(".modal-body");
        if (modalBody) modalBody.scrollTop = 0;
    }
}

function openEditTaskModal(todo) {
    const modal = document.getElementById("task-modal");
    const title = document.getElementById("task-modal-title");
    const saveBtn = document.getElementById("modal-task-save-btn");

    if (title) title.textContent = "Edit Mission";
    if (saveBtn) saveBtn.textContent = "Update Mission";

    document.getElementById("modal-task-id").value = todo.id;
    document.getElementById("modal-task-title").value = todo.title;
    document.getElementById("modal-task-desc").value = todo.cleanDescription || "";
    document.getElementById("modal-task-due").value = todo.dueDate || getTodayDateString();
    document.getElementById("modal-task-category").value = todo.category || "Work";
    const editGoalInput = document.getElementById("modal-task-goal");
    if (editGoalInput) editGoalInput.value = todo.goal !== undefined ? todo.goal : 30;

    selectModalPriority(todo.priority || "Medium");

    // Recurrence pre-fill
    const freq = todo.recurrence?.frequency || "none";
    const repeatSelect = document.getElementById("modal-task-repeat");
    if (repeatSelect) repeatSelect.value = freq;
    handleRecurrenceChange(freq);

    setSelectedCustomDays(todo.recurrence?.customDays || [1, 2, 3, 4, 5]);

    const endType = todo.recurrence?.endType || "never";
    const radioEnd = document.querySelector(`input[name="modal-repeat-end"][value="${endType}"]`);
    if (radioEnd) radioEnd.checked = true;
    handleEndConditionChange(endType);

    const endDateInput = document.getElementById("modal-repeat-end-date");
    const endCountInput = document.getElementById("modal-repeat-end-count");
    if (endDateInput && todo.recurrence?.endDate) endDateInput.value = todo.recurrence.endDate;
    if (endCountInput && todo.recurrence?.endCount) endCountInput.value = todo.recurrence.endCount;

    // Recurring Edit Scope (single occurrence vs entire series)
    const editOptions = document.getElementById("modal-recurring-edit-options");
    if (editOptions) {
        if (todo.recurrence && todo.recurrence.seriesId) {
            editOptions.style.display = "block";
            const radioSingle = document.querySelector('input[name="modal-recurring-scope"][value="single"]');
            if (radioSingle) radioSingle.checked = true;
        } else {
            editOptions.style.display = "none";
        }
    }

    const err = document.getElementById("modal-title-error");
    if (err) err.style.display = "none";

    if (modal) {
        modal.classList.add("open");
        const modalBody = modal.querySelector(".modal-body");
        if (modalBody) modalBody.scrollTop = 0;
    }
}

function closeTaskModal() {
    if (state.activeTaskAbortController) {
        try {
            state.activeTaskAbortController.abort();
        } catch (e) {}
        state.activeTaskAbortController = null;
    }
    state.isSubmittingTask = false;
    const saveBtn = document.getElementById("modal-task-save-btn");
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Mission";
    }
    const modal = document.getElementById("task-modal");
    if (modal) modal.classList.remove("open");
}

function selectModalPriority(priority) {
    document.getElementById("modal-task-priority").value = priority;
    document.querySelectorAll(".priority-toggle-btn").forEach(btn => {
        btn.classList.toggle("selected", btn.getAttribute("data-priority") === priority);
    });
}

function submitTaskModal() {
    // Prevent duplicate submissions and concurrent clicks
    if (state.isSubmittingTask) return;

    const id = document.getElementById("modal-task-id").value;
    const title = document.getElementById("modal-task-title").value.trim();
    const desc = document.getElementById("modal-task-desc").value.trim();
    const dueDate = document.getElementById("modal-task-due").value;
    const category = document.getElementById("modal-task-category").value;
    const priority = document.getElementById("modal-task-priority").value;
    const goal = Number(document.getElementById("modal-task-goal")?.value) || 30;

    const repeatFreq = document.getElementById("modal-task-repeat")?.value || "none";
    const customDays = getSelectedCustomDays();
    const endType = document.querySelector('input[name="modal-repeat-end"]:checked')?.value || "never";
    const endDate = document.getElementById("modal-repeat-end-date")?.value || null;
    const endCount = Number(document.getElementById("modal-repeat-end-count")?.value) || 10;

    const recurrence = {
        frequency: repeatFreq,
        customDays,
        endType,
        endDate,
        endCount,
        seriesId: null,
        isPaused: false
    };

    const err = document.getElementById("modal-title-error");
    if (!title) {
        if (err) {
            err.textContent = "Mission title is required.";
            err.style.display = "block";
        }
        return;
    }

    state.isSubmittingTask = true;
    const saveBtn = document.getElementById("modal-task-save-btn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = id ? "Updating..." : (repeatFreq !== "none" ? "Scheduling..." : "Saving...");
    }

    if (id) {
        // Edit
        const existing = state.todos.find(t => t.id == id);
        const editScope = document.querySelector('input[name="modal-recurring-scope"]:checked')?.value || "single";

        if (editScope === "series" && existing && existing.recurrence && existing.recurrence.seriesId) {
            updateRecurringSeries(existing.recurrence.seriesId, {
                title,
                cleanDescription: desc,
                priority,
                category,
                recurrence: {
                    ...existing.recurrence,
                    frequency: repeatFreq,
                    customDays,
                    endType,
                    endDate,
                    endCount
                }
            });
        } else {
            updateTodoDetails({
                id: Number(id),
                title,
                description: desc,
                dueDate,
                category,
                priority,
                goal,
                completed: existing ? existing.completed : false,
                completedDates: existing ? (existing.completedDates || []) : [],
                recurrence: existing && existing.recurrence ? existing.recurrence : recurrence
            });
        }
    } else {
        // Create
        addTodo({
            title,
            description: desc,
            dueDate,
            category,
            priority,
            goal,
            completed: false,
            recurrence
        });
    }
}

// -------------------------------------------------------------
// Confirmation Dialog
// -------------------------------------------------------------
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById("confirm-modal");
    const msgElem = document.getElementById("confirm-modal-message");

    if (msgElem) msgElem.textContent = message;
    state.confirmActionCallback = onConfirm;

    if (modal) modal.classList.add("open");
}

function closeConfirmModal(confirmed) {
    const modal = document.getElementById("confirm-modal");
    if (modal) modal.classList.remove("open");

    if (confirmed && typeof state.confirmActionCallback === "function") {
        state.confirmActionCallback();
    }
    state.confirmActionCallback = null;
}

// -------------------------------------------------------------
// Toast Notification Stack
// -------------------------------------------------------------
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) {
        alert(message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast-item ${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "✓";
    if (type === "error") icon = "✕";

    toast.innerHTML = `
        <span style="font-weight: 700;">${icon}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// -------------------------------------------------------------
// Audio & Confetti Celebrations
// -------------------------------------------------------------
function toggleSoundSetting(enabled) {
    state.soundEnabled = enabled;
    saveUserPreferences();
    showToast(`Achievement sound ${enabled ? "enabled" : "disabled"}`, "info");
}

function playAchievementChime() {
    if (!state.soundEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 triumphant chord
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

            gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + idx * 0.1);
            osc.stop(ctx.currentTime + idx * 0.1 + 0.6);
        });
    } catch (e) {
        console.warn("Audio playback error:", e);
    }
}

function triggerConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ["#facc15", "#eab308", "#22c55e", "#A51C18", "#ffffff", "#4ade80"];

    for (let i = 0; i < 90; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            r: Math.random() * 6 + 4,
            d: Math.random() * 40,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.floor(Math.random() * 10) - 10,
            tiltAngleIncremental: Math.random() * 0.07 + 0.05,
            tiltAngle: 0,
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.5) * 14 - 3,
            alpha: 1
        });
    }

    let animationFrame;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = 0;

        particles.forEach(p => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2 + p.vy;
            p.x += Math.sin(p.d) + p.vx;
            p.vy += 0.15; // Gravity
            p.alpha -= 0.008;

            if (p.alpha > 0) {
                active++;
                ctx.beginPath();
                ctx.lineWidth = p.r;
                ctx.strokeStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
                ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
                ctx.stroke();
            }
        });

        if (active > 0) {
            animationFrame = requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            cancelAnimationFrame(animationFrame);
        }
    }
    render();
}

// -------------------------------------------------------------
// Theme Management (Light Mode Default, Instant Switching, Persistence)
// -------------------------------------------------------------
function getActiveTheme() {
    const userEmail = getLoggedInEmail();
    if (userEmail) {
        try {
            const raw = localStorage.getItem(`taskverse_prefs_${userEmail}`);
            if (raw) {
                const prefs = JSON.parse(raw);
                if (prefs && prefs.theme) return prefs.theme;
            }
        } catch (e) {}
    }
    const globalTheme = localStorage.getItem("taskverse_theme");
    if (globalTheme) return globalTheme;
    // Light Mode is the default for new and unconfigured accounts
    return "light";
}

function applyTheme(theme) {
    const targetTheme = (theme === "dark") ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", targetTheme);

    const lightBtn = document.getElementById("theme-btn-light");
    const darkBtn = document.getElementById("theme-btn-dark");
    if (lightBtn && darkBtn) {
        if (targetTheme === "light") {
            lightBtn.classList.add("active");
            lightBtn.setAttribute("aria-pressed", "true");
            darkBtn.classList.remove("active");
            darkBtn.setAttribute("aria-pressed", "false");
        } else {
            darkBtn.classList.add("active");
            darkBtn.setAttribute("aria-pressed", "true");
            lightBtn.classList.remove("active");
            lightBtn.setAttribute("aria-pressed", "false");
        }
    }
}

function setUserTheme(theme) {
    const targetTheme = (theme === "dark") ? "dark" : "light";
    localStorage.setItem("taskverse_theme", targetTheme);

    const userEmail = getLoggedInEmail();
    if (userEmail) {
        const key = `taskverse_prefs_${userEmail}`;
        try {
            const raw = localStorage.getItem(key);
            const prefs = raw ? JSON.parse(raw) : {};
            prefs.theme = targetTheme;
            localStorage.setItem(key, JSON.stringify(prefs));
        } catch (e) {
            console.warn("Failed saving theme in user prefs:", e);
        }
    }
    applyTheme(targetTheme);
    showToast(`Appearance updated to ${targetTheme === "light" ? "Light" : "Dark"} Mode`, "info");
}

// -------------------------------------------------------------
// Account Management: Permanent Deletion Flow
// -------------------------------------------------------------
function openDeleteAccountModal() {
    const modal = document.getElementById("delete-account-modal");
    const passwordInput = document.getElementById("delete-account-password");
    const errorMsg = document.getElementById("delete-account-error");
    if (passwordInput) passwordInput.value = "";
    if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.textContent = "";
    }
    if (modal) {
        modal.classList.add("active");
        if (passwordInput) setTimeout(() => passwordInput.focus(), 80);
    }
}

function closeDeleteAccountModal() {
    const modal = document.getElementById("delete-account-modal");
    if (modal) modal.classList.remove("active");
}

async function submitDeleteAccount() {
    const passwordInput = document.getElementById("delete-account-password");
    const errorMsg = document.getElementById("delete-account-error");
    const btn = document.getElementById("btn-confirm-delete-account");
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!password) {
        if (errorMsg) {
            errorMsg.textContent = "Please enter your password to confirm deletion.";
            errorMsg.style.display = "block";
        }
        return;
    }

    const token = getToken();
    if (!token) {
        showToast("Session expired. Please sign in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 800);
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Permanently Deleting...";
    }
    if (errorMsg) errorMsg.style.display = "none";

    try {
        const serverUrl = getServerUrl();
        const response = await fetch(`${serverUrl}/auth/delete-account`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });

        if (response.ok) {
            closeDeleteAccountModal();
            const email = getLoggedInEmail();
            localStorage.removeItem("token");
            localStorage.removeItem("userEmail");
            if (email) {
                localStorage.removeItem(`taskverse_prefs_${email}`);
            }
            showToast("Account deleted successfully.", "success");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1000);
        } else {
            let errorText = "Failed to delete account.";
            try {
                const resJson = await response.json();
                if (resJson && resJson.message) errorText = resJson.message;
            } catch (e) {
                const rawText = await response.text();
                if (rawText) errorText = rawText;
            }
            if (errorMsg) {
                errorMsg.textContent = errorText;
                errorMsg.style.display = "block";
            }
            showToast(errorText, "error");
        }
    } catch (err) {
        console.error("Delete account network error:", err);
        if (errorMsg) {
            errorMsg.textContent = "Network error. Please verify backend connection.";
            errorMsg.style.display = "block";
        }
        showToast("Network error during account deletion.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Permanently Delete";
        }
    }
}

// -------------------------------------------------------------
// Preferences Local Storage Cache
// -------------------------------------------------------------
function loadUserPreferences() {
    const email = getLoggedInEmail();
    const key = `taskverse_prefs_${email}`;
    let loadedTheme = null;
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const prefs = JSON.parse(raw);
            if (prefs.customCategories) state.customCategories = prefs.customCategories;
            if (prefs.soundEnabled !== undefined) {
                state.soundEnabled = prefs.soundEnabled;
                const toggle = document.getElementById("settings-sound-toggle");
                if (toggle) toggle.checked = state.soundEnabled;
            }
            if (prefs.theme) {
                loadedTheme = prefs.theme;
            }
        }
    } catch (e) {
        console.warn("Failed to load user preferences:", e);
    }
    applyTheme(loadedTheme || getActiveTheme());
    updateCategorySelectOptions();
}

function saveUserPreferences() {
    const key = `taskverse_prefs_${getLoggedInEmail()}`;
    try {
        const raw = localStorage.getItem(key);
        const existing = raw ? JSON.parse(raw) : {};
        localStorage.setItem(key, JSON.stringify({
            ...existing,
            customCategories: state.customCategories,
            soundEnabled: state.soundEnabled,
            theme: getActiveTheme()
        }));
    } catch (e) {
        console.warn("Failed to save user preferences:", e);
    }
}

// -------------------------------------------------------------
// Router Synchronization (Direct URL, Refresh, Browser Back/Forward)
// -------------------------------------------------------------
function syncRouteFromLocation() {
    if (typeof window === "undefined" || !window.location) return;
    const hash = (window.location.hash || "").replace(/^#\/?/, "").toLowerCase().trim();
    if (!hash || hash === "dashboard") {
        switchView("dashboard", null, false);
    } else if (hash === "today") {
        switchView("today", null, false);
    } else if (hash === "completed") {
        switchView("completed", null, false);
    } else if (hash === "categories") {
        switchView("categories", null, false);
    } else if (hash === "settings") {
        switchView("settings", null, false);
    } else if (hash === "habits" || hash === "tasks") {
        switchView("tasks", "all", false);
    } else {
        switchView("dashboard", null, false);
    }
}

if (typeof window !== "undefined") {
    window.addEventListener("popstate", syncRouteFromLocation);
    window.addEventListener("hashchange", syncRouteFromLocation);
}

// -------------------------------------------------------------
// Global Event Listeners & Initialization
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
    // Synchronize current theme on load
    applyTheme(getActiveTheme());

    // Check if on login or register page while already authenticated
    const onAuthPage = document.getElementById("login-form") || document.getElementById("register-form");
    if (onAuthPage) {
        const token = getToken();
        if (token && !isTokenExpired(token)) {
            window.location.href = "todos.html";
            return;
        }
    }

    // Pre-warm backend (helps wake up free-tier cold instances early)
    try {
        fetch(`${getServerUrl()}/auth/ping`, { method: "GET", mode: "cors", cache: "no-store" }).catch(() => {});
    } catch (e) {}

    // Initialize server selector UI
    updateServerSelectorUI();

    // Initialize achievement event listeners (Play video, close video)
    setupAchievementEventListeners();

    // Check if on dashboard / todos page
    if (document.getElementById("todo-list") || document.getElementById("view-dashboard")) {
        loadTodos();
        syncRouteFromLocation();
    }

    // Keyboard Shortcuts
    document.addEventListener("keydown", function (e) {
        // Press "/" to focus search
        if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
            e.preventDefault();
            const search = document.getElementById("global-search");
            if (search) search.focus();
        }
        // Press "Escape" to close modals
        if (e.key === "Escape") {
            closeTaskModal();
            closeCategoryModal();
            closeConfirmModal(false);
            closeSeriesModal();
            closeDeleteAccountModal();
            const popover = document.getElementById("notification-popover");
            if (popover) popover.classList.remove("open");
        }
    });

    // Close notifications popover on outside click
    document.addEventListener("click", function (e) {
        const popover = document.getElementById("notification-popover");
        const btn = document.getElementById("notification-btn");
        if (popover && popover.classList.contains("open")) {
            if (!popover.contains(e.target) && !btn.contains(e.target)) {
                popover.classList.remove("open");
            }
        }
    });
});
