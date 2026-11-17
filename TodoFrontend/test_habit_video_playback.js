const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Setup DOM mock environment
const domMock = {
    elements: {},
    getElementById(id) {
        if (!this.elements[id]) {
            this.elements[id] = {
                id,
                style: {},
                classList: {
                    classes: new Set(),
                    add(c) { this.classes.add(c); },
                    remove(...cList) { cList.forEach(c => this.classes.delete(c)); },
                    contains(c) { return this.classes.has(c); }
                },
                getAttribute(attr) { return this[attr] || ""; },
                setAttribute(attr, val) { this[attr] = val; },
                textContent: "",
                innerHTML: "",
                dataset: {},
                addEventListener() {},
                removeEventListener() {},
                getContext() {
                    return new Proxy({}, { get: () => () => {} });
                },
                play() { return Promise.resolve(); },
                pause() {},
                load() {},
                parentNode: { removeChild() {} },
                appendChild(c) { return c; },
                removeChild(c) { return c; }
            };
        }
        return this.elements[id];
    },
    createElement(tag) {
        return this.getElementById(tag + "_" + Math.random().toString(36).substring(2));
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener() {}
};

global.window = {
    location: { hostname: "localhost", protocol: "http:" },
    addEventListener() {},
    __achievementTimeOverride: new Date(2026, 10, 17, 17, 0, 0) // 5:00 PM (Active video window)
};
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.Audio = class { play() { return Promise.resolve(); } pause() {} };
global.document = domMock;
global.localStorage = {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; },
    clear() { this.store = {}; }
};

// Load script.js into runtime
const scriptContent = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
eval(scriptContent);

// Verification test suite
let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
    totalCount++;
    try {
        fn();
        console.log(`✓ [PASS] ${name}`);
        passedCount++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}:`, err.message);
    }
}

console.log("=== HABIT-BASED DASHBOARD VIDEO PLAYBACK AUDIT TEST SUITE ===");

const todayStr = getTodayDateString();

// Scenario 1: 2 habits, 0 completed -> 0% (CHOPPALANGI)
runTest("Scenario 1: 2 habits, 0 completed -> 0% (CHOPPALANGI)", () => {
    state.todos = [
        { id: 101, title: "Morning Run", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] },
        { id: 102, title: "Read Book", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] }
    ];
    const calc = getDailyHabitCompletion(todayStr);
    assert.strictEqual(calc.total, 2, "Total habits must be 2");
    assert.strictEqual(calc.completed, 0, "Completed habits must be 0");
    assert.strictEqual(calc.pct, 0, "Percentage must be 0%");
    assert.strictEqual(calc.stateKey, "CHOPPALANGI", "State must be CHOPPALANGI");
    assert(calc.videoSrc.includes("Choppalangi"), "Video must be Choppalangi");
});

// Scenario 2: 2 habits, 1 completed -> 50% (PARTIAL, Romba Kastam)
runTest("Scenario 2: 2 habits, 1 completed -> 50% (PARTIAL)", () => {
    state.todos = [
        { id: 101, title: "Morning Run", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 102, title: "Read Book", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] }
    ];
    const calc = getDailyHabitCompletion(todayStr);
    assert.strictEqual(calc.total, 2, "Total habits must be 2");
    assert.strictEqual(calc.completed, 1, "Completed habits must be 1");
    assert.strictEqual(calc.pct, 50, "Percentage must be 50%");
    assert.strictEqual(calc.stateKey, "PARTIAL", "State must be PARTIAL");
    assert(calc.videoSrc.includes("Romba Kastam"), "Video must be Romba Kastam");
});

// Scenario 3: 2 habits, 2 completed -> 100% (KOLA_MASS)
runTest("Scenario 3: 2 habits, 2 completed -> 100% (KOLA_MASS)", () => {
    state.todos = [
        { id: 101, title: "Morning Run", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 102, title: "Read Book", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] }
    ];
    const calc = getDailyHabitCompletion(todayStr);
    assert.strictEqual(calc.total, 2, "Total habits must be 2");
    assert.strictEqual(calc.completed, 2, "Completed habits must be 2");
    assert.strictEqual(calc.pct, 100, "Percentage must be 100%");
    assert.strictEqual(calc.stateKey, "KOLA_MASS", "State must be KOLA_MASS");
    assert(calc.videoSrc.includes("kola mass"), "Video must be Kola Mass");
});

// Scenario 4: 4 habits, 1 completed -> 25% (PARTIAL)
runTest("Scenario 4: 4 habits, 1 completed -> 25% (PARTIAL)", () => {
    state.todos = [
        { id: 201, title: "H1", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 202, title: "H2", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] },
        { id: 203, title: "H3", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] },
        { id: 204, title: "H4", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] }
    ];
    const calc = getDailyHabitCompletion(todayStr);
    assert.strictEqual(calc.total, 4);
    assert.strictEqual(calc.completed, 1);
    assert.strictEqual(calc.pct, 25);
    assert.strictEqual(calc.stateKey, "PARTIAL");
});

// Scenario 5: 4 habits, 2 completed -> 50% (PARTIAL)
runTest("Scenario 5: 4 habits, 2 completed -> 50% (PARTIAL)", () => {
    state.todos = [
        { id: 201, title: "H1", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 202, title: "H2", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 203, title: "H3", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] },
        { id: 204, title: "H4", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] }
    ];
    const calc = getDailyHabitCompletion(todayStr);
    assert.strictEqual(calc.total, 4);
    assert.strictEqual(calc.completed, 2);
    assert.strictEqual(calc.pct, 50);
    assert.strictEqual(calc.stateKey, "PARTIAL");
});

// Scenario 6: 4 habits, 3 completed -> 75% (PARTIAL)
runTest("Scenario 6: 4 habits, 3 completed -> 75% (PARTIAL)", () => {
    state.todos = [
        { id: 201, title: "H1", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 202, title: "H2", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 203, title: "H3", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 204, title: "H4", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] }
    ];
    const calc = getDailyHabitCompletion(todayStr);
    assert.strictEqual(calc.total, 4);
    assert.strictEqual(calc.completed, 3);
    assert.strictEqual(calc.pct, 75);
    assert.strictEqual(calc.stateKey, "PARTIAL");
});

// Scenario 7: 4 habits, 4 completed -> 100% (KOLA_MASS)
runTest("Scenario 7: 4 habits, 4 completed -> 100% (KOLA_MASS)", () => {
    state.todos = [
        { id: 201, title: "H1", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 202, title: "H2", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 203, title: "H3", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 204, title: "H4", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] }
    ];
    const calc = getDailyHabitCompletion(todayStr);
    assert.strictEqual(calc.total, 4);
    assert.strictEqual(calc.completed, 4);
    assert.strictEqual(calc.pct, 100);
    assert.strictEqual(calc.stateKey, "KOLA_MASS");
});

// Scenario 8: Independence Test: Today's Execution 100% vs Daily Habits 50%
runTest("Scenario 8: Today's Execution 100% (5/5) does NOT trigger Kola Mass video when Habits are 50% (1/2)", () => {
    // 5 one-off non-habit tasks due today, all 100% completed
    // 2 daily habits, only 1 completed (50%)
    state.todos = [
        { id: 1, title: "Task 1", dueDate: todayStr, recurrence: { frequency: "none" }, completed: true },
        { id: 2, title: "Task 2", dueDate: todayStr, recurrence: { frequency: "none" }, completed: true },
        { id: 3, title: "Task 3", dueDate: todayStr, recurrence: { frequency: "none" }, completed: true },
        { id: 4, title: "Task 4", dueDate: todayStr, recurrence: { frequency: "none" }, completed: true },
        { id: 5, title: "Task 5", dueDate: todayStr, recurrence: { frequency: "none" }, completed: true },
        { id: 6, title: "Daily Habit A", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: true, completedDates: [todayStr] },
        { id: 7, title: "Daily Habit B", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] }
    ];

    renderMassMeterAndAchievements();

    const ratioElem = domMock.getElementById("achievement-ratio");
    const fillElem = domMock.getElementById("achievement-meter-fill");
    const cardElem = domMock.getElementById("achievement-card");

    // Today's execution: 7 tasks due today, 6 completed
    assert(ratioElem.textContent.includes("6/7 Tasks"), `Ratio must reflect today's tasks: ${ratioElem.textContent}`);
    
    // Video/Achievement state: strictly based on 2 habits (1/2 = 50% -> PARTIAL)
    assert(cardElem.classList.contains("status-partial"), "Card must have status-partial, NOT status-kola-mass");
    assert(!cardElem.classList.contains("status-kola-mass"), "Card MUST NOT have status-kola-mass");
    assert.strictEqual(achievementVideoManager.lastAchievementState, "PARTIAL", "Achievement video state must be PARTIAL");
});

