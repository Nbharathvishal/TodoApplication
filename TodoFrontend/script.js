// TaskVerse — Modern Productivity Dashboard & Command Engine
// Preserves and extends all existing authentication & CRUD operations.

const CLOUD_SERVER_URL = "https://todo-backend-zyqf.onrender.com";
const LOCAL_SERVER_URL = "http://localhost:8080";

function getServerUrl() {
    const saved = localStorage.getItem("taskverse_server_url");
    if (saved) return saved;
    // Default to the live Cloud Render server so that opening files locally via Live Server / file:
    // works immediately without needing local PostgreSQL/Spring Boot running.
    // Users can toggle to Local (Port 8080) at any time.
    return CLOUD_SERVER_URL;
}

let SERVER_URL = getServerUrl();

function switchBackend(target) {
    if (target === "local") {
        SERVER_URL = LOCAL_SERVER_URL;
        localStorage.setItem("taskverse_server_url", LOCAL_SERVER_URL);
        showToast("Switched to Local Backend (http://localhost:8080)", "info");
    } else {
        SERVER_URL = CLOUD_SERVER_URL;
        localStorage.setItem("taskverse_server_url", CLOUD_SERVER_URL);
        showToast("Switched to Cloud Backend (Render)", "success");
    }
    updateServerSelectorUI();
}

function updateServerSelectorUI() {
    SERVER_URL = getServerUrl();
    const isCloud = SERVER_URL.includes("onrender.com");

    const btnCloud = document.getElementById("btn-server-cloud");
    const btnLocal = document.getElementById("btn-server-local");
    const display = document.getElementById("server-url-display");
    const settingsDisplay = document.getElementById("settings-server-url");

    if (btnCloud) btnCloud.classList.toggle("active", isCloud);
    if (btnLocal) btnLocal.classList.toggle("active", !isCloud);
    if (display) display.textContent = `Target API: ${SERVER_URL}`;
    if (settingsDisplay) settingsDisplay.textContent = SERVER_URL;
}

