# TaskVerse — Failure & Root Cause Analysis Report

This document records all confirmed defects, edge-case vulnerabilities, and architectural observations identified during the comprehensive 3-tier QA audit of TaskVerse.

---

## Issue DEF-01: Authentication Inconsistency on Existing User Accounts (Resolved)

- **Issue ID:** DEF-01
- **Module & Feature:** Authentication / Login & Registration Flow
- **Affected Tier:** Tier 2 (Backend) & Tier 1 (Frontend)
- **Exact Page / Component:** [login.html](file:///E:/Project/TodoApplication/TodoFrontend/login.html) & [register.html](file:///E:/Project/TodoApplication/TodoFrontend/register.html)
- **Source File & Line:** [AuthController.java:50-65](file:///E:/Project/TodoApplication/SpringLearning/src/main/java/Course/SpringLearning/Controller/AuthController.java#L50-L65), [UserRepository.java:8-11](file:///E:/Project/TodoApplication/SpringLearning/src/main/java/Course/SpringLearning/Repository/UserRepository.java#L8-L11)
- **API Endpoint:** `POST /auth/login` and `POST /auth/register`
- **Database Table / Model:** `user_table` / `Course.SpringLearning.Models.User`
- **Steps to Reproduce:**
  1. Have an existing registered user in PostgreSQL (e.g. `vishalbharath566@gmail.com`).
  2. Attempt to register that email on `/register.html` $\rightarrow$ application responds *"Email is Already Exist"*.
  3. Attempt to log in with that email and password on `/login.html` $\rightarrow$ application returned *"Invalid User"*.
- **Expected Result:**
  - Login should authenticate valid users successfully.
  - If password is wrong, show *"Incorrect email or password."*
  - If user is not found, show *"No account found with this email address. Please register."*
- **Actual Result (Before Fix):**
  - Registration blocked with "Email is Already Exist", but login failed with "Invalid User", confusing the user.
- **Confirmed Root Cause:**
  1. *Legacy Password Seed Incompatibility:* Accounts created via legacy scripts or direct SQL inserts had unhashed or plaintext passwords. Spring Security's `BCryptPasswordEncoder.matches` expects `$2a$` prefix and returned `false` on plaintext comparison.
  2. *Case-Sensitivity:* `userRepository.findByEmail` performed a case-sensitive query in PostgreSQL.
  3. *Misleading Error Strings:* Returning `"Invalid User"` on password failure made users think their account was corrupt or missing.
- **Business Impact:** High — prevented valid users from accessing the application.
- **Severity:** HIGH
- **Recommended & Implemented Solution:**
  1. Added `findByEmailIgnoreCase` in `UserRepository`.
  2. Added centralized email normalization (`trim().toLowerCase(Locale.ROOT)`).
  3. Added seamless legacy password fallback: verifies plaintext and automatically upgrades the database record to standard BCrypt hash.
  4. Standardized user-friendly error messages.
- **Suggested Regression Test:** Run [AuthMismatchInvestigationTest.java](file:///E:/Project/TodoApplication/SpringLearning/src/test/java/Course/SpringLearning/AuthMismatchInvestigationTest.java) (`mvn test -Dtest=AuthMismatchInvestigationTest`). All 9 test cases must pass.

---

## Issue OBS-01: Hibernate `ddl-auto=update` Column Widening Limitation for Large Habit History

- **Issue ID:** OBS-01
- **Module & Feature:** Habit Tracking History & Metadata Storage
- **Affected Tier:** Tier 3 (Database)
- **Exact Page / Component:** Spreadsheet Habit Tracker (`#habit-tracker-table`)
- **Source File & Line:** [Todo.java:34-36](file:///E:/Project/TodoApplication/SpringLearning/src/main/java/Course/SpringLearning/Models/Todo.java#L34-L36)
- **API Endpoint:** `POST /api/todo/create` and `PUT /api/todo`
- **Database Table / Model:** `todo` / `Course.SpringLearning.Models.Todo`
- **Steps to Reproduce:**
  1. Connect backend to an existing PostgreSQL database where the `todo` table was generated before `@Column(columnDefinition = "TEXT")` was introduced.
  2. In PostgreSQL, check column data type: `SELECT data_type FROM information_schema.columns WHERE table_name = 'todo' AND column_name = 'description';`.
  3. If data type is `character varying(255)`, mark a habit completed for 30+ dates.
  4. The serialized JSON metadata in `description` will exceed 255 characters (e.g. `<!--taskverse:{"completedDates":["2026-11-01", ...]}-->`).
  5. PostgreSQL throws `PSQLException: value too long for type character varying(255)`.
- **Expected Result:**
  - `description` column should allow unbounded text storage for rich habit tracking history.
- **Actual Result:**
  - Hibernate's `ddl-auto=update` creates new tables with `TEXT`, but will not alter an existing `character varying(255)` column in PostgreSQL automatically.
- **Confirmed Root Cause:** PostgreSQL dialect in Hibernate skips automatic narrowing/widening column type alterations on existing columns to prevent potential data lockouts.
- **Business Impact:** Medium — only affects existing legacy databases where the column was created as `VARCHAR(255)`.
- **Severity:** MEDIUM
- **Recommended Solution:**
  Execute a one-line SQL migration in PostgreSQL (safe, non-destructive, zero downtime):
  ```sql
  ALTER TABLE todo ALTER COLUMN description TYPE TEXT;
  ```
- **Suggested Regression Test:** Insert a habit with 60 completed dates in `completedDates` array and verify successful database persistence.

---

## Issue OBS-02: CORS Allowed Origin Wildcard Pattern with Credentials Enabled

- **Issue ID:** OBS-02
- **Module & Feature:** Cross-Origin Request Security
- **Affected Tier:** Tier 2 (Backend)
- **Source File & Line:** [SecurityConfig.java:47-50](file:///E:/Project/TodoApplication/SpringLearning/src/main/java/Course/SpringLearning/SecurityConfig.java#L47-L50)
- **API Endpoint:** All backend endpoints
- **Database Table / Model:** N/A
- **Steps to Reproduce:**
  1. Inspect `SecurityConfig.corsConfigurationSource()`.
  2. Observe:
     ```java
     corsConfiguration.setAllowedOriginPatterns(List.of("*"));
     corsConfiguration.setAllowCredentials(true);
     ```
- **Expected Result:**
  - Production deployments should enumerate authorized frontend origins (e.g. `https://my-taskverse.vercel.app`, `http://localhost:*`).
- **Actual Result:**
  - Wildcard pattern `*` is permitted with credentials.
- **Confirmed Root Cause:** Development-friendly configuration designed to allow local static file loading and multiple preview domains without CORS errors.
- **Business Impact:** Low in current stateless JWT model (tokens stored in client Authorization headers rather than ambient cookies).
- **Severity:** LOW
- **Recommended Solution:**
  In production environment, set `corsConfiguration.setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*", "https://*.onrender.com", "https://*.vercel.app"));`.
- **Suggested Regression Test:** Send `OPTIONS` preflight request with origin `https://malicious-domain.com` in production and verify rejected preflight.

---

## Issue OBS-03: Browser Autoplay Policy on Achievement Video Stage

- **Issue ID:** OBS-03
- **Module & Feature:** Daily Mass Meter / Video Celebration
- **Affected Tier:** Tier 1 (Frontend)
- **Exact Page / Component:** `#achievement-media-stage` / `#achievement-video`
- **Source File & Line:** [script.js:770-820](file:///E:/Project/TodoApplication/TodoFrontend/script.js#L770-L820)
- **Steps to Reproduce:**
  1. Open application in a strict browser environment (e.g. Safari or Chrome with "Block Autoplay" policy).
  2. Reach 4:00 PM or trigger celebration.
  3. Video `play()` promise rejects with `NotAllowedError: play() failed because the user didn't interact with the document first`.
- **Expected Result:**
  - Application handles browser autoplay restrictions gracefully.
- **Actual Result (Audited & Verified):**
  - TaskVerse already handles this gracefully via `video.muted = true`, inline playback attributes (`playsinline`), and an explicit fallback UI overlay (`#video-autoplay-fallback` with "Click to Play Video" button).
- **Status:** PASS (Robust fallback mechanism confirmed).
- **Severity:** LOW
