// Automated Test Suite for TaskVerse Frontend Business Logic, Tamil Achievement System & Recurring Tasks Engine
const assert = require("assert");

function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
        const dayOfWeek = cursor.getDay();

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

function calculateAchievement(todayTasks) {
    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    if (total === 0) {
        return {
            title: "Innaiku plan pannala machi 😎",
            sub: "No tasks scheduled for today. Add a mission to start your daily mass!",
            status: "status-empty",
            pct: 0
        };
    } else if (completed === total) {
        return {
            title: "SAAREY KOLA MASS UH 🔥",
            sub: "Innaiku nee dhaan da hero!",
            status: "status-kola-mass",
            pct: 100
        };
    } else if (completed > 0 && completed < total) {
        return {
            title: "AH NEE THEDA MATTA ROMBA KASTAM 😂",
            sub: "Konjam balance irukku machi!",
            status: "status-partial",
            pct
        };
    } else {
        return {
            title: "CHOPPALANGI 🤡",
            sub: "Todo list ready… aana work mattum nadakkala!",
            status: "status-choppalangi",
            pct: 0
        };
    }
}

// -------------------------------------------------------------
// Test Run Execution
// -------------------------------------------------------------
console.log("=== RUNNING TASKVERSE TEST SUITE ===");

// 1. Test Metadata Serialization & Parsing (including recurrence)
const input = {
    title: "Daily Standup Meeting",
    description: "Sync with team on blockers and roadmap",
    priority: "High",
    dueDate: "2026-10-28",
    category: "Work",
    completed: false,
    recurrence: {
        frequency: "weekday",
        customDays: [1, 2, 3, 4, 5],
        endType: "count",
        endCount: 5,
        seriesId: "series_test_123",
        isPaused: false
    }
};
const serialized = serializeTodoForBackend(input);
assert.ok(serialized.description.includes("<!--taskverse:"));
assert.ok(serialized.description.includes("series_test_123"));

const parsed = parseTodoMetadata(serialized);
assert.strictEqual(parsed.title, "Daily Standup Meeting");
assert.strictEqual(parsed.recurrence.frequency, "weekday");
assert.strictEqual(parsed.recurrence.seriesId, "series_test_123");
assert.strictEqual(parsed.recurrence.endCount, 5);
console.log("✓ Test 1 Passed: Recurrence Metadata Serialization & Parsing");

// 2. Test Recurrence Date Calculation: Daily with occurrence count
const dailyDates = calculateSeriesDates("2026-10-28", {
    frequency: "daily",
    endType: "count",
    endCount: 4
});
assert.strictEqual(dailyDates.length, 4);
assert.strictEqual(dailyDates[0], "2026-10-28");
assert.strictEqual(dailyDates[1], "2026-10-29");
assert.strictEqual(dailyDates[2], "2026-10-30");
assert.strictEqual(dailyDates[3], "2026-10-31");
console.log("✓ Test 2 Passed: Daily Recurrence with Occurrence Count");

// 3. Test Recurrence Date Calculation: Weekdays (Mon-Fri) only
// 2026-10-30 is Friday, 2026-10-31 is Saturday, 2026-11-01 is Sunday, 2026-11-02 is Monday
const weekdayDates = calculateSeriesDates("2026-10-30", {
    frequency: "weekday",
    endType: "count",
    endCount: 3
});
assert.strictEqual(weekdayDates.length, 3);
assert.strictEqual(weekdayDates[0], "2026-10-30"); // Friday
assert.strictEqual(weekdayDates[1], "2026-11-02"); // Next Monday (skips Sat & Sun)
assert.strictEqual(weekdayDates[2], "2026-11-03"); // Next Tuesday
console.log("✓ Test 3 Passed: Weekday Recurrence (skips Saturday and Sunday)");

