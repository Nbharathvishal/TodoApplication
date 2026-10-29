// DOM Simulation Test for Achievement Video System
const assert = require("assert");

// Setup minimal browser-like globals
global.window = {
    __achievementTimeOverride: null,
    matchMedia: (query) => ({ matches: false })
};

const storage = {};
global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = String(value); },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

// Mock DOM elements
function createElement(tag, id = "") {
    const listeners = {};
    return {
        tagName: tag.toUpperCase(),
        id,
        className: "",
        classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
        },
        style: {},
        textContent: "",
        src: "",
        getAttribute(attr) { return this[attr] || ""; },
        setAttribute(attr, val) { this[attr] = val; },
        addEventListener(event, fn, opts) {
            listeners[event] = listeners[event] || [];
            listeners[event].push(fn);
        },
        removeEventListener(event, fn) {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter(f => f !== fn);
            }
        },
        dispatchEvent(event) {
            if (listeners[event]) {
                listeners[event].forEach(fn => fn());
            }
        },
        load() {},
        pause() {},
        play() {
            // Simulate video play
            return new Promise((resolve, reject) => {
                if (this._shouldBlockAutoplay) {
                    reject(new Error("Autoplay blocked"));
                } else {
                    resolve();
                    // trigger playing event
                    setTimeout(() => {
                        this.dispatchEvent("playing");
                    }, 5);
                }
            });
        }
    };
}

const domElements = {
    "achievement-card": createElement("div", "achievement-card"),
    "achievement-badge": createElement("div", "achievement-badge"),
    "achievement-badge-text": createElement("span", "achievement-badge-text"),
    "achievement-icon": createElement("span", "achievement-icon"),
    "achievement-title": createElement("h3", "achievement-title"),
    "achievement-sub": createElement("p", "achievement-sub"),
    "achievement-meter-fill": createElement("div", "achievement-meter-fill"),
    "achievement-ratio": createElement("span", "achievement-ratio"),
    "achievement-date": createElement("div", "achievement-date"),
    "achievement-quote-card": createElement("div", "achievement-quote-card"),
    "achievement-quote-text": createElement("blockquote", "achievement-quote-text"),
    "achievement-limit-notice": createElement("div", "achievement-limit-notice"),
    "achievement-limit-notice-text": createElement("span", "achievement-limit-notice-text"),
    "btn-achievement-play": createElement("button", "btn-achievement-play"),
    "btn-achievement-play-label": createElement("span", "btn-achievement-play-label"),
    "achievement-video-wrap": createElement("div", "achievement-video-wrap"),
    "achievement-video": createElement("video", "achievement-video"),
    "achievement-video-source": createElement("source", "achievement-video-source"),
    "video-autoplay-fallback": createElement("div", "video-autoplay-fallback"),
    "btn-video-fallback-play": createElement("button", "btn-video-fallback-play"),
    "btn-close-video": createElement("button", "btn-close-video")
};

global.document = {
    getElementById: (id) => domElements[id] || null
};

// Global state required by script.js
global.state = {
    todos: [],
    hasCelebratedKolaMassToday: false
};

global.getTodayDateString = function () {
    return "2026-10-28";
};

global.formatDateDisplay = function (d) {
    return "October 28, 2026";
};

global.triggerConfetti = function () {};
global.playAchievementChime = function () {};
global.showToast = function () {};

// Extract functions to test directly matching script.js
const ACHIEVEMENT_VIDEO_MAP = {
    CHOPPALANGI: "assets/videos/Choppalangi.mp4",
    PARTIAL: "assets/videos/Romba Kastam bro.mp4",
    KOLA_MASS: "assets/videos/kola mass uh.mp4"
};
const ACHIEVEMENT_STORAGE_KEY = "taskverse_daily_achievement_playback";
const MAX_DAILY_VIDEO_STARTS = 2;

let achievementVideoManager = {
    isInitialized: false,
    lastAchievementState: null,
    isPlaying: false,
    currentVideoSrc: null,
    hasCountedCurrentPlayback: false,
    pendingPlayState: null
};

