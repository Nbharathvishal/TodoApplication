// TaskVerse — Centralized Environment Configuration
window.__ENV__ = window.__ENV__ || (function () {
    const isLocal = typeof window !== "undefined" && window.location && (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "0.0.0.0" ||
        window.location.hostname === "[::1]" ||
        window.location.hostname.endsWith(".localhost") ||
        window.location.protocol === "file:"
    );

    return {
        ENVIRONMENT: isLocal ? "development" : "production",
        API_BASE_URL: isLocal ? "http://localhost:8080" : "https://todo-backend-zyqf.onrender.com"
    };
})();
