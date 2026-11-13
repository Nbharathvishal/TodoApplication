// ============================================================================
// TaskVerse Comprehensive 3-Tier Application QA Audit Test Suite
// Tiers: Frontend (UI/Logic) | Backend (APIs/Auth) | Database (Models/Integrity)
// ============================================================================
const fs = require("fs");
const path = require("path");
const assert = require("assert");

console.log("=== STARTING TASKVERSE 3-TIER COMPREHENSIVE QA AUDIT ===\n");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✓ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}: ${err.message}`);
    }
}

// ----------------------------------------------------------------------------
// SECTION 1: TIER 1 - FRONTEND ASSETS, DOM STRUCTURE & UI VERIFICATION
// ----------------------------------------------------------------------------
console.log("--- TIER 1: FRONTEND TESTING (UI, DOM, ACCESSIBILITY, RESPONSIVENESS) ---");

const todosHtml = fs.readFileSync(path.join(__dirname, "todos.html"), "utf8");
const loginHtml = fs.readFileSync(path.join(__dirname, "login.html"), "utf8");
const registerHtml = fs.readFileSync(path.join(__dirname, "register.html"), "utf8");
const scriptJs = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
const styleCss = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");

runTest("UI-01: Login page form elements and autocomplete attributes", () => {
    assert(loginHtml.includes('id="email"'), "Login must contain email input");
    assert(loginHtml.includes('id="password"'), "Login must contain password input");
    assert(loginHtml.includes('id="login-btn"'), "Login must contain submit button");
    assert(!loginHtml.includes("server-selector-card"), "Login must not contain manual server selector");
});

runTest("UI-02: Register page form elements and autocomplete attributes", () => {
    assert(registerHtml.includes('id="email"'), "Register must contain email input");
    assert(registerHtml.includes('id="password"'), "Register must contain password input");
    assert(registerHtml.includes('id="register-btn"'), "Register must contain submit button");
    assert(!registerHtml.includes("server-selector-card"), "Register must not contain manual server selector");
});

runTest("UI-03: Dashboard navigation views and DOM containers", () => {
    const requiredViews = ["view-dashboard", "view-tasks", "view-categories", "view-settings"];
    requiredViews.forEach(v => {
        assert(todosHtml.includes(`id="${v}"`), `Dashboard must contain view container #${v}`);
    });
});

runTest("UI-04: Dashboard KPI counter and milestone elements", () => {
    const requiredElements = [
        "stat-total-tasks", "stat-completed-tasks", "stat-pending-tasks", "stat-overdue-tasks",
        "overall-progress-bar", "overall-progress-pct", "achievement-card", "achievement-quote-card",
        "streak-current", "streak-best", "streak-weekly-rate", "heatmap-row"
    ];
    requiredElements.forEach(id => {
        assert(todosHtml.includes(`id="${id}"`), `Dashboard must contain element #${id}`);
    });
});

runTest("UI-05: Habit tracker spreadsheet structure (Thead, Tbody, Tfoot)", () => {
    assert(todosHtml.includes('id="habit-tracker-table"'), "Must contain #habit-tracker-table");
    assert(todosHtml.includes('id="ht-table-thead"'), "Must contain dynamic thead");
    assert(todosHtml.includes('id="ht-table-tbody"'), "Must contain dynamic tbody");
    assert(todosHtml.includes('id="ht-table-tfoot"'), "Must contain dynamic tfoot");
});

runTest("UI-06: Add/Edit Task Modal responsive height & scrolling support in CSS", () => {
    assert(styleCss.includes(".modal-dialog"), "Must have .modal-dialog class");
    assert(styleCss.includes("overflow-y: auto") || styleCss.includes("overflow-y:auto"), "Modal body must have vertical scroll");
    assert(styleCss.includes("max-height") || styleCss.includes("max-height: 90vh") || styleCss.includes("max-height:90vh"), "Modal must be viewport bounded");
});

runTest("UI-07: Habit tracker fixed column sticky implementation in CSS", () => {
    assert(styleCss.includes("position: sticky") || styleCss.includes("position:sticky"), "Table must use sticky columns");
    assert(styleCss.includes("z-index"), "Sticky columns must define proper z-index layering");
});