// Scenario 9: Date Isolation Test: Past day completion does NOT affect today
runTest("Scenario 9: Past day completion does not mark today as completed", () => {
    const yesterdayStr = "2026-11-16";
    state.todos = [
        { id: 801, title: "Exercise", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [yesterdayStr] }
    ];
    const calc = getDailyHabitCompletion(todayStr);
    assert.strictEqual(calc.completed, 0, "Today must be 0 completed");
    assert.strictEqual(calc.pct, 0, "Today percentage must be 0%");
    assert.strictEqual(calc.stateKey, "CHOPPALANGI");
});

// Scenario 10: Safe Zero Habits Test: 0 habits handles safely without NaN
runTest("Scenario 10: Zero daily habits handled safely without NaN or division by zero", () => {
    state.todos = [];
    const calc = getDailyHabitCompletion(todayStr);
    assert.strictEqual(calc.total, 0);
    assert.strictEqual(calc.completed, 0);
    assert.strictEqual(calc.pct, 0);
    assert.strictEqual(calc.stateKey, "EMPTY");
    assert.strictEqual(calc.videoSrc, null);
});

// Scenario 11: Real-time update via onTaskCheckboxUpdated
runTest("Scenario 11: onTaskCheckboxUpdated updates state immediately and syncs Dashboard", () => {
    state.todos = [
        { id: 901, title: "Coding", dueDate: todayStr, recurrence: { frequency: "daily" }, completed: false, completedDates: [] }
    ];
    renderMassMeterAndAchievements();
    assert.strictEqual(achievementVideoManager.lastAchievementState, "CHOPPALANGI");

    // Complete the habit
    onTaskCheckboxUpdated({ id: 901, completed: true, completedDates: [todayStr] });
    assert.strictEqual(achievementVideoManager.lastAchievementState, "KOLA_MASS");
});

console.log(`============================================================`);
console.log(`HABIT-BASED VIDEO AUDIT SUMMARY: ${passedCount}/${totalCount} TESTS PASSED`);
console.log(`============================================================`);
if (passedCount !== totalCount) {
    process.exit(1);
}