function handleFetchError(error, contextMsg = "Request failed") {
    console.error("API Fetch Error:", error);
    const current = getServerUrl();
    const isLocalTarget = current.includes("localhost") || current.includes("127.0.0.1");

    if (error.message === "Failed to fetch" || error.name === "TypeError") {
        if (isLocalTarget) {
            showToast(
                `Local backend connection refused at ${current}. Ensure your Spring Boot service is running on port 8080, or switch to Cloud (Render).`,
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
    selectedCalendarDate: getTodayDateString(),
    customCategories: ["Work", "Personal", "Learning", "Shopping", "Other"],
    soundEnabled: false,
    hasCelebratedKolaMassToday: false,
    confirmActionCallback: null
};

// -------------------------------------------------------------
// Authentication Utilities (Preserved)
// -------------------------------------------------------------
function getToken() {
    return localStorage.getItem("token");
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

    const email = emailElem.value.trim();
    const password = passwordElem.value;

    if (!email || !password) {
        showToast("Please enter both email and password", "error");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Authenticating...";
    }

    fetch(`${getServerUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => { throw new Error(text || "Login Failed"); });
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

    const email = emailElem.value.trim();
    const password = passwordElem.value;

    if (!email || !password) {
        showToast("Please enter both email and password", "error");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Creating Account...";
    }

    fetch(`${getServerUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (response.ok) {
            showToast("Registration successful! Please login.", "success");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 600);
        } else {
            return response.text().then(text => { throw new Error(text || "Registration Failed"); });
        }
    })
    .catch(error => {
        handleFetchError(error, "Registration Failed");
    })
    .finally(() => {
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
// Format: userDescription\n<!--taskverse:{"priority":"High","dueDate":"2026-10-28","category":"Work","recurrence":{...}}-->
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
            cleanDescription = desc.replace(metaRegex, "").trim();
        } catch (e) {
            console.warn("Failed to parse taskverse metadata:", e);
        }
    }

    // If cleanDescription was automatically defaulted to title, treat it as empty for UI
    if (cleanDescription === todo.title) {
        cleanDescription = "";
    }

    return {
        ...todo,
        cleanDescription,
        priority,
        dueDate,
        category,
        recurrence
    };
}

function serializeTodoForBackend(todoInput) {
    const meta = {
        priority: todoInput.priority || "Medium",
        dueDate: todoInput.dueDate || getTodayDateString(),
        category: todoInput.category || "Work",
        recurrence: todoInput.recurrence || { frequency: "none" }
    };

    const metaTag = `<!--taskverse:${JSON.stringify(meta)}-->`;
    let finalDescription = (todoInput.description || "").trim();

    if (!finalDescription) {
        finalDescription = `${todoInput.title}\n${metaTag}`;
    } else {
        finalDescription = `${finalDescription}\n${metaTag}`;
    }

    return {
        id: todoInput.id,
        title: todoInput.title,
        description: finalDescription,
        completed: Boolean(todoInput.completed)
    };
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
    if (!currentToken) return;

    fetch(`${getServerUrl()}/api/todo/${id}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${currentToken}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error("Failed to delete occurrence");
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
    if (!currentToken) {
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

async function addTodo(taskData) {
    const currentToken = getToken();
    if (!currentToken) {
        window.location.href = "login.html";
        return;
    }

    const title = taskData.title || document.getElementById("modal-task-title")?.value.trim();
    if (!title) {
        showToast("Task title is required", "error");
        return;
    }

    const desc = taskData.description !== undefined ? taskData.description : (document.getElementById("modal-task-desc")?.value.trim() || "");
    const dueDate = taskData.dueDate || document.getElementById("modal-task-due")?.value || getTodayDateString();
    const priority = taskData.priority || document.getElementById("modal-task-priority")?.value || "Medium";
    const category = taskData.category || document.getElementById("modal-task-category")?.value || "Work";

    const recurrence = taskData.recurrence || {
        frequency: document.getElementById("modal-task-repeat")?.value || "none",
        customDays: getSelectedCustomDays(),
        endType: document.querySelector('input[name="modal-repeat-end"]:checked')?.value || "never",
        endDate: document.getElementById("modal-repeat-end-date")?.value || null,
        endCount: Number(document.getElementById("modal-repeat-end-count")?.value) || 10
    };

    const saveBtn = document.getElementById("modal-task-save-btn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Scheduling...";
    }

    try {
        if (recurrence.frequency !== "none") {
            const seriesId = recurrence.seriesId || ("series_" + Date.now() + "_" + Math.floor(Math.random() * 1000));
            const seriesRecurrence = {
                ...recurrence,
                seriesId,
                isPaused: false
            };

            const dates = calculateSeriesDates(dueDate, seriesRecurrence);

            // Duplicate prevention: filter out dates that already exist in state.todos for this seriesId
            const existingDates = new Set(
                state.todos
                    .filter(t => t.recurrence && t.recurrence.seriesId === seriesId)
                    .map(t => t.dueDate)
            );

            const uniqueDates = [];
            dates.forEach(d => {
                if (!existingDates.has(d) && !uniqueDates.includes(d)) {
                    uniqueDates.push(d);
                }
            });

            if (uniqueDates.length === 0) {
                showToast("All occurrences in this series are already scheduled.", "info");
                closeTaskModal();
                return;
            }

            for (let i = 0; i < uniqueDates.length; i++) {
                const dateStr = uniqueDates[i];
                const occPayload = serializeTodoForBackend({
                    title,
                    description: desc,
                    dueDate: dateStr,
                    priority,
                    category,
                    completed: false,
                    recurrence: {
                        ...seriesRecurrence,
                        isOccurrence: i > 0
                    }
                });

                await fetch(`${getServerUrl()}/api/todo/create`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${currentToken}`
                    },
                    body: JSON.stringify(occPayload)
                });
            }

            closeTaskModal();
            showToast(`Recurring mission created with ${uniqueDates.length} occurrences! 🔁`, "success");
            loadTodos();
        } else {
            // One-time task
            const payload = serializeTodoForBackend({
                title,
                description: desc,
                dueDate,
                priority,
                category,
                completed: false,
                recurrence: { frequency: "none" }
            });

            const res = await fetch(`${getServerUrl()}/api/todo/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to create task");
            closeTaskModal();
            showToast("Mission created successfully!", "success");
            loadTodos();
        }
    } catch (error) {
        handleFetchError(error, "Failed to create mission");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Mission";
        }
    }
}

function updateTodoStatus(todo) {
    const currentToken = getToken();
    if (!currentToken) {
        window.location.href = "login.html";
        return;
    }

    const payload = serializeTodoForBackend({
        id: todo.id,
        title: todo.title,
        description: todo.cleanDescription || todo.description,
        dueDate: todo.dueDate,
        priority: todo.priority,
        category: todo.category,
        completed: todo.completed
    });

    fetch(`${getServerUrl()}/api/todo`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) throw new Error("Failed to update task");
        return response.json();
    })
    .then(updated => {
        const msg = todo.completed ? "Mission completed! 🔥" : "Mission reopened";
        showToast(msg, "info");
        loadTodos();
    })
    .catch(error => {
        handleFetchError(error, "Failed to update task status");
    });
}

function updateTodoDetails(taskData) {
    const currentToken = getToken();
    if (!currentToken) {
        window.location.href = "login.html";
        return;
    }

    const payload = serializeTodoForBackend(taskData);

    const saveBtn = document.getElementById("modal-task-save-btn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Updating...";
    }

    fetch(`${getServerUrl()}/api/todo`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) throw new Error("Failed to update task");
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
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Mission";
        }
    });
}

function deleteTodo(id) {
    showConfirmModal("Are you sure you want to delete this mission? This cannot be undone.", () => {
        const currentToken = getToken();
        if (!currentToken) {
            window.location.href = "login.html";
            return;
        }

        fetch(`${getServerUrl()}/api/todo/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${currentToken}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error("Failed to delete mission");
            showToast("Mission deleted.", "info");
            loadTodos();
        })
        .catch(error => {
            handleFetchError(error, "Failed to delete task");
        });
    });
}

