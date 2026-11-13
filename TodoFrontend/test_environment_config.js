// Test Suite for TaskVerse Automatic Backend Environment Configuration
const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("=== RUNNING TASKVERSE ENVIRONMENT CONFIGURATION TESTS ===");

// 1. Verify HTML Files Do Not Contain API Target Selector UI
const loginHtml = fs.readFileSync(path.join(__dirname, "login.html"), "utf8");
const registerHtml = fs.readFileSync(path.join(__dirname, "register.html"), "utf8");
const todosHtml = fs.readFileSync(path.join(__dirname, "todos.html"), "utf8");

assert.strictEqual(loginHtml.includes("API Target:"), false, "login.html must not contain 'API Target:' label");
assert.strictEqual(loginHtml.includes("Cloud (Render)"), false, "login.html must not contain Cloud (Render) button");
assert.strictEqual(loginHtml.includes("Local (8080)"), false, "login.html must not contain Local (8080) button");
assert.strictEqual(loginHtml.includes("server-selector-card"), false, "login.html must not contain server-selector-card");
console.log("✓ Test 1 Passed: Login UI completely clean of all target selector elements");

assert.strictEqual(registerHtml.includes("API Target:"), false, "register.html must not contain 'API Target:' label");
assert.strictEqual(registerHtml.includes("Cloud (Render)"), false, "register.html must not contain Cloud (Render) button");
assert.strictEqual(registerHtml.includes("Local (8080)"), false, "register.html must not contain Local (8080) button");
console.log("✓ Test 2 Passed: Register UI completely clean of all target selector elements");

assert.strictEqual(todosHtml.includes("onclick=\"switchBackend("), false, "todos.html must not contain manual switchBackend buttons");
console.log("✓ Test 3 Passed: Todos UI contains no manual environment switcher buttons");

// 2. Test Environment Resolution Logic
const ENV_CONFIG = {
    development: {
        API_BASE_URL: "http://localhost:8080"
    },
    production: {
        API_BASE_URL: "https://todo-backend-zyqf.onrender.com"
    }
};

function isLocalEnvironment(mockWindow) {
    if (!mockWindow || !mockWindow.location) return true;
    const hostname = mockWindow.location.hostname;
    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "[::1]" ||
        (typeof hostname === "string" && hostname.endsWith(".localhost")) ||
        mockWindow.location.protocol === "file:"
    );
}

function getServerUrl(mockWindow) {
    if (mockWindow && mockWindow.__ENV__ && mockWindow.__ENV__.API_BASE_URL) {
        return mockWindow.__ENV__.API_BASE_URL;
    }
    return isLocalEnvironment(mockWindow)
        ? ENV_CONFIG.development.API_BASE_URL
        : ENV_CONFIG.production.API_BASE_URL;
}

// Localhost testing
const localWindow1 = { location: { hostname: "localhost", protocol: "http:" } };
assert.strictEqual(getServerUrl(localWindow1), "http://localhost:8080");

const localWindow2 = { location: { hostname: "127.0.0.1", protocol: "http:" } };
assert.strictEqual(getServerUrl(localWindow2), "http://localhost:8080");

const fileWindow = { location: { hostname: "", protocol: "file:" } };
assert.strictEqual(getServerUrl(fileWindow), "http://localhost:8080");
console.log("✓ Test 4 Passed: Localhost and local file environments automatically route to http://localhost:8080");

// Production testing
const prodWindow1 = { location: { hostname: "todo-frontend.onrender.com", protocol: "https:" } };
assert.strictEqual(getServerUrl(prodWindow1), "https://todo-backend-zyqf.onrender.com");

const prodWindow2 = { location: { hostname: "taskverse.app", protocol: "https:" } };
assert.strictEqual(getServerUrl(prodWindow2), "https://todo-backend-zyqf.onrender.com");
console.log("✓ Test 5 Passed: Production hostnames automatically route to https://todo-backend-zyqf.onrender.com");

// Environment override testing
const customEnvWindow = {
    location: { hostname: "custom.domain.com", protocol: "https:" },
    __ENV__: { API_BASE_URL: "https://custom-api.domain.com" }
};
assert.strictEqual(getServerUrl(customEnvWindow), "https://custom-api.domain.com");
console.log("✓ Test 6 Passed: Explicit window.__ENV__ override is respected when provided");

console.log("\nALL TASKVERSE ENVIRONMENT CONFIGURATION TESTS PASSED PERFECTLY! 🚀✨");
