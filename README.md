// Welcome to our project //
Instructor: Jaafar Omar (Handsome just like Basil) 

// Private Dental Clinic System //

Members: Basil Sunog
         Jane Rose Gementiza

Progression: 80%

Google Maps
-----------

Clinic location frames use the Google Maps Embed API when `GOOGLE_MAPS_API_KEY` is set in the root `.env` file. Enable the Maps Embed API and billing in Google Cloud, and restrict the browser key by HTTP referrer to the app's local/LAN address and production domain. Restart the server after changing `.env`. Without a key, the app falls back to a Google Maps embed URL and an Open in Google Maps link.

The patient dashboard includes an embedded Google Map and a search for approved clinics by clinic name, city, or region. The map searches around the user's current Maps location when the field is empty, or focuses on a matching clinic or the entered location. The clinic directory also links to Google Maps for nearby dentists. External Maps searches open in a new tab; they do not require the Places API or share browser location with this app.

Gmail account emails
--------------------

The backend uses the Gmail API with OAuth 2.0 to send signup verification and password-reset links. Email is required for self-registered accounts; after following the verification link, users are signed in automatically and taken to their workspace. Verification and password-reset tokens are stored as SHA-256 hashes and expire after 24 hours and one hour, respectively.

To configure Gmail:

1. In Google Cloud Console, create a project, enable the Gmail API, and configure the OAuth consent screen. Add the Gmail account that will send email as a test user while the consent screen is in testing.
2. Create an OAuth client ID for a Web application and add `http://localhost:3001/oauth2callback` as an authorized redirect URI. Copy the client ID and secret into the server `.env` as `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`.
3. Set `GMAIL_REDIRECT_URI=http://localhost:3001/oauth2callback`, `GMAIL_SENDER_EMAIL` to the authorized sender account, and `APP_BASE_URL` to the browser-accessible app URL. For local use, the values in `.env.example` work when the app is served on port 4000.
4. Run `npm --prefix Js run gmail:authorize`. Open the printed URL, sign in as the sender account, and approve Gmail send access. Copy the printed refresh token into `GMAIL_REFRESH_TOKEN` in `.env`. Treat the token like a password; do not commit it or share it.
5. Restart the backend. Signup sends a verification email; the sign-in screen also has links to resend verification and request a password reset.

The OAuth client only requests the Gmail `gmail.send` scope. OAuth apps left in Google's testing mode may receive refresh tokens that expire after seven days; configure and publish the consent screen for your deployment as required by Google.

If mail delivery fails, the API reports a targeted recovery hint for common OAuth, permission, API enablement, quota, and network errors. After changing Gmail credentials, restart the backend. Existing accounts are kept verified during migration; newly registered accounts must use the verification link before signing in.

API documentation and testing
-----------------------------

Start the backend, then open `http://localhost:4000/api/docs` for the interactive Swagger UI or `http://localhost:4000/api/openapi.json` for the OpenAPI specification.

The authenticated patient, appointment, dental-record, prescription, transaction, dentist, and service lists accept optional `page` (1-based), `pageSize` (1–100), and supported filter parameters. Appointments, records, prescriptions, and transactions accept `dateFrom` and `dateTo`; patients filter on their registration date. `search`, `patientId`, `dentistId`, and `status` are supported only for applicable resources. Requests without filters or pagination keep returning the legacy array response. Filtered or paginated requests return `{ items, total, page, pageSize, totalPages }`.

Run backend validation and API tests with `npm --prefix Js test`.

The transactions table stores `dentist_id` as a nullable foreign key to `dentists(id)`. The schema migration backfills existing transactions from each patient's assigned dentist, and new transactions derive the dentist from the selected patient. A clinic can have multiple dentists through `dentists.clinic_id`; an appointment stores the selected dentist in `appointments.dentist_id`. Run `npm run migrate` from the backend package (`Js`) to apply the schema changes to PostgreSQL.

Multi-clinic deployment and administrator handoff
--------------------------------------------------

This system is intended to support multiple clinics. The organization receiving the deployment—not the development team—must appoint the platform operator responsible for the production Administrator account and clinic verification. Do not launch clinic registration until the receiving organization has assigned an operator and established review coverage; unapproved clinics remain pending and are hidden from public search.

See [MULTI_CLINIC_DEPLOYMENT_HANDOFF.md](./MULTI_CLINIC_DEPLOYMENT_HANDOFF.md) for the initial Administrator setup command, secure credential handoff, clinic review process, and operational continuity checklist.