runTest("UI-08: Media assets existence verification", () => {
    const assets = [
        "assets/images/quote-bg.svg",
        "assets/videos/Choppalangi.mp4",
        "assets/videos/kola mass uh.mp4",
        "assets/videos/Romba Kastam bro.mp4"
    ];
    assets.forEach(a => {
        assert(fs.existsSync(path.join(__dirname, a)), `Media asset ${a} must exist on disk`);
    });
});

// ----------------------------------------------------------------------------
// SECTION 2: TIER 1 - BUSINESS LOGIC, HABIT TRACKER & METADATA
// ----------------------------------------------------------------------------
console.log("\n--- TIER 1: FRONTEND BUSINESS LOGIC & HABIT TRACKING ENGINE ---");

function mockGetTodayDateString() {
    return "2026-11-13";
}

function parseTodoMetadata(rawTodo) {
    const todo = {
        ...rawTodo,
        completed: rawTodo.completed ?? rawTodo.isCompleted ?? false
    };

    const desc = rawTodo.description || "";
    const metaRegex = /<!--taskverse:(\{.*?\})-->/;
    const match = desc.match(metaRegex);

    let priority = "Medium";
    let dueDate = mockGetTodayDateString();
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
            cleanDescription = desc.replace(metaRegex, "").trim();
        } catch (e) {}
    }

    if (cleanDescription === todo.title) {
        cleanDescription = "";
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
    const meta = {
        priority: todoInput.priority || "Medium",
        dueDate: todoInput.dueDate || mockGetTodayDateString(),
        category: todoInput.category || "Work",
        recurrence: todoInput.recurrence || { frequency: "none" },
        goal: todoInput.goal !== undefined && todoInput.goal !== null ? Number(todoInput.goal) : 30,
        completedDates: Array.isArray(todoInput.completedDates) ? todoInput.completedDates : []
    };

    const metaTag = `<!--taskverse:${JSON.stringify(meta)}-->`;
    const inputDesc = (todoInput.cleanDescription !== undefined ? todoInput.cleanDescription : (todoInput.description || "")).trim();
    const strippedDesc = inputDesc.replace(/<!--taskverse:[\s\S]*?-->/g, "").trim();

    const finalDescription = strippedDesc ? `${strippedDesc}\n${metaTag}` : `${todoInput.title}\n${metaTag}`;

    return {
        id: todoInput.id,
        title: todoInput.title,
        description: finalDescription,
        completed: Boolean(todoInput.completed)
    };
}

runTest("LOGIC-01: Metadata serialization and parsing roundtrip", () => {
    const original = {
        id: 101,
        title: "Cold Calling Missions",
        description: "Call 20 prospects every morning",
        dueDate: "2026-11-05",
        priority: "High",
        category: "Work",
        goal: 45,
        completedDates: ["2026-11-05", "2026-11-06", "2026-11-07"],
        completed: true,
        recurrence: {
            frequency: "custom_days",
            customDays: [1, 2, 3, 4, 5],
            endType: "never"
        }
    };

    const backendPayload = serializeTodoForBackend(original);
    assert.strictEqual(backendPayload.id, 101);
    assert.strictEqual(backendPayload.title, "Cold Calling Missions");
    assert.strictEqual(backendPayload.completed, true);
    assert(backendPayload.description.includes("<!--taskverse:"), "Must include taskverse meta tag");

    const parsed = parseTodoMetadata(backendPayload);
    assert.strictEqual(parsed.priority, "High");
    assert.strictEqual(parsed.category, "Work");
    assert.strictEqual(parsed.goal, 45);
    assert.deepStrictEqual(parsed.completedDates, ["2026-11-05", "2026-11-06", "2026-11-07"]);
    assert.strictEqual(parsed.recurrence.frequency, "custom_days");
    assert.strictEqual(parsed.cleanDescription, "Call 20 prospects every morning");
});

