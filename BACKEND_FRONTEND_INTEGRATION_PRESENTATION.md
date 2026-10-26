# Backend and Front-End Integration Presentation

---

## Slide 1: Project Overview

The Dental Clinic System connects a browser-based front end to a Node.js/Express backend and a PostgreSQL database.

Key idea:
- The front end handles the user experience, forms, dashboards, and role-based screens.
- The backend handles authentication, authorization, business logic, and database access.
- The API layer keeps both sides loosely coupled and easier to maintain.

System components:
- Front end: `Js/index.html`, `Js/Auth.js`, `Js/Dashboard.js`, `Js/appointments.js`, `Js/patients.js`, etc.
- API server: `Js/server.js`
- Route handlers: `Js/routes/index.js`
- Database access: `Js/database.js`
- Shared data layer: `Js/api.js`

---

## Slide 2: Front-End Structure

The front end is built as a single-page clinic dashboard with role-based access.

User-facing modules include:
- Login and signup screens
- Admin management views
- Patient records and appointments
- Clinic profiles and service setup
- Dentists, prescriptions, billing, and follow-ups

Important implementation detail:
- The UI loads from `Js/index.html` and serves CSS from `/Css` and JS from `/Js`.
- Each module uses browser state objects such as `state`, `dentists`, and `patients` to render dynamic data.

This makes the interface responsive while keeping the logic modular and easier to extend.

---

## Slide 3: Backend Architecture

The backend is powered by Express and PostgreSQL.

Main backend files:
- `Js/server.js` creates the Express application, configures CORS, session middleware, rate limiting, and static file serving.
- `Js/database.js` opens the PostgreSQL connection pool.
- `Js/routes/index.js` defines the API endpoints and business logic.
- `Js/auth-middleware.js` protects routes that require authentication or a specific role.

Backend responsibilities:
- Validate signup and login
- Enforce role-based access
- Query and update patient, clinic, appointment, and prescription data
- Manage notifications and session state

---

## Slide 4: API Integration Flow

The front end does not talk directly to PostgreSQL. It calls the backend API over HTTP.

Request flow:
1. User enters credentials in the login form.
2. `Auth.js` calls `apiPost('/auth/login', payload)`.
3. `Js/api.js` wraps `fetch()` and appends the correct `API_BASE`.
4. Express receives the request in `Js/server.js`.
5. Route logic in `Js/routes/index.js` validates input and queries PostgreSQL.
6. The backend sends JSON back to the browser.
7. The UI re-renders the dashboard, table, form, or modal with the fresh data.

This pattern is used for all major operations, including:
- login/logout
- clinic registration
- appointments
- records
- services
- prescriptions
- notifications

---

## Slide 5: Real Example - Login Flow

Login flow example:

1. The user fills in username and password.
2. `Auth.js` triggers `apiPost('/auth/login', { username, password })`.
3. Backend checks the users table with a query like:
   - `SELECT * FROM users WHERE lower(username) = lower($1)`
4. If the password matches, the server creates a session.
5. The browser stores the authenticated user in session state and loads the appropriate dashboard.

Key point:
- Session management is handled by `express-session` using PostgreSQL-backed session storage.
- The user remains authenticated across requests without exposing credentials in the URL or client storage.

---

## Slide 6: Data Handling and CRUD

The app follows a REST-style pattern and keeps all front-end data updates centralized.

Common client-side API helpers:
- `apiGet(path)` for reads
- `apiPost(path, body)` for create actions
- `apiPut(path, body)` for updates
- `apiPatch(path, body)` for partial updates
- `apiDelete(path)` for deletes

Examples in the project:
- `apiGet('/appointments')` loads upcoming visits
- `apiPost('/appointments', values)` creates a new appointment
- `apiGet('/patients')` fetches patient records
- `apiGet('/notifications')` loads live user messages

This creates a consistent contract between front end and back end.

---

## Slide 7: Security and Access Control

The app includes several backend controls to protect the system.

Security features:
- CORS restrictions in `Js/server.js`
- Rate limiting on sensitive routes like login and signup
- Session cookies with `httpOnly` and `sameSite` settings
- `requireAuth` and `requireRole` middleware for protected endpoints
- Password hashing with `bcryptjs`

Example:
- `router.post('/auth/login', ...)` checks the user and compares the password hash.
- Protected routes only proceed when the request belongs to an authenticated session.

This ensures that the front end cannot bypass permission rules by manipulating the UI alone.

---

## Slide 8: Why the Integration Works Well

This project demonstrates a clean front-end/back-end integration pattern:

Strengths:
- Front end remains focused on presentation and interaction.
- Backend remains responsible for validation, business rules, and database logic.
- Shared API wrapper reduces repetitive code and keeps error handling consistent.
- Role-based routing allows different users to view different dashboards.
- Data is loaded dynamically instead of being hardcoded in the UI.

Because of this separation, the system is easier to scale and maintain.

---

## Slide 9: Challenges and Improvements

Potential improvement areas:
- Add more formal API documentation with Swagger or OpenAPI.
- Centralize response validation for frontend models.
- Strengthen input validation for all CRUD endpoints.
- Add unit and integration tests for backend routes.
- Improve caching and pagination for large patient or appointment lists.

These improvements would make the system more robust and easier to expand in future phases.

---

## Slide 10: Conclusion

The Dental Clinic System combines:
- a modern front-end interface,
- a secure Express API,
- PostgreSQL persistence, and
- session-based authentication.

The integration is successful because the browser and server communicate through a predictable API layer. This division keeps the code organized, user-facing, and maintainable while ensuring proper security and business logic enforcement.

Thank you.

---

### Key Integration References

- `Js/api.js`
- `Js/server.js`
- `Js/routes/index.js`
- `Js/database.js`
- `Js/Auth.js`
- `Js/index.html`
