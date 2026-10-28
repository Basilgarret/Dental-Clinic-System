// Welcome to our project //
Instructor: Jaafar Omar (Handsome just like Basil) 

// Private Dental Clinic System //

Members: Basil Sunog
         Jane Rose Gementiza

Progression: 80%

Google Maps
-----------

Clinic location frames use the Google Maps Embed API when `GOOGLE_MAPS_API_KEY` is set in the root `.env` file. Enable the Maps Embed API and billing in Google Cloud, and restrict the browser key by HTTP referrer to the app's local/LAN address and production domain. Restart the server after changing `.env`. Without a key, the app falls back to a Google Maps embed URL and an Open in Google Maps link.

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