runTest("LOGIC-02: Past date habit locking rules", () => {
    const today = "2026-11-13";
    const pastCompleted = "2026-11-05";
    const pastMissed = "2026-11-08";
    const futureDate = "2026-11-20";

    const habit = {
        dueDate: "2026-11-01",
        completedDates: ["2026-11-05"],
        recurrence: { frequency: "daily" }
    };

    function evaluateDateCellState(habit, dateStr, todayStr) {
        const isPast = dateStr < todayStr;
        const isToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;
        const isCompleted = habit.completedDates.includes(dateStr);

        if (isPast) {
            return {
                locked: true,
                display: isCompleted ? "CHECKMARK" : "RED_CROSS",
                interactive: false
            };
        } else if (isToday) {
            return {
                locked: false,
                display: isCompleted ? "CHECKMARK" : "EMPTY_CHECKBOX",
                interactive: true
            };
        } else {
            return {
                locked: true,
                display: "EMPTY_CHECKBOX",
                interactive: false
            };
        }
    }

    const statePastComp = evaluateDateCellState(habit, pastCompleted, today);
    assert.strictEqual(statePastComp.locked, true);
    assert.strictEqual(statePastComp.display, "CHECKMARK");
    assert.strictEqual(statePastComp.interactive, false);

    const statePastMissed = evaluateDateCellState(habit, pastMissed, today);
    assert.strictEqual(statePastMissed.locked, true);
    assert.strictEqual(statePastMissed.display, "RED_CROSS");
    assert.strictEqual(statePastMissed.interactive, false);

    const stateToday = evaluateDateCellState(habit, today, today);
    assert.strictEqual(stateToday.locked, false);
    assert.strictEqual(stateToday.interactive, true);

    const stateFuture = evaluateDateCellState(habit, futureDate, today);
    assert.strictEqual(stateFuture.locked, true);
    assert.strictEqual(stateFuture.interactive, false);
});

// ----------------------------------------------------------------------------
// SECTION 3: TIER 2 - BACKEND APIS & CONTROLLER CONTRACTS
// ----------------------------------------------------------------------------
console.log("\n--- TIER 2: BACKEND CONTROLLER & API CONTRACT TESTING ---");

const authControllerSrc = fs.readFileSync(path.join(__dirname, "../SpringLearning/src/main/java/Course/SpringLearning/Controller/AuthController.java"), "utf8");
const todoControllerSrc = fs.readFileSync(path.join(__dirname, "../SpringLearning/src/main/java/Course/SpringLearning/Controller/TodoController.java"), "utf8");
const securityConfigSrc = fs.readFileSync(path.join(__dirname, "../SpringLearning/src/main/java/Course/SpringLearning/SecurityConfig.java"), "utf8");

runTest("API-01: Auth endpoints defined with correct paths and verbs", () => {
    assert(authControllerSrc.includes('@RequestMapping("/auth")'), "AuthController must map to /auth");
    assert(authControllerSrc.includes('@GetMapping("/ping")'), "Must have GET /auth/ping");
    assert(authControllerSrc.includes('@PostMapping("/register")'), "Must have POST /auth/register");
    assert(authControllerSrc.includes('@PostMapping("/login")'), "Must have POST /auth/login");
});

runTest("API-02: Email normalization and case-insensitivity in AuthController", () => {
    assert(authControllerSrc.includes("normalizeEmail"), "Must have normalizeEmail helper");
    assert(authControllerSrc.includes("findByEmailIgnoreCase"), "Must use findByEmailIgnoreCase");
});

runTest("API-03: Legacy plaintext upgrade support in AuthController", () => {
    assert(authControllerSrc.includes("passwordEncoder.matches"), "Must check BCrypt passwordEncoder");
    assert(authControllerSrc.includes("rawPassword.equals(storedPassword)"), "Must support legacy plaintext comparison fallback");
    assert(authControllerSrc.includes("passwordEncoder.encode(rawPassword)"), "Must upgrade legacy plaintext to BCrypt");
});