function getAchievementCurrentTime() {
    if (global.window.__achievementTimeOverride instanceof Date) {
        return global.window.__achievementTimeOverride;
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
    const todayStr = global.getTodayDateString();
    try {
        const raw = global.localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data && data.date === todayStr && typeof data.count === "number") {
                return data;
            }
        }
    } catch (e) {}
    const fresh = { date: todayStr, count: 0 };
    saveDailyPlaybackRecord(fresh);
    return fresh;
}

function saveDailyPlaybackRecord(record) {
    try {
        global.localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(record));
    } catch (e) {}
}

function hasReachedDailyPlaybackLimit() {
    const record = getDailyPlaybackRecord();
    return record.count >= MAX_DAILY_VIDEO_STARTS;
}

function incrementDailyPlaybackCount() {
    const record = getDailyPlaybackRecord();
    record.count += 1;
    saveDailyPlaybackRecord(record);
    updatePlaybackLimitUI();
}

function updatePlaybackLimitUI() {
    const limitNotice = global.document.getElementById("achievement-limit-notice");
    const playBtn = global.document.getElementById("btn-achievement-play");
    const reached = hasReachedDailyPlaybackLimit();

    if (limitNotice) {
        if (reached) {
            limitNotice.style.display = "inline-flex";
            const noticeText = global.document.getElementById("achievement-limit-notice-text");
            if (noticeText) {
                noticeText.textContent = `Daily video limit reached (${MAX_DAILY_VIDEO_STARTS}/${MAX_DAILY_VIDEO_STARTS} plays used today). Keep executing!`;
            }
            if (playBtn) playBtn.style.display = "none";
        } else {
            limitNotice.style.display = "none";
        }
    }
}

function showQuoteCard() {
    const videoWrap = global.document.getElementById("achievement-video-wrap");
    const quoteCard = global.document.getElementById("achievement-quote-card");
    const video = global.document.getElementById("achievement-video");
    const playBtn = global.document.getElementById("btn-achievement-play");
    const fallbackOverlay = global.document.getElementById("video-autoplay-fallback");

    if (video) {
        try { video.pause(); } catch (e) {}
    }

    if (fallbackOverlay) fallbackOverlay.style.display = "none";
    if (videoWrap) videoWrap.style.display = "none";
    if (quoteCard) quoteCard.style.display = "flex";
    if (playBtn) playBtn.style.display = "none";

    achievementVideoManager.isPlaying = false;
    updatePlaybackLimitUI();
}

function showQuoteCardWithPlayOption(stateKey, videoSrc) {
    showQuoteCard();
    const playBtn = global.document.getElementById("btn-achievement-play");
    const playLabel = global.document.getElementById("btn-achievement-play-label");
    const reached = hasReachedDailyPlaybackLimit();

    if (playBtn && !reached && videoSrc) {
        playBtn.style.display = "inline-flex";
        if (playLabel) {
            playLabel.textContent = "Play Achievement Video";
        }
        achievementVideoManager.pendingPlayState = { stateKey, videoSrc };
    }
}