// -------------------------------------------------------------
// UI Navigation & View Switcher
// -------------------------------------------------------------
function switchView(viewName, filterParam) {
    state.currentView = viewName;

    // Toggle active section
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    const activeSec = document.getElementById(`view-${viewName}`);
    if (activeSec) activeSec.classList.add("active");

    // Toggle active nav button
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.querySelector(`.sidebar-nav .nav-item[data-view="${viewName}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    // Contextual Titles
    const titleElem = document.getElementById("page-title");
    const subElem = document.getElementById("page-subtitle");

    switch (viewName) {
        case "dashboard":
            if (titleElem) titleElem.textContent = "Dashboard";
            if (subElem) subElem.textContent = "Command Center & Analytics";
            break;
        case "tasks":
            if (titleElem) titleElem.textContent = "My Tasks";
            if (subElem) subElem.textContent = "Organize, filter, and execute missions";
            if (filterParam) applyTaskFilter(filterParam);
            break;
        case "calendar":
            if (titleElem) titleElem.textContent = "Mission Calendar";
            if (subElem) subElem.textContent = "Timeline & Deadlines Schedule";
            renderCalendar();
            break;
        case "categories":
            if (titleElem) titleElem.textContent = "Task Categories";
            if (subElem) subElem.textContent = "Domains and tags configuration";
            renderCategoriesView();
            break;
        case "settings":
            if (titleElem) titleElem.textContent = "Settings";
            if (subElem) subElem.textContent = "Preferences & System Configuration";
            break;
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
        const updatedTodo = {
            ...todo,
            completed: nativeCheckbox.checked
        };
        updateTodoStatus(updatedTodo);
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
    } else if (state.currentView === "calendar") {
        renderCalendar();
    } else if (state.currentView === "categories") {
        renderCategoriesView();
    }
}

function renderDashboardView() {
    // Render Today's Focus Missions
    const todayStr = getTodayDateString();
    const todayTasks = state.todos.filter(t => t.dueDate === todayStr);
    const container = document.getElementById("today-focus-list");

    if (container) {
        container.innerHTML = "";
        if (todayTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 1.5rem;">
                    <p style="color: var(--text-muted); font-size: 0.875rem;">No tasks specifically scheduled for today.</p>
                </div>
            `;
        } else {
            todayTasks.forEach(task => {
                container.appendChild(createTodoCard(task));
            });
        }
    }
}