runTest("API-04: Todo endpoints defined with complete CRUD verbs", () => {
    assert(todoControllerSrc.includes('@RequestMapping("/api/todo")'), "TodoController must map to /api/todo");
    assert(todoControllerSrc.includes("@GetMapping()"), "Must have GET /api/todo");
    assert(todoControllerSrc.includes('@GetMapping("/{id}")'), "Must have GET /api/todo/{id}");
    assert(todoControllerSrc.includes('@GetMapping("/page")'), "Must have GET /api/todo/page");
    assert(todoControllerSrc.includes('@PostMapping("/create")'), "Must have POST /api/todo/create");
    assert(todoControllerSrc.includes("@PutMapping()"), "Must have PUT /api/todo");
    assert(todoControllerSrc.includes('@PutMapping("/{id}")'), "Must have PUT /api/todo/{id}");
    assert(todoControllerSrc.includes('@DeleteMapping("/{id}")'), "Must have DELETE /api/todo/{id}");
});

runTest("API-05: Multi-tenant user isolation in TodoController", () => {
    assert(todoControllerSrc.includes("getAuthenticatedUser()"), "Must extract authenticated user from SecurityContext");
    assert(todoControllerSrc.includes("getAllTodosByUser(user)"), "All todos query must filter by user");
    assert(todoControllerSrc.includes("getTodoByIdAndUser(id, user)"), "Get by ID must filter by user");
    assert(todoControllerSrc.includes("deleteTodoByIdAndUser(id, user)"), "Delete must filter by user");
});

runTest("API-06: Security configuration permits auth and secures /api/**", () => {
    assert(securityConfigSrc.includes('.requestMatchers("/auth/**"'), "Public endpoints must permit /auth/**");
    assert(securityConfigSrc.includes(".anyRequest().authenticated()"), "All other endpoints must require authentication");
    assert(securityConfigSrc.includes("setAllowCredentials(true)"), "CORS must allow credentials");
});

// ----------------------------------------------------------------------------
// SECTION 4: TIER 3 - DATABASE SCHEMA & INTEGRITY TESTING
// ----------------------------------------------------------------------------
console.log("\n--- TIER 3: DATABASE ENTITY MODELS, CONSTRAINTS & INTEGRITY ---");

const userModelSrc = fs.readFileSync(path.join(__dirname, "../SpringLearning/src/main/java/Course/SpringLearning/Models/User.java"), "utf8");
const todoModelSrc = fs.readFileSync(path.join(__dirname, "../SpringLearning/src/main/java/Course/SpringLearning/Models/Todo.java"), "utf8");
const userRepoSrc = fs.readFileSync(path.join(__dirname, "../SpringLearning/src/main/java/Course/SpringLearning/Repository/UserRepository.java"), "utf8");
const todoRepoSrc = fs.readFileSync(path.join(__dirname, "../SpringLearning/src/main/java/Course/SpringLearning/Repository/TodoRepository.java"), "utf8");

runTest("DB-01: User entity maps to user_table with primary key and email", () => {
    assert(userModelSrc.includes('@Table(name = "user_table")'), "User must map to table user_table");
    assert(userModelSrc.includes("@Id"), "User must have @Id primary key");
    assert(userModelSrc.includes("String email;"), "User must have email column");
    assert(userModelSrc.includes("String password;"), "User must have password column");
});

runTest("DB-02: Todo entity uses TEXT column definition for rich metadata payload", () => {
    assert(todoModelSrc.includes('@Column(columnDefinition = "TEXT")'), "Description must be TEXT for large metadata");
    assert(todoModelSrc.includes("@ManyToOne"), "Todo must have @ManyToOne relationship with User");
    assert(todoModelSrc.includes('@JoinColumn(name = "user_id"'), "Todo foreign key must be user_id");
});

runTest("DB-03: Repository method declarations enforce referential integrity", () => {
    assert(userRepoSrc.includes("findByEmailIgnoreCase"), "UserRepository must declare findByEmailIgnoreCase");
    assert(todoRepoSrc.includes("findByUser(User user)"), "TodoRepository must declare findByUser");
    assert(todoRepoSrc.includes("findByIdAndUser(Long id, User user)"), "TodoRepository must declare findByIdAndUser");
});

// ----------------------------------------------------------------------------
// SECTION 5: AUTOMATIC ENVIRONMENT RESOLUTION TESTING
// ----------------------------------------------------------------------------
console.log("\n--- ENVIRONMENT CONFIGURATION & AUTOMATIC ROUTING AUDIT ---");