function playAchievementVideo(stateKey, videoSrc) {
    if (!videoSrc) {
        showQuoteCard();
        return;
    }

    if (hasReachedDailyPlaybackLimit()) {
        showQuoteCard();
        return;
    }

    const videoWrap = global.document.getElementById("achievement-video-wrap");
    const quoteCard = global.document.getElementById("achievement-quote-card");
    const video = global.document.getElementById("achievement-video");
    const fallbackOverlay = global.document.getElementById("video-autoplay-fallback");

    if (!video || !videoWrap || !quoteCard) return;

    try { video.pause(); } catch (e) {}

    achievementVideoManager.hasCountedCurrentPlayback = false;
    achievementVideoManager.currentVideoSrc = videoSrc;
    achievementVideoManager.lastAchievementState = stateKey;
    achievementVideoManager.pendingPlayState = { stateKey, videoSrc };
    achievementVideoManager.isPlaying = true;

    quoteCard.style.display = "none";
    videoWrap.style.display = "flex";
    if (fallbackOverlay) fallbackOverlay.style.display = "none";

    video.autoplay = true;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.controls = false;
    video.playsInline = true;

    const encodedSrc = encodeURI(videoSrc);
    const currentSrcAttr = video.getAttribute("src") || "";
    if (currentSrcAttr !== encodedSrc && currentSrcAttr !== videoSrc) {
        video.src = encodedSrc;
        video.load();
    } else {
        video.currentTime = 0;
    }

    const onPlayingHandler = function () {
        video.removeEventListener("playing", onPlayingHandler);
        if (fallbackOverlay) fallbackOverlay.style.display = "none";
        if (!achievementVideoManager.hasCountedCurrentPlayback) {
            achievementVideoManager.hasCountedCurrentPlayback = true;
            incrementDailyPlaybackCount();
        }
    };
    video.addEventListener("playing", onPlayingHandler);

    const onEndedHandler = function () {
        if (achievementVideoManager.isPlaying) {
            video.currentTime = 0;
            video.play().catch(() => {});
        } else {
            showQuoteCard();
        }
    };
    video.addEventListener("ended", onEndedHandler);

    const onErrorHandler = function () {
        achievementVideoManager.isPlaying = false;
        showQuoteCard();
    };
    video.addEventListener("error", onErrorHandler);

    const promise = video.play();
    if (promise && typeof promise.then === "function") {
        promise.then(() => {
            achievementVideoManager.isPlaying = true;
            if (fallbackOverlay) fallbackOverlay.style.display = "none";
        }).catch(error => {
            if (fallbackOverlay) fallbackOverlay.style.display = "flex";
        });
    }
}

function handleAchievementVideoSync(calc) {
    updatePlaybackLimitUI();

    if (!achievementVideoManager.isInitialized) {
        achievementVideoManager.isInitialized = true;
        achievementVideoManager.lastAchievementState = calc.stateKey;

        if (isAtOrAfter4PM()) {
            if (calc.stateKey !== "EMPTY") {
                if (!hasReachedDailyPlaybackLimit()) {
                    playAchievementVideo(calc.stateKey, calc.videoSrc);
                } else {
                    showQuoteCard();
                }
            } else {
                showQuoteCard();
            }
        } else {
            showQuoteCard();
        }
        return;
    }

    if (!achievementVideoManager.isPlaying) {
        const videoWrap = global.document.getElementById("achievement-video-wrap");
        if (!videoWrap || videoWrap.style.display !== "flex") {
            showQuoteCard();
        }
    }
}

function onTaskCheckboxUpdated(updatedTodo) {
    const todayStr = global.getTodayDateString();

    const idx = global.state.todos.findIndex(t => t.id === updatedTodo.id);
    if (idx !== -1) {
        global.state.todos[idx] = { ...global.state.todos[idx], completed: updatedTodo.completed };
    }

    const todayTasks = global.state.todos.filter(t => t.dueDate === todayStr);
    const newCalc = getDailyAchievementCalculation(todayTasks);

    const oldState = achievementVideoManager.lastAchievementState;
    const newState = newCalc.stateKey;

    if (newState === "EMPTY") {
        achievementVideoManager.lastAchievementState = newState;
        return;
    }

    if (newState !== oldState) {
        achievementVideoManager.lastAchievementState = newState;

        if (!hasReachedDailyPlaybackLimit()) {
            playAchievementVideo(newState, newCalc.videoSrc);
        } else {
            showQuoteCard();
            updatePlaybackLimitUI();
        }
    }
}

