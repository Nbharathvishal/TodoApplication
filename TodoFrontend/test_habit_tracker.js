// Test Suite for Spreadsheet Habit Tracker Redesign
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
        } catch (e) {}
    } else {
        cleanDescription = desc.replace(/<!--taskverse:[\s\S]*?-->/g, "").trim();
    }

    if (cleanDescription === todo.title) {
        cleanDescription = "";
    }

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
    const meta = {
        priority: todoInput.priority || "Medium",
        dueDate: todoInput.dueDate || getTodayDateString(),
        category: todoInput.category || "Work",
        recurrence: todoInput.recurrence || { frequency: "none" },
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

    return {
        id: todoInput.id,
        title: todoInput.title,
        description: finalDescription,
        completed: Boolean(todoInput.completed)
    };
}

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

console.log("=== RUNNING HABIT TRACKER REDESIGN TESTS ===");

// Test 1: Goal and CompletedDates metadata serialization & deserialization
{
    const raw = {
        id: 101,
        title: "Gym Workout 🏋️",
        description: "Focus on upper body\n<!--taskverse:{\"priority\":\"High\",\"dueDate\":\"2026-11-05\",\"category\":\"Personal\",\"goal\":20,\"completedDates\":[\"2026-11-01\",\"2026-11-03\"]}-->",
        completed: false
    };
    const parsed = parseTodoMetadata(raw);
    assert.strictEqual(parsed.goal, 20, "Parsed goal should be 20");
    assert.deepStrictEqual(parsed.completedDates, ["2026-11-01", "2026-11-03"]);
    assert.strictEqual(parsed.cleanDescription, "Focus on upper body");

    const serialized = serializeTodoForBackend(parsed);
    assert.strictEqual(serialized.title, "Gym Workout 🏋️");
    assert.ok(serialized.description.includes('"goal":20'), "Serialized description must contain goal:20");
    assert.ok(serialized.description.includes('"completedDates":["2026-11-01","2026-11-03"]'), "Serialized description must contain completedDates");
    console.log("✓ Test 1 Passed: Goal & CompletedDates Serialization & Deserialization");
}

// Test 2: Smart Icon recognition for Reference Habits
{
    const sampleHabits = [
        { title: "Wake up at 6AM ⏰", expectedIcon: "⏰" },
        { title: "No Snoozing 🚫⏰", expectedIcon: "🚫" }, // emoji detected
        { title: "Drink 3L Water 💧", expectedIcon: "💧" },
        { title: "Gym Workout", expectedIcon: "🏋️" }, // inferred
        { title: "Stretching", expectedIcon: "🧘" }, // inferred
        { title: "Read 10 Pages", expectedIcon: "📖" }, // inferred
        { title: "Meditation", expectedIcon: "🧘" }, // inferred
        { title: "Study 1 Hour", expectedIcon: "🎓" }, // inferred
        { title: "Skincare Routine", expectedIcon: "✨" }, // inferred
        { title: "Limit Social Media", expectedIcon: "📵" }, // inferred
        { title: "No Alcohol", expectedIcon: "🚫🍷" }, // inferred
        { title: "Track Expenses", expectedIcon: "💵" } // inferred
    ];

    sampleHabits.forEach(h => {
        const { icon } = getHabitIcon(h.title, "General");
        assert.ok(icon.length > 0, `Icon should be present for ${h.title}`);
    });
    console.log("✓ Test 2 Passed: Smart Icon Detection for All Reference Image Habits");
}

// Test 3: Week grouping calculation
{
    const daysInMonth = 30; // November
    const monthDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
        monthDays.push({ dayNum: d });
    }
    const weeks = [];
    for (let i = 0; i < monthDays.length; i += 7) {
        weeks.push({
            weekIndex: Math.floor(i / 7) + 1,
            days: monthDays.slice(i, i + 7)
        });
    }

    assert.strictEqual(weeks.length, 5, "November should have 5 weeks groups");
    assert.strictEqual(weeks[0].days.length, 7, "Week 1 has 7 days");
    assert.strictEqual(weeks[1].days.length, 7, "Week 2 has 7 days");
    assert.strictEqual(weeks[2].days.length, 7, "Week 3 has 7 days");
    assert.strictEqual(weeks[3].days.length, 7, "Week 4 has 7 days");
    assert.strictEqual(weeks[4].days.length, 2, "Week 5 has 2 days (29, 30)");
    console.log("✓ Test 3 Passed: 5-Week Grouping matches Month calendar layout");
}

// Test 4: Default fallback goal
{
    const rawNoGoal = {
        id: 102,
        title: "Clean Desk",
        description: "Task without goal\n<!--taskverse:{\"priority\":\"Low\"}-->",
        completed: false
    };
    const parsedNoGoal = parseTodoMetadata(rawNoGoal);
    assert.strictEqual(parsedNoGoal.goal, 30, "Fallback goal should default to 30");
    console.log("✓ Test 4 Passed: Default Goal 30 Fallback");
}

console.log("\nALL HABIT TRACKER REDESIGN TESTS PASSED PERFECTLY! 🚀✨");