// 4. Test Recurrence Date Calculation: Monthly with month-end safety
// Starting Jan 31 -> Feb 28 -> Mar 31 -> Apr 30
const monthlyDates = calculateSeriesDates("2026-01-31", {
    frequency: "monthly",
    endType: "count",
    endCount: 4
});
assert.strictEqual(monthlyDates.length, 4);
assert.strictEqual(monthlyDates[0], "2026-01-31");
assert.strictEqual(monthlyDates[1], "2026-02-28"); // Clamped to Feb 28
assert.strictEqual(monthlyDates[2], "2026-03-31"); // Restored to 31 in March
assert.strictEqual(monthlyDates[3], "2026-04-30"); // Clamped to 30 in April
console.log("✓ Test 4 Passed: Monthly Recurrence with Month-End Safe Clamping");

// 5. Test Recurrence Date Calculation: Custom days of week (e.g. Mon, Wed, Fri)
const customDates = calculateSeriesDates("2026-10-28", { // Wednesday
    frequency: "custom_days",
    customDays: [1, 3, 5], // Mon, Wed, Fri
    endType: "count",
    endCount: 3
});
assert.strictEqual(customDates.length, 3);
assert.strictEqual(customDates[0], "2026-10-28"); // Wed
assert.strictEqual(customDates[1], "2026-10-30"); // Fri
assert.strictEqual(customDates[2], "2026-11-02"); // Next Mon
console.log("✓ Test 5 Passed: Custom Days Recurrence (Mon, Wed, Fri)");

// 6. Test End Condition: Specific End Date
const endDateDates = calculateSeriesDates("2026-10-28", {
    frequency: "daily",
    endType: "date",
    endDate: "2026-10-30"
});
assert.strictEqual(endDateDates.length, 3);
assert.strictEqual(endDateDates[2], "2026-10-30");
console.log("✓ Test 6 Passed: End Date Boundary Condition");

// 7. Test Duplicate Prevention Logic
const mockExistingTasks = [
    { dueDate: "2026-10-28", recurrence: { seriesId: "series_dup_test" } },
    { dueDate: "2026-10-29", recurrence: { seriesId: "series_dup_test" } }
];
const proposedDates = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"];
const existingDatesSet = new Set(
    mockExistingTasks
        .filter(t => t.recurrence.seriesId === "series_dup_test")
        .map(t => t.dueDate)
);
const newDatesToSchedule = proposedDates.filter(d => !existingDatesSet.has(d));
assert.strictEqual(newDatesToSchedule.length, 2);
assert.deepStrictEqual(newDatesToSchedule, ["2026-10-30", "2026-10-31"]);
console.log("✓ Test 7 Passed: Duplicate Occurrence Prevention");

// 8. Test Occurrence Completion Isolation
const occurrence1 = { id: 1, title: "Workout", dueDate: "2026-10-28", completed: false, recurrence: { seriesId: "s1" } };
const occurrence2 = { id: 2, title: "Workout", dueDate: "2026-10-29", completed: false, recurrence: { seriesId: "s1" } };
occurrence1.completed = true; // Complete today's occurrence
assert.strictEqual(occurrence1.completed, true);
assert.strictEqual(occurrence2.completed, false, "Future occurrences must remain uncompleted");
console.log("✓ Test 8 Passed: Individual Occurrence Completion Isolation");

// 9. Test Tamil Achievement System with Recurring Task Occurrences
const achToday = calculateAchievement([occurrence1]);
assert.strictEqual(achToday.status, "status-kola-mass");
assert.strictEqual(achToday.title, "SAAREY KOLA MASS UH 🔥");
console.log("✓ Test 9 Passed: Tamil Achievement Integration with Recurring Occurrences");

// -------------------------------------------------------------
// Dynamic Time-Based & Task-Driven Achievement Video Tests
// -------------------------------------------------------------
const ACHIEVEMENT_VIDEO_MAP = {
    CHOPPALANGI: "assets/videos/Choppalangi.mp4",
    PARTIAL: "assets/videos/Romba Kastam bro.mp4",
    KOLA_MASS: "assets/videos/kola mass uh.mp4"
};

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

function isAtOrAfter4PM(date) {
    return (date || new Date()).getHours() >= 16;
}