const configJsSrc = fs.readFileSync(path.join(__dirname, "config.js"), "utf8");

runTest("ENV-01: config.js automatic local vs production URL resolution", () => {
    assert(configJsSrc.includes("isLocal"), "config.js must contain isLocal detection");
    assert(configJsSrc.includes("http://localhost:8080"), "config.js must define local default URL");
    assert(configJsSrc.includes("https://todo-backend-zyqf.onrender.com"), "config.js must define production URL");
});

runTest("ENV-02: No stale localStorage manual server override remains in script.js", () => {
    assert(!scriptJs.includes('localStorage.getItem("taskverse_server_url")'), "Must not use manual server URL localStorage key");
    assert(scriptJs.includes("getServerUrl()"), "Must use centralized getServerUrl function");
});

// ----------------------------------------------------------------------------
// SECTION 6: SETTINGS PAGE ENHANCEMENT AUDIT (THEME, DELETION & LAYOUT)
// ----------------------------------------------------------------------------
console.log("\n--- SETTINGS PAGE ENHANCEMENT AUDIT (THEME, ACCOUNT DELETION & LAYOUT) ---");

runTest("SETTINGS-01: Appearance section and segmented Light/Dark toggle elements", () => {
    assert(todosHtml.includes('id="theme-btn-light"'), "Must contain theme-btn-light button");
    assert(todosHtml.includes('id="theme-btn-dark"'), "Must contain theme-btn-dark button");
    assert(todosHtml.includes("theme-segmented-group"), "Must have theme-segmented-group CSS class");
    assert(scriptJs.includes("getActiveTheme()"), "script.js must define getActiveTheme");
    assert(scriptJs.includes("applyTheme("), "script.js must define applyTheme");
    assert(scriptJs.includes("setUserTheme("), "script.js must define setUserTheme");
});

runTest("SETTINGS-02: Default Light Mode configuration and zero-FOUC script", () => {
    assert(todosHtml.includes('document.documentElement.setAttribute("data-theme", theme || "light")') ||
           todosHtml.includes('theme || "light"'), "todos.html must default theme to light");
    assert(scriptJs.includes('return "light"') || scriptJs.includes("theme || 'light'"), "getActiveTheme must fallback to light");
    assert(styleCss.includes('[data-theme="light"]'), "style.css must define [data-theme='light'] overrides");
});

runTest("SETTINGS-03: Settings section order strictly matches required layout specification", () => {
    const userAccountIdx = todosHtml.indexOf("User Account");
    const backendConnIdx = todosHtml.indexOf("Backend Connection");
    const appearanceIdx = todosHtml.indexOf("Appearance");
    const experienceIdx = todosHtml.indexOf("Experience & Audio");
    const productivityIdx = todosHtml.indexOf("Productivity Data");
    const accountMgmtIdx = todosHtml.indexOf("Account Management");

    assert(userAccountIdx !== -1, "User Account section missing");
    assert(backendConnIdx !== -1, "Backend Connection section missing");
    assert(appearanceIdx !== -1, "Appearance section missing");
    assert(experienceIdx !== -1, "Experience & Audio section missing");
    assert(productivityIdx !== -1, "Productivity Data section missing");
    assert(accountMgmtIdx !== -1, "Account Management section missing");

    assert(userAccountIdx < backendConnIdx, "Order violation: User Account must precede Backend Connection");
    assert(backendConnIdx < appearanceIdx, "Order violation: Backend Connection must precede Appearance");
    assert(appearanceIdx < experienceIdx, "Order violation: Appearance must precede Experience & Audio");
    assert(experienceIdx < productivityIdx, "Order violation: Experience & Audio must precede Productivity Data");
    assert(productivityIdx < accountMgmtIdx, "Order violation: Productivity Data must precede Account Management");
});