function renderTasksView() {
    const list = document.getElementById("todo-list");
    const emptyState = document.getElementById("empty-message");
    if (!list) return;

    list.innerHTML = "";

    // Render Category Pills in task view
    renderCategoryPills();

    // Filter tasks
    let filtered = filterTasks(state.todos, state.activeFilter, state.activeCategory, state.searchQuery);

    // Sort tasks
    filtered = sortTasks(filtered, state.sortBy);

    if (filtered.length === 0) {
        if (emptyState) {
            emptyState.style.display = "flex";
            const emptyTitle = document.getElementById("empty-state-title");
            const emptyDesc = document.getElementById("empty-state-desc");
            if (emptyTitle && emptyDesc) {
                if (state.searchQuery) {
                    emptyTitle.textContent = "No Missions Found";
                    emptyDesc.textContent = `No tasks matched your query "${state.searchQuery}".`;
                } else if (state.activeFilter === "overdue") {
                    emptyTitle.textContent = "No Overdue Missions! 🎉";
                    emptyDesc.textContent = "All your scheduled missions are up to date or completed.";
                } else {
                    emptyTitle.textContent = "No Tasks in this Filter";
                    emptyDesc.textContent = "Create a new mission or change your filter selection.";
                }
            }
        }
    } else {
        if (emptyState) emptyState.style.display = "none";
        filtered.forEach(todo => {
            list.appendChild(createTodoCard(todo));
        });
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

function applyTaskFilter(filterName) {
    state.activeFilter = filterName;
    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.classList.toggle("active", pill.getAttribute("data-filter") === filterName);
    });
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
// SIGNATURE FEATURE: Funny Tamil Cinema Achievement System
// -------------------------------------------------------------
function renderMassMeterAndAchievements() {
    const todayStr = getTodayDateString();
    const todayTasks = state.todos.filter(t => t.dueDate === todayStr);

    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

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

    if (total === 0) {
        // Empty State: Neutral, no tasks scheduled
        card.classList.add("status-empty");
        if (icon) icon.textContent = "😎";
        if (badgeText) badgeText.textContent = "Daily Mass Meter";
        title.textContent = "Innaiku plan pannala machi 😎";
        sub.textContent = "No tasks scheduled for today. Add a mission to start your daily mass!";
        fill.style.backgroundColor = "var(--text-muted)";
    } else if (completed === total) {
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
    } else if (completed > 0 && completed < total) {
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
    const modal = document.getElementById("task-modal");
    const title = document.getElementById("task-modal-title");
    const saveBtn = document.getElementById("modal-task-save-btn");

    if (title) title.textContent = "Create New Mission";
    if (saveBtn) saveBtn.textContent = "Save Mission";

    document.getElementById("modal-task-id").value = "";
    document.getElementById("modal-task-title").value = defaults.title || "";
    document.getElementById("modal-task-desc").value = defaults.description || "";
    document.getElementById("modal-task-due").value = defaults.dueDate || getTodayDateString();
    document.getElementById("modal-task-category").value = defaults.category || "Work";

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

    if (modal) modal.classList.add("open");
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

    if (modal) modal.classList.add("open");
}

function closeTaskModal() {
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
    const id = document.getElementById("modal-task-id").value;
    const title = document.getElementById("modal-task-title").value.trim();
    const desc = document.getElementById("modal-task-desc").value.trim();
    const dueDate = document.getElementById("modal-task-due").value;
    const category = document.getElementById("modal-task-category").value;
    const priority = document.getElementById("modal-task-priority").value;

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
                completed: existing ? existing.completed : false,
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
// Preferences Local Storage Cache
// -------------------------------------------------------------
function loadUserPreferences() {
    const key = `taskverse_prefs_${getLoggedInEmail()}`;
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
        }
    } catch (e) {
        console.warn("Failed to load user preferences:", e);
    }
    updateCategorySelectOptions();
}

function saveUserPreferences() {
    const key = `taskverse_prefs_${getLoggedInEmail()}`;
    try {
        localStorage.setItem(key, JSON.stringify({
            customCategories: state.customCategories,
            soundEnabled: state.soundEnabled
        }));
    } catch (e) {
        console.warn("Failed to save user preferences:", e);
    }
}

// -------------------------------------------------------------
// Global Event Listeners & Initialization
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
    // Initialize server selector UI
    updateServerSelectorUI();

    // Check if on dashboard / todos page
    if (document.getElementById("todo-list") || document.getElementById("view-dashboard")) {
        loadTodos();
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
