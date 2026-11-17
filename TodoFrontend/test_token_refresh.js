/**
 * test_token_refresh.js
 * Comprehensive automated verification for Token Refresh, Session Persistence,
 * and 401/403/404 handling during task/habit completion.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("=== STARTING TOKEN REFRESH & SESSION PERSISTENCE AUDIT ===");

// 1. Load script.js in a mocked browser context
const scriptPath = path.join(__dirname, "script.js");
const scriptContent = fs.readFileSync(scriptPath, "utf-8");

// Mock localStorage
const mockStorage = {};
const localStorage = {
    getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Mock window and document
let redirectedUrl = null;
const window = {
    location: {
        get href() { return redirectedUrl || "todos.html"; },
        set href(val) { redirectedUrl = val; },
        hostname: "localhost",
        protocol: "http:"
    },
    localStorage,
    addEventListener: () => {},
    removeEventListener: () => {}
};

const document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
};

const toasts = [];
function showToast(msg, type) {
    toasts.push({ msg, type });
}

// Helper to create a fake JWT with given expiration in seconds from now
function createMockJwt(expSecondsFromNow, type = "access") {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
    const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
    const payload = Buffer.from(JSON.stringify({ sub: "test@example.com", exp, type })).toString("base64");
    return `${header}.${payload}.mocksignature`;
}

// Evaluate script.js in controlled sandbox
const vm = require("vm");
const sandbox = {
    window,
    document,
    localStorage,
    showToast,
    console,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    atob: (str) => Buffer.from(str, "base64").toString("utf-8"),
    btoa: (str) => Buffer.from(str, "utf-8").toString("base64"),
    fetch: null,
    AbortController: class {
        constructor() { this.signal = {}; }
        abort() {}
    }
};

vm.createContext(sandbox);
vm.runInContext(scriptContent, sandbox);

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
    testsTotal++;
    try {
        fn();
        console.log(`✓ [PASS] ${name}`);
        testsPassed++;
    } catch (e) {
        console.error(`✗ [FAIL] ${name}:`, e.message);
        throw e;
    }
}

async function runAsyncTest(name, fn) {
    testsTotal++;
    try {
        await fn();
        console.log(`✓ [PASS] ${name}`);
        testsPassed++;
    } catch (e) {
        console.error(`✗ [FAIL] ${name}:`, e.message);
        throw e;
    }
}

async function main() {
    // TEST 1: Token storage operations
    runTest("TEST 1: setTokens, getToken, getRefreshToken, clearAuthTokens", () => {
        sandbox.clearAuthTokens();
        assert.strictEqual(sandbox.getToken(), null);
        assert.strictEqual(sandbox.getRefreshToken(), null);

        sandbox.setTokens("access_token_123", "refresh_token_456");
        assert.strictEqual(sandbox.getToken(), "access_token_123");
        assert.strictEqual(sandbox.getRefreshToken(), "refresh_token_456");

        sandbox.clearAuthTokens();
        assert.strictEqual(sandbox.getToken(), null);
        assert.strictEqual(sandbox.getRefreshToken(), null);
    });

    // TEST 2: isTokenExpired logic
    runTest("TEST 2: isTokenExpired accurately evaluates JWT expiration timestamps", () => {
        const freshToken = createMockJwt(3600); // 1 hour in future
        assert.strictEqual(sandbox.isTokenExpired(freshToken), false);

        const expiredToken = createMockJwt(-10); // 10 seconds in past
        assert.strictEqual(sandbox.isTokenExpired(expiredToken), true);

        // Proactive expiration buffer check: token expiring in 10s is considered expired with 15s buffer
        const soonExpiring = createMockJwt(10);
        assert.strictEqual(sandbox.isTokenExpired(soonExpiring, 15), true);
        assert.strictEqual(sandbox.isTokenExpired(soonExpiring, 5), false);
    });

    // TEST 3: apiFetch transparently refreshes expired access token on 401
    await runAsyncTest("TEST 3: apiFetch transparently refreshes access token and retries request on 401", async () => {
        sandbox.setTokens(createMockJwt(-10), "valid_refresh_token_xyz");
        redirectedUrl = null;

        let refreshCalled = false;
        let originalRequestAttempts = 0;

        sandbox.fetch = async (url, opts) => {
            if (url.includes("/auth/refresh")) {
                refreshCalled = true;
                const newAccess = createMockJwt(3600);
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ token: newAccess, refreshToken: "new_refresh_token_abc" })
                };
            }

            if (url.includes("/api/todo")) {
                originalRequestAttempts++;
                const auth = opts.headers && opts.headers["Authorization"];
                // First call failed with 401 because old token was used
                if (originalRequestAttempts === 1) {
                    return { ok: false, status: 401, text: async () => "Unauthorized" };
                }
                // Second call retried with new token
                assert.ok(auth.startsWith("Bearer "), "Retried request must include Authorization header");
                return {
                    ok: true,
                    status: 200,
                    json: async () => [{ id: 1, title: "Test Mission", completed: true }]
                };
            }

            return { ok: true, status: 200, json: async () => ({}) };
        };

        const res = await sandbox.apiFetch("http://localhost:8080/api/todo", { method: "GET" });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(refreshCalled, true, "Refresh endpoint must have been called");
        assert.strictEqual(originalRequestAttempts, 2, "Original request must have been retried");
        assert.strictEqual(redirectedUrl, null, "User must NOT have been redirected to login");
    });

    // TEST 4: Concurrent 401 requests trigger only ONE refresh call
    await runAsyncTest("TEST 4: Concurrent requests deduplicate token refresh calls", async () => {
        const oldToken = "old_expired_access_token";
        const newToken = "new_refreshed_access_token";
        sandbox.setTokens(oldToken, "valid_refresh_token_xyz");
        redirectedUrl = null;

        let refreshCallCount = 0;

        sandbox.fetch = async (url, opts) => {
            if (url.includes("/auth/refresh")) {
                refreshCallCount++;
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ token: newToken, refreshToken: "refresh_2" })
                };
            }

            if (url.includes("/api/todo")) {
                const auth = opts.headers["Authorization"];
                // If it's the old token, return 401
                if (auth === `Bearer ${oldToken}`) {
                    return { ok: false, status: 401 };
                }
                return { ok: true, status: 200, json: async () => ({ ok: true }) };
            }
        };

        // Fire 4 requests concurrently
        const p1 = sandbox.apiFetch("http://localhost:8080/api/todo", { method: "GET" });
        const p2 = sandbox.apiFetch("http://localhost:8080/api/todo", { method: "GET" });
        const p3 = sandbox.apiFetch("http://localhost:8080/api/todo", { method: "GET" });
        const p4 = sandbox.apiFetch("http://localhost:8080/api/todo", { method: "GET" });

        await Promise.all([p1, p2, p3, p4]);

        assert.strictEqual(refreshCallCount, 1, "Only 1 refresh request must be sent for concurrent 401s");
        assert.strictEqual(redirectedUrl, null, "No login redirect should occur");
    });

    // TEST 5: HTTP 403 Forbidden does NOT log out the user
    await runAsyncTest("TEST 5: HTTP 403 Forbidden returns status without logging out", async () => {
        sandbox.setTokens(createMockJwt(3600), "valid_refresh");
        redirectedUrl = null;
        toasts.length = 0;

        sandbox.fetch = async (url, opts) => {
            return {
                ok: false,
                status: 403,
                text: async () => "Access denied"
            };
        };

        const res = await sandbox.apiFetch("http://localhost:8080/api/todo/99", { method: "DELETE" });
        assert.strictEqual(res.status, 403);
        assert.strictEqual(redirectedUrl, null, "User must NEVER be redirected on 403 Forbidden");
        assert.notStrictEqual(sandbox.getToken(), null, "Tokens must remain intact in storage on 403");
    });

    // TEST 6: Self-healing updateTodoStatus on 404 persists new ID without logout
    await runAsyncTest("TEST 6: updateTodoStatus self-heals 404 by recreating task and updating ID seamlessly", async () => {
        sandbox.setTokens(createMockJwt(3600), "valid_refresh");
        redirectedUrl = null;
        sandbox.state.todos = [
            { id: 999, title: "Stretching 🧘", completed: false, completedDates: [] }
        ];

        let putCalled = false;
        let postCalled = false;

        sandbox.fetch = async (url, opts) => {
            if (opts.method === "PUT") {
                putCalled = true;
                // Simulating database 404 (ID 999 not found for current user)
                return {
                    ok: false,
                    status: 404,
                    text: async () => "Todo Not Found"
                };
            }
            if (opts.method === "POST" && url.includes("/api/todo/create")) {
                postCalled = true;
                const body = JSON.parse(opts.body);
                assert.strictEqual(body.id, undefined, "Self-heal create payload must omit missing ID");
                return {
                    ok: true,
                    status: 201,
                    json: async () => ({
                        id: 1042, // Newly created database ID
                        title: body.title,
                        description: body.description,
                        completed: body.completed
                    })
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        };

        const targetTodo = sandbox.state.todos[0];
        targetTodo.completed = true;
        targetTodo.completedDates = ["2026-11-17"];

        const result = await sandbox.updateTodoStatus(targetTodo);

        assert.strictEqual(putCalled, true, "PUT /api/todo was attempted first");
        assert.strictEqual(postCalled, true, "POST /api/todo/create was called for self-healing");
        assert.strictEqual(sandbox.state.todos[0].id, 1042, "In-memory todo ID must update to newly created server ID 1042");
        assert.strictEqual(redirectedUrl, null, "User must NOT be redirected on self-healing 404/create");
    });

    // TEST 7: Only genuine refresh failure redirects to login
    await runAsyncTest("TEST 7: Only genuine token expiration without valid refresh token redirects to login", async () => {
        sandbox.setTokens(createMockJwt(-10), "expired_refresh_token");
        redirectedUrl = null;

        sandbox.fetch = async (url, opts) => {
            if (url.includes("/auth/refresh")) {
                return {
                    ok: false,
                    status: 401,
                    text: async () => "Invalid or expired refresh token"
                };
            }
            return { ok: false, status: 401 };
        };

        try {
            await sandbox.apiFetch("http://localhost:8080/api/todo", { method: "GET" });
        } catch (e) {
            // expected to throw
        }

        assert.strictEqual(redirectedUrl, "login.html", "Must redirect to login only when refresh fails");
        assert.strictEqual(sandbox.getToken(), null, "Tokens must be cleared on genuine auth failure");
    });

    console.log("============================================================");
    console.log(`TOKEN REFRESH & SESSION PERSISTENCE AUDIT: ${testsPassed}/${testsTotal} TESTS PASSED`);
    console.log("============================================================");
}

main().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