async function runTests() {
    console.log("=== INTEGRATION TEST: ACHIEVEMENT VIDEO LIFECYCLE ===");

    // Test 1: Before 4:00 PM, quote card appears initially and NO video autoplays
    global.localStorage.clear();
    global.window.__achievementTimeOverride = new Date(2026, 9, 28, 11, 0, 0); // 11:00 AM
    achievementVideoManager.isInitialized = false;
    achievementVideoManager.isPlaying = false;
    achievementVideoManager.lastAchievementState = null;

    global.state.todos = [
        { id: 1, title: "Morning Standup", dueDate: "2026-10-28", completed: false },
        { id: 2, title: "Code Review", dueDate: "2026-10-28", completed: false }
    ];

    const morningCalc = getDailyAchievementCalculation(global.state.todos);
    handleAchievementVideoSync(morningCalc);

    assert.strictEqual(achievementVideoManager.isInitialized, true);
    assert.strictEqual(achievementVideoManager.isPlaying, false);
    assert.strictEqual(domElements["achievement-quote-card"].style.display, "flex");
    assert.strictEqual(domElements["achievement-video-wrap"].style.display, "none");
    console.log("✓ Verification 1: Before 4:00 PM initially displays quote card, no autoplay");

    // Test 2: Before 4:00 PM, user checks a task -> state changes from CHOPPALANGI to PARTIAL -> Video plays!
    onTaskCheckboxUpdated({ id: 1, dueDate: "2026-10-28", completed: true });
    assert.strictEqual(achievementVideoManager.isPlaying, true);
    assert.strictEqual(domElements["achievement-video-wrap"].style.display, "flex");
    assert.strictEqual(domElements["achievement-quote-card"].style.display, "none");
    assert.strictEqual(achievementVideoManager.currentVideoSrc, "assets/videos/Romba Kastam bro.mp4");
    
    // Simulate playing event start
    domElements["achievement-video"].dispatchEvent("playing");
    assert.strictEqual(getDailyPlaybackRecord().count, 1, "Should count 1 playback start");

    // Simulate video ended -> continuous looping keeps playing without counting new play
    domElements["achievement-video"].dispatchEvent("ended");
    assert.strictEqual(achievementVideoManager.isPlaying, true, "Video should keep looping continuously like a GIF");
    assert.strictEqual(getDailyPlaybackRecord().count, 1, "Loop iteration must not increment daily limit");
    // User closes video or transitions
    showQuoteCard();
    assert.strictEqual(achievementVideoManager.isPlaying, false);
    assert.strictEqual(domElements["achievement-quote-card"].style.display, "flex");
    console.log("✓ Verification 2: Checkbox update before 4:00 PM plays video and loops continuously");

    // Test 3: Checkbox update where state remains unchanged does not replay video
    // (e.g. Add 3rd task uncompleted, then complete it? Current state is PARTIAL (1/2))
    global.state.todos.push({ id: 3, title: "Docs", dueDate: "2026-10-28", completed: false });
    // Now 1 completed out of 3 -> PARTIAL
    // User uncompletes and re-completes without state changing:
    // If state is already PARTIAL and newState is PARTIAL:
    onTaskCheckboxUpdated({ id: 3, dueDate: "2026-10-28", completed: true });
    // Now 2 completed out of 3 -> STILL PARTIAL!
    assert.strictEqual(achievementVideoManager.isPlaying, false, "Should not replay video when state remains PARTIAL");
    console.log("✓ Verification 3: Unchanged state does not replay video");

    // Test 4: User completes all tasks -> state changes to KOLA_MASS -> plays kola mass uh.mp4!
    onTaskCheckboxUpdated({ id: 2, dueDate: "2026-10-28", completed: true });
    // Now 3/3 completed -> KOLA_MASS
    assert.strictEqual(achievementVideoManager.isPlaying, true);
    assert.strictEqual(achievementVideoManager.currentVideoSrc, "assets/videos/kola mass uh.mp4");
    domElements["achievement-video"].dispatchEvent("playing");
    assert.strictEqual(getDailyPlaybackRecord().count, 2, "Should count 2nd playback start");
    domElements["achievement-video"].dispatchEvent("ended");
    console.log("✓ Verification 4: Completing all tasks plays KOLA_MASS video");

    // Test 5: Daily 2-play limit reached -> subsequent state changes do NOT play video
    onTaskCheckboxUpdated({ id: 2, dueDate: "2026-10-28", completed: false });
    // Now 2/3 -> PARTIAL
    assert.strictEqual(hasReachedDailyPlaybackLimit(), true);
    assert.strictEqual(achievementVideoManager.isPlaying, false, "Must block playback when daily limit is reached");
    assert.strictEqual(domElements["achievement-limit-notice"].style.display, "inline-flex");
    assert.strictEqual(domElements["achievement-quote-card"].style.display, "flex");
    console.log("✓ Verification 5: Daily 2-play limit enforced across state changes with friendly message");

    // Test 6: At or after 4:00 PM (Condition B) with 0 completed tasks
    global.localStorage.clear();
    global.window.__achievementTimeOverride = new Date(2026, 9, 28, 17, 30, 0); // 5:30 PM
    achievementVideoManager.isInitialized = false;
    achievementVideoManager.isPlaying = false;
    achievementVideoManager.lastAchievementState = null;

    global.state.todos = [
        { id: 10, title: "Pending Task 1", dueDate: "2026-10-28", completed: false },
        { id: 11, title: "Pending Task 2", dueDate: "2026-10-28", completed: false }
    ];
    const eveningCalcZero = getDailyAchievementCalculation(global.state.todos);
    handleAchievementVideoSync(eveningCalcZero);

    assert.strictEqual(achievementVideoManager.isPlaying, true);
    assert.strictEqual(achievementVideoManager.currentVideoSrc, "assets/videos/Choppalangi.mp4");
    console.log("✓ Verification 6: At/after 4:00 PM with 0% completed autoplays CHOPPALANGI video on init");

    // Test 7: At or after 4:00 PM with partial completion
    global.localStorage.clear();
    achievementVideoManager.isInitialized = false;
    achievementVideoManager.isPlaying = false;
    achievementVideoManager.lastAchievementState = null;
    global.state.todos[0].completed = true;
    const eveningCalcPartial = getDailyAchievementCalculation(global.state.todos);
    handleAchievementVideoSync(eveningCalcPartial);

    assert.strictEqual(achievementVideoManager.isPlaying, true);
    assert.strictEqual(achievementVideoManager.currentVideoSrc, "assets/videos/Romba Kastam bro.mp4");
    console.log("✓ Verification 7: At/after 4:00 PM with partial completion autoplays Romba Kastam video on init");

    // Test 8: At or after 4:00 PM with 100% completion
    global.localStorage.clear();
    achievementVideoManager.isInitialized = false;
    achievementVideoManager.isPlaying = false;
    achievementVideoManager.lastAchievementState = null;
    global.state.todos[1].completed = true;
    const eveningCalcFull = getDailyAchievementCalculation(global.state.todos);
    handleAchievementVideoSync(eveningCalcFull);

    assert.strictEqual(achievementVideoManager.isPlaying, true);
    assert.strictEqual(achievementVideoManager.currentVideoSrc, "assets/videos/kola mass uh.mp4");
    console.log("✓ Verification 8: At/after 4:00 PM with 100% completion autoplays SAAREY KOLA MASS UH video on init");
    // Allow any pending playing timer to flush
    await new Promise(r => setTimeout(r, 15));

    // Test 9: Autoplay blocked fallback -> Keeps video wrap visible with accessible fallback play button
    global.localStorage.clear();
    achievementVideoManager.isInitialized = false;
    achievementVideoManager.isPlaying = false;
    achievementVideoManager.lastAchievementState = null;
    domElements["achievement-video"]._shouldBlockAutoplay = true;

    handleAchievementVideoSync(eveningCalcFull);
    // Give Promise rejection cycle a moment to resolve
    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(achievementVideoManager.isPlaying, true);
    assert.strictEqual(domElements["achievement-video-wrap"].style.display, "flex");
    assert.strictEqual(domElements["video-autoplay-fallback"].style.display, "flex");
    console.log("✓ Verification 9: Blocked autoplay keeps video wrap visible with Click to Play Video overlay");

    // Test 10: Zero eligible tasks -> Shows neutral empty state, NO video
    global.localStorage.clear();
    achievementVideoManager.isInitialized = false;
    achievementVideoManager.isPlaying = false;
    achievementVideoManager.lastAchievementState = null;
    domElements["achievement-video"]._shouldBlockAutoplay = false;

    const emptyCalc = getDailyAchievementCalculation([]);
    handleAchievementVideoSync(emptyCalc);

    assert.strictEqual(achievementVideoManager.isPlaying, false);
    assert.strictEqual(domElements["achievement-quote-card"].style.display, "flex");
    assert.strictEqual(domElements["achievement-video-wrap"].style.display, "none");
    console.log("✓ Verification 10: Zero eligible tasks shows neutral state without video playback");

    console.log("\nALL 10 ACHIEVEMENT VIDEO LIFECYCLE TESTS PASSED FLAWLESSLY! 🎬🔥");
}

runTests();