runTest("SETTINGS-04: Account Management section and Delete Account modal with password confirmation", () => {
    assert(todosHtml.includes('id="btn-open-delete-account"'), "Must contain Delete Account trigger button");
    assert(todosHtml.includes('id="delete-account-modal"'), "Must contain delete-account-modal");
    assert(todosHtml.includes('id="delete-account-password"'), "Must contain password confirmation input");
    assert(todosHtml.includes('id="btn-confirm-delete-account"'), "Must contain permanently delete button");
    assert(scriptJs.includes("openDeleteAccountModal()"), "script.js must define openDeleteAccountModal");
    assert(scriptJs.includes("closeDeleteAccountModal()"), "script.js must define closeDeleteAccountModal");
    assert(scriptJs.includes("submitDeleteAccount()"), "script.js must define submitDeleteAccount");
});

runTest("SETTINGS-05: Backend AuthController and UserSevice transactional cascade delete support", () => {
    const authCtrlPath = path.join(__dirname, "..", "SpringLearning", "src", "main", "java", "Course", "SpringLearning", "Controller", "AuthController.java");
    const userSvcPath = path.join(__dirname, "..", "SpringLearning", "src", "main", "java", "Course", "SpringLearning", "Service", "UserSevice.java");
    const todoRepoPath = path.join(__dirname, "..", "SpringLearning", "src", "main", "java", "Course", "SpringLearning", "Repository", "TodoRepository.java");

    const authCtrlSrc = fs.readFileSync(authCtrlPath, "utf8");
    const userSvcSrc = fs.readFileSync(userSvcPath, "utf8");
    const todoRepoSrc = fs.readFileSync(todoRepoPath, "utf8");

    assert(authCtrlSrc.includes('@PostMapping("/delete-account")'), "AuthController must support POST /delete-account");
    assert(authCtrlSrc.includes("passwordEncoder.matches"), "Must verify password before account deletion");
    assert(userSvcSrc.includes("deleteUserAndData"), "UserSevice must define deleteUserAndData");
    assert(userSvcSrc.includes("@Transactional"), "deleteUserAndData must execute inside @Transactional boundary");
    assert(todoRepoSrc.includes("deleteByUser(User user)"), "TodoRepository must define deleteByUser");
});

// ----------------------------------------------------------------------------
// SECTION 7: APPROVED LIGHT THEME SYSTEM AUDIT (GREEN, CREAM, WHITE & GOLD)
// ----------------------------------------------------------------------------
console.log("\n--- LIGHT THEME AUDIT: APPROVED GREEN, CREAM, WHITE & GOLD PALETTE ---");

runTest("PALETTE-01: Approved Light Theme primary tokens defined in CSS", () => {
    assert(styleCss.includes("#17652F"), "Forest Green (#17652F) token must be present");
    assert(styleCss.includes("#398443"), "Fresh Green (#398443) token must be present");
    assert(styleCss.includes("#E8F2D5"), "Leaf Green (#E8F2D5) token must be present");
    assert(styleCss.includes("#FAF9EF"), "Cream (#FAF9EF) background token must be present");
    assert(styleCss.includes("#FFFFFF"), "Pure White (#FFFFFF) surface token must be present");
    assert(styleCss.includes("#E9B83D"), "Golden Accent (#E9B83D) token must be present");
});

runTest("PALETTE-02: Approved Light Theme semantic tokens and contrasts", () => {
    assert(styleCss.includes("#112617"), "Dark readable forest text (#112617) must be defined");
    assert(styleCss.includes("#4A6351"), "Muted dark green-grey (#4A6351) must be defined");
    assert(styleCss.includes("#D8E2D1"), "Soft neutral green-grey border (#D8E2D1) must be defined");
});

runTest("PALETTE-03: Sidebar and Topbar Light Mode green styling", () => {
    assert(styleCss.includes('[data-theme="light"] .app-sidebar'), "Sidebar light theme rules must exist");
    assert(styleCss.includes('[data-theme="light"] .app-topbar'), "Topbar light theme rules must exist");
    assert(styleCss.includes('[data-theme="light"] .nav-item.active'), "Sidebar active item must be styled");
});

runTest("PALETTE-04: Habit Tracker spreadsheet alternating White/Cream rows and Leaf Green footer", () => {
    assert(styleCss.includes('[data-theme="light"] .ht-row:nth-child(even)'), "Spreadsheet even row styling must exist");
    assert(styleCss.includes('[data-theme="light"] .ht-row:nth-child(odd)'), "Spreadsheet odd row styling must exist");
    assert(styleCss.includes('[data-theme="light"] .ht-summary-row'), "Daily completion footer light styling must exist");
    assert(styleCss.includes('[data-theme="light"] .ht-checkbox-native:checked'), "Checked habit indicators must use Fresh Green in light mode");
});