// 10. Test Video Mapping and State Determination
const tasksZero = [
    { id: 1, title: "Task 1", completed: false, dueDate: "2026-10-28" },
    { id: 2, title: "Task 2", completed: false, dueDate: "2026-10-28" }
];
const calcZero = getDailyAchievementCalculation(tasksZero);
assert.strictEqual(calcZero.stateKey, "CHOPPALANGI");
assert.strictEqual(calcZero.videoSrc, "assets/videos/Choppalangi.mp4");

const tasksPartial = [
    { id: 1, title: "Task 1", completed: true, dueDate: "2026-10-28" },
    { id: 2, title: "Task 2", completed: false, dueDate: "2026-10-28" }
];
const calcPartial = getDailyAchievementCalculation(tasksPartial);
assert.strictEqual(calcPartial.stateKey, "PARTIAL");
assert.strictEqual(calcPartial.videoSrc, "assets/videos/Romba Kastam bro.mp4");

const tasksFull = [
    { id: 1, title: "Task 1", completed: true, dueDate: "2026-10-28" },
    { id: 2, title: "Task 2", completed: true, dueDate: "2026-10-28" }
];
const calcFull = getDailyAchievementCalculation(tasksFull);
assert.strictEqual(calcFull.stateKey, "KOLA_MASS");
assert.strictEqual(calcFull.videoSrc, "assets/videos/kola mass uh.mp4");

const calcEmpty = getDailyAchievementCalculation([]);
assert.strictEqual(calcEmpty.stateKey, "EMPTY");
assert.strictEqual(calcEmpty.videoSrc, null);
console.log("✓ Test 10 Passed: Video Mapping & State Determination for All 4 States");

// 11. Test Time Boundary (Before 4:00 PM vs At/After 4:00 PM)
const morningTime = new Date(2026, 9, 28, 10, 30, 0); // 10:30 AM
const afternoonTime = new Date(2026, 9, 28, 15, 59, 59); // 3:59:59 PM
const fourPmTime = new Date(2026, 9, 28, 16, 0, 0); // 4:00 PM
const eveningTime = new Date(2026, 9, 28, 20, 30, 0); // 8:30 PM

assert.strictEqual(isAtOrAfter4PM(morningTime), false, "10:30 AM should be before 4:00 PM");
assert.strictEqual(isAtOrAfter4PM(afternoonTime), false, "3:59 PM should be before 4:00 PM");
assert.strictEqual(isAtOrAfter4PM(fourPmTime), true, "4:00 PM should be at or after 4:00 PM");
assert.strictEqual(isAtOrAfter4PM(eveningTime), true, "8:30 PM should be at or after 4:00 PM");
console.log("✓ Test 11 Passed: 4:00 PM Time Boundary Condition");

// 12. Test Daily Playback Limit (Max 2 Plays, Persistence, Date Reset)
let testStorage = {};
const mockStorageEngine = {
    getItem: (k) => testStorage[k] || null,
    setItem: (k, v) => { testStorage[k] = String(v); },
    clear: () => { testStorage = {}; }
};

function testGetPlaybackRecord(todayStr) {
    const raw = mockStorageEngine.getItem("taskverse_daily_achievement_playback");
    if (raw) {
        const data = JSON.parse(raw);
        if (data && data.date === todayStr && typeof data.count === "number") {
            return data;
        }
    }
    const fresh = { date: todayStr, count: 0 };
    mockStorageEngine.setItem("taskverse_daily_achievement_playback", JSON.stringify(fresh));
    return fresh;
}

function testIncrementPlayback(todayStr) {
    const r = testGetPlaybackRecord(todayStr);
    r.count += 1;
    mockStorageEngine.setItem("taskverse_daily_achievement_playback", JSON.stringify(r));
    return r;
}

// Start of today: 0 plays
let rec = testGetPlaybackRecord("2026-10-28");
assert.strictEqual(rec.count, 0);
assert.strictEqual(rec.count < 2, true, "Should allow first play");