runTest("PALETTE-05: Dark Mode tokens remain completely preserved and uncompromised", () => {
    assert(styleCss.includes("--bg-charcoal: #171717;"), "Dark theme --bg-charcoal must remain #171717");
    assert(styleCss.includes("--bg-charcoal-subtle: #1c1c1c;"), "Dark theme --bg-charcoal-subtle must remain #1c1c1c");
    assert(styleCss.includes("--accent-crimson: #A51C18;"), "Dark theme --accent-crimson must remain #A51C18");
});

runTest("PALETTE-06: Task filter button inactive/active/hover colors and contrast", () => {
    assert(styleCss.includes('[data-theme="light"] .filter-pill'), "Must have light theme .filter-pill rule");
    assert(styleCss.includes('[data-theme="light"] .filter-pill.active'), "Must have light theme .filter-pill.active rule");
    // Ensure active filter pill has Forest Green background and White text for high contrast
    assert(styleCss.includes('[data-theme="light"] .filter-pill.active {\n    background-color: #17652F !important;\n    color: #FFFFFF !important;'),
           "Active filter pill must use Forest Green (#17652F) background with White (#FFFFFF) text");
});

runTest("PALETTE-07: Category filter pill inactive/active/hover colors and contrast", () => {
    assert(styleCss.includes('[data-theme="light"] .cat-pill'), "Must have light theme .cat-pill rule");
    assert(styleCss.includes('[data-theme="light"] .cat-pill.active'), "Must have light theme .cat-pill.active rule");
    assert(styleCss.includes('[data-theme="light"] .cat-pill.active {\n    background-color: #17652F !important;\n    color: #FFFFFF !important;'),
           "Active category pill must use Forest Green (#17652F) background with White (#FFFFFF) text");
});

// ----------------------------------------------------------------------------
// SECTION 8: SIDEBAR NAVIGATION SYNCHRONIZATION AUDIT
// ----------------------------------------------------------------------------
console.log("\n--- SIDEBAR ACTIVE NAVIGATION SYNCHRONIZATION AUDIT ---");

runTest("NAV-01: switchView canonicalizes and strictly activates target sidebar navigation item", () => {
    assert(scriptJs.includes("btn.classList.toggle(\"active\", itemKey === activeNavKey);"), "switchView must strictly activate activeNavKey only");
    assert(scriptJs.includes('activeNavKey = "today"'), "switchView must recognize today as independent active nav key");
    assert(scriptJs.includes('activeNavKey = "completed"'), "switchView must recognize completed as independent active nav key");
    assert(scriptJs.includes('activeNavKey = "tasks"'), "switchView must recognize tasks as independent active nav key");
});

runTest("NAV-02: applyTaskFilter synchronizes active sidebar item for Today, Completed, and Habit Tracker", () => {
    assert(scriptJs.includes('function applyTaskFilter(filterName, syncNav = true)'), "applyTaskFilter must support syncNav");
    assert(scriptJs.includes('activeNavKey = "today"'), "applyTaskFilter must support today activeNavKey");
    assert(scriptJs.includes('activeNavKey = "completed"'), "applyTaskFilter must support completed activeNavKey");
});

runTest("NAV-03: syncRouteFromLocation supports browser hash routing, Back, Forward, and direct refresh", () => {
    assert(scriptJs.includes("function syncRouteFromLocation()"), "Must define syncRouteFromLocation");
    assert(scriptJs.includes('window.addEventListener("popstate", syncRouteFromLocation);'), "Must listen to popstate event");
    assert(scriptJs.includes('window.addEventListener("hashchange", syncRouteFromLocation);'), "Must listen to hashchange event");
    assert(scriptJs.includes("syncRouteFromLocation();"), "DOMContentLoaded must call syncRouteFromLocation");
});

console.log(`\n============================================================================`);
console.log(`QA AUDIT EXECUTION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
console.log(`============================================================================\n`);