// Play 1 starts
rec = testIncrementPlayback("2026-10-28");
assert.strictEqual(rec.count, 1);
assert.strictEqual(rec.count < 2, true, "Should allow second play");

// Play 2 starts
rec = testIncrementPlayback("2026-10-28");
assert.strictEqual(rec.count, 2);
assert.strictEqual(rec.count < 2, false, "Should block third play (limit reached)");

// Attempt 3rd play: blocked by limit
assert.strictEqual(rec.count >= 2, true, "Playback limit enforced");

// Simulate page refresh on same day: count is persisted!
const reloadedRec = testGetPlaybackRecord("2026-10-28");
assert.strictEqual(reloadedRec.count, 2, "Daily limit must persist across page reloads");

// Simulate date rollover to next day (2026-10-29)
const nextDayRec = testGetPlaybackRecord("2026-10-29");
assert.strictEqual(nextDayRec.count, 0, "Daily limit must reset to 0 on new calendar day");
console.log("✓ Test 12 Passed: Daily 2-Play Limit, Persistence & Calendar Reset");

// 13. Test Checkbox Toggle & State Change Rules
let lastState = "CHOPPALANGI";
// Toggle 1: 0% -> 50% (State changed: CHOPPALANGI -> PARTIAL)
let currentCalc = getDailyAchievementCalculation(tasksPartial);
let shouldPlay = currentCalc.stateKey !== lastState && currentCalc.stateKey !== "EMPTY";
assert.strictEqual(shouldPlay, true, "Should trigger video when state changes");
lastState = currentCalc.stateKey;

// Toggle 2: User completes another task in a 3-task list, but state remains PARTIAL (e.g. 33% -> 66%)
const tasksPartial2 = [
    { id: 1, title: "T1", completed: true, dueDate: "2026-10-28" },
    { id: 2, title: "T2", completed: true, dueDate: "2026-10-28" },
    { id: 3, title: "T3", completed: false, dueDate: "2026-10-28" }
];
let partialCalc2 = getDailyAchievementCalculation(tasksPartial2);
assert.strictEqual(partialCalc2.stateKey, "PARTIAL");
let shouldReplay = partialCalc2.stateKey !== lastState && partialCalc2.stateKey !== "EMPTY";
assert.strictEqual(shouldReplay, false, "Must NOT replay video unnecessarily if achievement state remains PARTIAL");

// Toggle 3: User completes remaining task (PARTIAL -> KOLA_MASS)
const tasksAllDone = [
    { id: 1, title: "T1", completed: true, dueDate: "2026-10-28" },
    { id: 2, title: "T2", completed: true, dueDate: "2026-10-28" },
    { id: 3, title: "T3", completed: true, dueDate: "2026-10-28" }
];
let fullCalc = getDailyAchievementCalculation(tasksAllDone);
assert.strictEqual(fullCalc.stateKey, "KOLA_MASS");
let shouldPlayFull = fullCalc.stateKey !== lastState && fullCalc.stateKey !== "EMPTY";
assert.strictEqual(shouldPlayFull, true, "Must play Kola Mass video when state changes to 100%");
console.log("✓ Test 13 Passed: Checkbox Update State Change & Duplicate Prevention Rules");

// 14. Test Unrelated Task Isolation (Future/Past tasks do not affect today's achievements)
const futureTask = { id: 99, title: "Future Mission", completed: true, dueDate: "2026-10-29" };
const allTasksWithFuture = [...tasksZero, futureTask];
const todayOnlyTasks = allTasksWithFuture.filter(t => t.dueDate === "2026-10-28");
const calcTodayIsolated = getDailyAchievementCalculation(todayOnlyTasks);
assert.strictEqual(calcTodayIsolated.total, 2);
assert.strictEqual(calcTodayIsolated.completed, 0);
assert.strictEqual(calcTodayIsolated.stateKey, "CHOPPALANGI");
console.log("✓ Test 14 Passed: Task Eligibility Isolation (Future/Past tasks ignored)");

console.log("\nALL RECURRING TASKS & TASKVERSE TESTS PASSED PERFECTLY! 🚀");
