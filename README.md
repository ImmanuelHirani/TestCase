# Jasindo — User Management Web App

Coding test for **PT. Asuransi Jasa Indonesia** (via PT. Indocyber Global Technology).
React front end, Laravel API, PostgreSQL database — built as a **microfrontend**.

Candidate: Immanuel Christian Hirani

---

## Stack

| Layer | Choice |
|---|---|
| Front end | React 19 · Vite 8 · TypeScript · Tailwind CSS 4 · React Router 7 |
| Data layer | TanStack Query (server cache, mutations, devtools) |
| Table | TanStack Table (server-side sort, manual pagination) |
| Forms | React Hook Form + Zod (live, per-keystroke validation) |
| DTOs | Zod schemas in `shared/src/dto` — one schema per shape, used as the request body, the response parser, the form resolver, and the TS type (`z.infer`) all at once |
| Motion | Framer Motion (dialogs, snackbar, list transitions) — driven by the same M3 easing tokens the CSS uses |
| Design system | **Material Design 3** — tokens generated from a brand seed via material-color-utilities |
| Navigation | M3 adaptive: navigation bar (compact) → collapsed rail (medium) → expanded rail sidebar (840dp+) |
| Microfrontend | Module Federation (`@module-federation/vite`) |
| Back end | Laravel 13 · PHP 8.3 |
| Auth | JWT in an **HttpOnly, SameSite=Lax cookie** (`firebase/php-jwt`) — never readable from JavaScript |
| Database | PostgreSQL 16 |
| API docs | Swagger UI (l5-swagger) + Postman collection |

> The brief allows *"MySQL atau PostgreSQL"* — PostgreSQL was chosen.

---

## Layout

```
D:\Test-case
├─ BE\api\                     Laravel API              → http://localhost:8001
└─ FE\
   ├─ TestCase\                Host shell (MF host)     → http://localhost:5000
   └─ Microfrontend\
      ├─ users\                users_mfe  (remote)      → http://localhost:5001
      ├─ auth\                 auth_mfe   (remote)      → http://localhost:5002
      └─ shared\               plain library, not a remote
```

`shared` holds the axios client, the Zod DTOs (request/response schemas and their
inferred types), the TanStack Query client + session hooks, and the M3 design tokens
and UI components. It's an ordinary npm workspace package; the libraries whose state
crosses the federation boundary through React context (`react-query`, `zod`,
`framer-motion`, alongside `react`/`react-dom`/`react-router-dom`) are declared as
Module Federation singletons so only one copy of each is ever live — see "Rules that
keep it working" further down.

---

## Setup

### 1. Database (once)

PostgreSQL 16 must be running on port 5432. As the `postgres` superuser:

```bash
psql -U postgres -f BE/api/docs/setup-database.sql
```

That creates the `jasindo` role and the `jasindo_test` database. Credentials are
already set in `BE/api/.env` — change `DB_PASSWORD` there if you use a different one.

### 2. Back end

```bash
cd BE/api && php artisan migrate:fresh --seed && php artisan serve --port=8001
```

API on `http://localhost:8001`. Swagger UI on `http://localhost:8001/api/documentation`.

> **Why 8001 and not Laravel's default 8000.** Port 8000 is occupied on this machine by a
> separate project (`WMS-BE`). Laravel silently falls back to the next free port when 8000 is
> taken, so `php artisan serve` would start on 8001 anyway while the frontend kept calling
> 8000 — and every request would hit the *other* application, which answers `404` in its own
> error format. That failure is genuinely confusing to debug, because both servers are up and
> both respond. Pinning the port here and in `FE/*/.env` removes the ambiguity.
>
> If 8000 is free on your machine and you prefer it, change the `--port` flag and the three
> `VITE_API_URL` values together — they must always agree.

### 3. Front end

```bash
cd FE && npm install && npm run dev
```

Starts all three apps at once — host `:5000`, users `:5001`, auth `:5002`.

Open **http://localhost:5000**.

### Demo accounts

| Email | Password | Role | Can |
|---|---|---|---|
| `admin@jasindo.test` | `password` | admin | read + create + update + delete |
| `user@jasindo.test` | `password` | user | read only (writes return 403) |

---

## API

Base URL: **`http://localhost:8001/api/v1`**. Path-versioned (see "API standards" below).

| Method | Path | Operation | Access |
|---|---|---|---|
| POST | `/api/v1/login` | — | public, rate-limited 5/min |
| GET | `/api/v1/stats` | — | authenticated — dashboard aggregates |
| POST | `/api/v1/logout` | — | authenticated |
| GET | `/api/v1/me` | — | authenticated |
| POST | `/api/v1/users:find` | `find` | authenticated — browse, no filters |
| POST | `/api/v1/users:search` | `search` | authenticated — filtered query |
| GET | `/api/v1/users/{uuid}` | `get` | authenticated |
| POST | `/api/v1/users:create` | `create` | **admin only** |
| POST | `/api/v1/users:update` | `update` | **admin only** |
| POST | `/api/v1/users:delete` | `delete` | **admin only** |

Every URL is complete as written — **no query strings anywhere**. Paging, sorting and
filter criteria travel in the JSON request body:

```jsonc
// POST /api/v1/users:find
{ "limit": 10, "cursor": null }

// POST /api/v1/users:search
{ "search": "budi", "role": "user", "limit": 10, "cursor": null, "sort": "name", "direction": "asc" }

// POST /api/v1/users:update      — target id in the body, not the path
{ "id": "0b8ff391-dee2-4140-a559-1179c9d30ee4", "name": "Budi Santoso", "email": "user@jasindo.test", "password": "", "role": "user" }

// POST /api/v1/users:delete
{ "id": "0b8ff391-dee2-4140-a559-1179c9d30ee4" }
```

**Record identifiers stay out of request lines.** `users:update` and `users:delete` address
their target through an `id` body field rather than `/users/{id}:update`, so an id never
appears in a URL, an access log line, or a Network-tab row. Two consequences worth naming:

- `id` now sits alongside the writable columns in the body, so the controller **strips it
  before `update()`** — otherwise a request body could reassign a record's primary key.
  There's a test pinning that (`test_the_id_in_the_body_addresses_a_row_but_cannot_rewrite_one`).
- An unknown id is a **422 with a field error on `id`**, not a bare 404. The client sent one
  body, so it gets one response describing everything wrong with that body.

### The published id is a UUID, not the primary key

Every `id` this API emits is a random v4 UUID. The auto-increment `users.id` stays as the
internal key — it is a compact integer for indexes and joins, and there is no reason to give
that up — but it never crosses the wire.

The reason is not aesthetic. **A sequential id is guessable and countable.** Anyone holding
`/users/41` can try `/users/42`; and watching the ids issued over a week tells them how many
people the company hired. A random UUID leaks neither.

Deliberately **v4 (random), not Laravel's `orderedUuid()`**. Ordered UUIDs index better, but
they encode creation time and preserve creation order — exactly the inference this column
exists to prevent.

Getting this right meant closing every channel the integer could still have escaped through,
not just the obvious one:

| Channel | How it leaked | Closed by |
|---|---|---|
| Response bodies | `'id' => $this->id` | `UserResource` publishes `uuid` |
| URLs | `/users/41` | `getRouteKeyName(): 'uuid'` |
| `Location` header | built from the route | follows the route key |
| `ETag` | `W/"41-1699…"` | built from `uuid` |
| **Pagination cursor** | base64 of `{"id":41,…}` | ORDER BY `uuid`, so the cursor carries the uuid |
| **JWT `sub` claim** | `sub: 41` | `sub` is the uuid |

The cursor is the one worth pointing at. Laravel base64-encodes the *ordered columns* into
it, so whatever appears in the `ORDER BY` appears — decodable — in the browser. Sorting by the
primary key would have re-published the very value the rest of this work removes. Decode a
cursor from this API and you get `{"uuid":"0b8ff391-…"}`.

Two consequences that fall out of the change:

- **`id` is not a sortable column.** Ordering by a random UUID would sort rows by nothing a
  reader can see, so the backend rejects it and the ID column in the table has no sort
  control. Omitting `sort` asks for the server's default ordering.
- **A malformed id is a 404, not a 500.** `uuid` is a Postgres `uuid` column, so
  `/users/999999` would reach the driver as an uncastable literal and raise SQLSTATE 22P02.
  A `whereUuid` route constraint means the segment never matches the route at all. The same
  guard exists on the JWT subject, because a token minted before this change carries an
  integer and must degrade to *"sign in again"* rather than a 500 — both are pinned by tests.

In the UI the column shows the first block (`0b8ff391`) with the full value on hover, and the
search box prefix-matches on exactly that visible fragment.

Two more decisions, each with a reason.

**Custom methods** (Google AIP-136, `resource:verb`) rather than one overloaded list
endpoint: each operation is identifiable from the URL alone in a Network tab, access log or
APM trace, and the cheap browse path can be cached and rate-limited separately from the
ILIKE-scanning search path. Every response also echoes its own `operation` field. `:find`
**rejects** filter fields with a 400, so routing a filtered query to it is an error rather
than a silently unfiltered result.

**POST with a body** rather than GET with a query string. AIP-136 makes POST the default for
custom methods, and it's the shape Elasticsearch (`POST /_search`), Azure AI Search and
Google Cloud Asset Inventory all ship. Concretely:

- **Search terms stop leaking.** A query string lands in server access logs, browser history
  and `Referer` headers on any outbound link; a body does not. When the filter is an
  employee's name, that's a privacy property, not a style preference.
- **No length ceiling.** Query strings get truncated by proxies around ~2 KB; a growing
  filter set (date ranges, multi-select departments) has room in a body.
- **Structured filters stay structured.** Nested/array criteria are natural in JSON and
  awkward-to-ambiguous as `?a[]=x&a[]=y`.

The cost, stated plainly: POST responses aren't HTTP-cacheable and POST isn't a "safe" method
in HTTP's sense. For an authenticated dashboard whose responses are per-viewer (see
[field-level authorisation](#field-level-authorisation)) and therefore uncacheable by a shared
cache anyway, that trade costs nothing real — and react-query still caches client-side, keyed
on the request body. `GET /users/{uuid}` is deliberately left as a plain, safe, cacheable read.

`search` matches name, email, or the leading characters of a user's UUID. Body fields not
in the documented set are **rejected** with a 400, not silently ignored (and so is anything
appearing in a query string, since these endpoints don't use one) — see "API standards" below.

### Cursor pagination

`:find` and `:search` are **cursor**-paginated, per Zalando rule 160 (SHOULD: "Prefer
cursor-based pagination, avoid offset-based pagination"):

```json
{
  "operation": "find",
  "data": [ { "id": "03ec177c-5aa7-46de-aed5-958352ddb943", "name": "Admin Jasindo", "…": "…" } ],
  "page": {
    "limit": 10,
    "has_more": true,
    "next_cursor": "eyJ1dWlkIjoiMGI4ZmYzOTEtZGVlMi00MTQwLWE1NTktMTE3OWM5ZDMwZWU0IiwiX3BvaW50c1RvTmV4dEl0ZW1zIjp0cnVlfQ",
    "prev_cursor": null
  },
  "field_policy": { "…": "…" }
}
```

Two concrete reasons beyond following the rule:

- **Correctness.** With `OFFSET`, a row inserted or deleted while someone is paging
  shifts every subsequent row by one, so they silently skip or re-see records. A cursor
  points at "the row after this specific one", so concurrent writes can't shift the window.
- **Cost.** `OFFSET 10000` makes Postgres walk and discard 10 000 rows on every request;
  a keyset cursor seeks straight to the position via the index and stays flat however deep
  the page is.

The trade-off is real and the UI states it rather than hiding it: cursors can't jump to an
arbitrary page number, and the response deliberately carries **no total count** (Zalando
rule 254, Microsoft "YOU SHOULD NOT return a `count`") because producing one costs a second
full scan. The dashboard's totals come from `/stats`, which aggregates properly. The
pagination control is therefore Previous/Next/First with a "cursor paging" hint, not
numbered pages.

Cursors are **opaque by contract** — hand them back verbatim in the next request body, never
parse or construct one. A cursor is dropped whenever the filter or sort changes, since it is
only meaningful within the result set that produced it.

### Why the browser URL stays clean too

Filter state lives in component state, not in `?search=…`. The browser URL stays `/users`
throughout — while searching, filtering, sorting and paging.

The upside is the same privacy property as the request body: filter values never enter
browser history or a `Referer` header. The **trade is real and worth naming**: a filtered
view is no longer shareable as a link, and the back button doesn't step through filter
changes. For an authenticated internal dashboard that's an acceptable exchange; for a public
catalogue it wouldn't be, and the filters would belong in the URL instead.

The query object still keys the react-query cache, so caching, refetching and
`keepPreviousData` behave exactly as they did when it lived in the URL — only the location
changed, not the mechanism.

### Field-level authorisation

Endpoint-level RBAC (the `role` middleware) answers "may you call this?". `FieldPolicy`
answers the separate question "which *fields* may you see?" — a non-admin may legitimately
list colleagues but has no business reading their personal phone numbers.

Restricted fields are **omitted entirely, not returned as `null`** (Microsoft: "DO NOT send
JSON fields with a null value from the service to the client"), and every list/read response
publishes the policy that produced it:

```json
"field_policy": {
  "viewer_role": "user",
  "visible": ["id","name","email","role","department","created_at","updated_at"],
  "restricted": ["phone"],
  "note": "Restricted fields are omitted from each record, not returned as null. Sign in as an admin to see them."
}
```

Publishing it is what makes omission unambiguous: without it, a missing `phone` is
indistinguishable from a user who simply has none on file. The UI reads this and renders a
lock chip plus a banner instead of a blank cell — so the restriction is legible both in the
Network preview and on screen. Sign in as `user@jasindo.test` to see it.

### Error envelope — RFC 9457 Problem Details

Every failure returns the same shape, produced in one place
([bootstrap/app.php](BE/api/bootstrap/app.php)), following
[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) — the format Zalando, Spring
Boot, and ASP.NET all use by default, understood by generic tooling (API gateways,
monitoring, client generators) without a custom client for this API specifically:

```json
{
  "type": "https://api.jasindo.test/problems/validation-error",
  "title": "The submitted data is invalid.",
  "status": 422,
  "detail": "One or more fields failed validation.",
  "instance": "/api/v1/users",
  "code": "VALIDATION_ERROR",
  "errors": { "email": ["The email has already been taken."] }
}
```

`Content-Type: application/problem+json` — distinct from a normal `application/json`
success body, so a client or proxy can tell the two apart without inspecting the status
code first. `code` and `errors` are RFC 9457's "extension members" (§3.2, explicitly
permitted): the frontend switches on the stable `code` string rather than parsing
`title`/`detail` text.

| Exception | HTTP | code |
|---|---|---|
| `ValidationException` | 422 | `VALIDATION_ERROR` |
| `AuthenticationException` | 401 | `UNAUTHENTICATED` |
| `AccessDeniedHttpException` | 403 | `FORBIDDEN` |
| `ModelNotFoundException` / `NotFoundHttpException` | 404 | `NOT_FOUND` |
| `MethodNotAllowedHttpException` | 405 | `NOT_FOUND` |
| `UnsupportedQueryParameterException` | 400 | `UNSUPPORTED_PARAMETER` |
| `TooManyRequestsHttpException` | 429 | `TOO_MANY_REQUESTS` |
| `PreconditionFailedException` | 412 | `PRECONDITION_FAILED` |
| `QueryException` | 500 | `DB_ERROR` |
| anything else | 500 | `SERVER_ERROR` |
| *(frontend-only)* Zod schema mismatch | — | `SCHEMA_ERROR` |

The front end parses this shape and nothing else, so an unanticipated exception still
reaches the UI as a readable message rather than a white screen or an HTML error page.
`SCHEMA_ERROR` is thrown on the frontend itself, by `parseApiResponse` in
[dto/apiError.ts](FE/Microfrontend/shared/src/dto/apiError.ts), when a response's shape
doesn't match its DTO — a contract break surfaces immediately as a readable error instead
of `undefined` reaching a component three renders later.

### Docs

- Swagger UI — `http://localhost:8001/api/documentation`. "Try it out" cannot authenticate
  directly — the HttpOnly cookie is invisible to it by design. Log in from the app itself
  first; Swagger then inherits the cookie on same-origin requests.
- Postman — import `BE/api/docs/jasindo-api.postman_collection.json`, run **Login** first.
  Postman is not a browser, so it isn't blocked by `HttpOnly` — its own cookie jar stores
  the session automatically, no bearer token or collection variable involved. A
  **Standards** folder demonstrates each fix below with its own assertions.

---

## API standards

Audited against [Zalando's RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/),
[Microsoft's Azure API Guidelines](https://github.com/microsoft/api-guidelines),
[Google's AIP-193](https://google.aip.dev/193), and
[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) / [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).

| # | Gap found | Fix | Where |
|---|---|---|---|
| 1 | Custom error shape, not a standard | RFC 9457 Problem Details, `application/problem+json` | `bootstrap/app.php`, `app/Support/ProblemType.php` |
| 2 | Unknown params silently ignored | Whitelist over body **and** query + 400 `UNSUPPORTED_PARAMETER` | `UserController::rejectUnsupportedParams`, `UnsupportedQueryParameterException` |
| 3 | 429 with no `Retry-After`/`RateLimit-*` | Exception headers now preserved through the handler | `bootstrap/app.php` (`HttpExceptionInterface::getHeaders()` merge) |
| 4 | No versioning strategy | `/api/v1` path prefix | `routes/api.php` |
| 5 | 201 with no `Location` header | `Location` header via the named `users.show` route | `UserController::create` |
| 6 | 405 with no `Allow` header | Same header-preservation fix as #3 | `bootstrap/app.php` |
| 7 | snake_case vs camelCase | Deliberate: snake_case, matching Zalando rule 118 (MUST) and the PHP/Laravel ecosystem. Microsoft's Azure guideline prefers camelCase — noted as a conscious choice, not an oversight. | every DTO |
| 8 | No optimistic concurrency | Weak `ETag` (uuid + `updated_at`) returned by `GET /users/{uuid}` and `users:update`; optional `If-Match` → `412` on a stale write | `app/Support/ETag.php`, `UserController::show`/`update` |
| 9 | Offset pagination (skips/duplicates rows under concurrent writes; `OFFSET n` cost grows with depth) | Cursor pagination | `UserRepository::cursorPaginate`, `UserCollectionResponse` |
| 10 | One overloaded list endpoint; operations indistinguishable in a Network trace; filters exposed in URLs and logs | Custom methods `:find` / `:search` / `:create` / `:update` / `:delete`, each echoing `operation`; reads take a POST body so no query strings remain | `routes/api.php`, `UserController` |
| 11 | No field-level authorisation — every viewer saw every column | `FieldPolicy`: restricted fields omitted (not nulled) and the policy published in-band | `app/Support/FieldPolicy.php`, `UserResource` |

**#3 and #6 share one root cause and one fix.** Laravel's `ThrottleRequests` and
`MethodNotAllowedHttpException` both attach their headers to the *exception itself*
(`Retry-After`/`X-RateLimit-*`, `Allow` respectively) — but the original handler rebuilt
the JSON response from scratch and never copied them over. The fix is one generic loop
over `$e->getHeaders()` for any `HttpExceptionInterface`, not two special cases.

**#8's ETag flow, end to end:** `UsersPage` fetches a user fresh (with its ETag) right
before opening the edit dialog — never off the already-loaded table row, which carries no
per-row ETag and can be stale. The dialog sends that ETag back as `If-Match` on `PUT`; if
someone else changed the row in between, the write is refused with `412` instead of
silently overwriting a change it never saw. `If-Match` is optional throughout, so a caller
that never fetched an ETag (Postman, an older client) still works exactly as before.

**Not changed:** naming convention (#7) is a *documented choice*, not a defect — Zalando
and Microsoft's own guidelines disagree with each other on camelCase vs snake_case, so
"pick one and be consistent" is the actual correct answer, and consistency was already
true before this audit.

---

## Authentication — JWT in an HttpOnly cookie

Auth was rebuilt around a real JWT (`firebase/php-jwt`) carried in an **HttpOnly,
SameSite=Lax cookie**, not a bearer token the frontend stores itself.

- **The token never appears in a JSON body.** `POST /login` and `GET /me` return the user
  and an `expires_at` timestamp — never the token — because a script that could read the
  token (including one injected by an XSS bug) defeats the entire point of choosing a
  cookie over `localStorage`. Set it, and nothing else.
- **The frontend cannot read `document.cookie` for this cookie**, by design. So "am I
  logged in" is no longer a synchronous `localStorage` check — it's the answer to
  `GET /api/me`, cached as a normal TanStack Query (`useSession()` in
  [shared/src/session.ts](FE/Microfrontend/shared/src/session.ts)). `RequireAuth` in the
  host waits for that query to settle before deciding to redirect, so a hard refresh on a
  protected route never flashes the login page for an already-signed-in user.
- **`SameSite=Lax`, not `Strict`.** The cookie belongs to the API's own origin
  (`localhost:8001`); host and every microfrontend, each its own origin, call that same
  API — cross-origin, but same-site. `Lax` still sends the cookie there; `Strict` would
  silently drop it on every one of those requests.
- **CORS needs `supports_credentials: true`** ([config/cors.php](BE/api/config/cors.php))
  and axios needs `withCredentials: true`
  ([shared/src/apiClient.ts](FE/Microfrontend/shared/src/apiClient.ts)) — either half
  missing and the browser strips the cookie regardless of what the other side allows.
- **`AuthenticateJwtCookie` middleware** ([app/Http/Middleware](BE/api/app/Http/Middleware/AuthenticateJwtCookie.php))
  reads the cookie, verifies the JWT, and calls `Auth::setUser()` — every controller still
  just calls `$request->user()`, unaware the token travels as a cookie rather than a
  bearer header.
- Tests authenticate the same way the browser does: `TestCase::actingAsJwt()` mints a real
  token and attaches it via `withUnencryptedCookie()` (Laravel's test client silently
  *encrypts* `withCookie()`, assuming `EncryptCookies` will decrypt it — that middleware
  is deliberately absent from the `api` group here) plus `withCredentials()` (JSON test
  helpers only attach cookies at all when this is set, mirroring axios's own flag).

## Security layers

| Layer | Where |
|---|---|
| JWT in an HttpOnly, SameSite=Lax cookie | `JwtService`, `AuthenticateJwtCookie` middleware |
| Password hashing (bcrypt) | `User` model `hashed` cast |
| Role-based endpoint access | `EnsureUserHasRole` middleware, alias `role` |
| Input validation (server) | `StoreUserRequest`, `UpdateUserRequest`, `LoginRequest` |
| Input validation (client, live) | Zod DTOs + React Hook Form — the exact schema the request body must satisfy |
| Login rate limiting | `throttle:5,1` on `/api/login` |
| CORS allowlist + credentials | `config/cors.php` — explicit origins, `supports_credentials: true` |
| SQL injection | Eloquent parameter binding throughout; no raw SQL |
| Column-name injection | `UserRepository::SORTABLE_COLUMNS` whitelist for the `sort` query param |
| Field whitelisting | `UserResource` — password can never leak |
| No user enumeration | login returns one message for both failure modes |
| Least-privilege DB role | app connects as `jasindo`, never as a superuser |

---

## Microfrontend

### How it works

Each remote is a standalone Vite app with its own `package.json`, dev server, build and
deploy. Its build emits a `remoteEntry.js` manifest; the host fetches that file over HTTP
at runtime and lazily imports components out of it. There is **no build-time dependency**
between host and remote — that is the whole point.

```ts
// Host: this is not compiled in, it is fetched at runtime.
const RemoteUsersPage = lazy(() => import('users_mfe/UsersPage'));
```

| Package | Exposes |
|---|---|
| `users_mfe` | `./UsersPage`, `./UserTable` |
| `auth_mfe` | `./LoginPage` |

### Rules that keep it working

1. **`singleton: true` on react, react-dom, react-router-dom.** Two copies of React means
   "invalid hook call"; two routers means navigation silently stops working. This is the
   single most common way a microfrontend breaks.
2. **Remotes must be up before the host routes to them** — otherwise `remoteEntry.js` 404s.
3. **Auth state is never shared through Module Federation.** It lives in `localStorage`,
   read through `shared/authStore`, so each remote runs standalone with no host injection.
4. **Tailwind compiles per app, and an exposed module must import its own CSS.**
   The remote's `main.tsx` never runs inside the host, so a stylesheet imported only
   there does not travel with the component -- each exposed module imports
   `../index.css` itself. Only the tokens in `shared/m3-theme.css` are shared, never a
   compiled bundle.
5. **Every federated mount is wrapped in `RemoteBoundary`** (ErrorBoundary + Suspense).
   Independent deploys mean independent failures.

### Running remotes standalone

Each remote is a real app on its own:

```bash
npm run dev -w users-mfe
```

`http://localhost:5001` renders the full users page with no host involved.

### Production-style run

Vite HMR across federated modules is the flakiest part of the stack. For a demo, build and
preview instead of running dev servers:

```bash
cd FE && npm run build && npm run preview
```

---

## Requirement coverage

Checked against the brief (`TEST CANDIDATE Frontend Immanuel Christian Hirani.pdf`), both
the 14 numbered requirements and the 10-row scoring table.

### The 14 numbered requirements

| # | Requirement (abridged) | Where it lives |
|---|---|---|
| 1 | React/Vue front end + Laravel back end, full CRUD | React 19 in `FE/`, Laravel 12 in `BE/api`; `UserController` + `UsersPage`/`UserFormModal` |
| 2 | Connected to a SQL database (MySQL **or PostgreSQL**) | PostgreSQL 16 via `pdo_pgsql`; migrations + seeder |
| 3 | Parent component passing props to child components | `UsersPage` owns all state; six prop-driven children — see below |
| 4 | Basic SQL operations (SELECT/INSERT/UPDATE/DELETE) | `UserRepository` + Eloquent; all four exercised by the CRUD endpoints |
| 5 | A security layer on the application | JWT in an HttpOnly cookie, bcrypt, RBAC, rate limiting, CORS allowlist, field-level authz — see [Security layers](#security-layers) |
| 6 | Secured endpoints with role-appropriate access | `AuthenticateJwtCookie` + `role:admin` middleware; writes are admin-only, and `phone` is withheld from non-admins |
| 7 | Global exception handling, per exception type | `bootstrap/app.php` maps each exception class to an RFC 9457 problem body |
| 8 | Error handling on API fetch, shown in the component | axios interceptor → typed `ApiError` → `ErrorPanel` with the server message and Retry |
| 9 | Responsive layout that adapts to screen width | M3 breakpoints: nav bar <600dp, rail 600dp+, sidebar 840dp+; table→cards at 840dp |
| 10 | A component using fetch/axios to list users from an API | `usersApi.fetchUsers` (axios) → `UserTable` |
| 11 | Search by name **or ID**, updating the view | `users:search` — matches name, email, or a UUID prefix; 300 ms debounce |
| 12 | Pagination across multiple pages | Cursor pagination (`cursorPaginate`) → `Pagination` component |
| 13 | API documented with Swagger **/** Postman | **Both** — l5-swagger at `/api/documentation`, plus a 22-request Postman collection with 51 assertions |
| 14 | Demoed live on a scheduled date | `.claude/launch.json` starts both servers; see [Setup](#setup) |

### The 10-row scoring table

| # | Row | Status | Note |
|---|---|---|---|
| 1 | CRUD | Done | Create, read, update, delete, plus browse and search as separate operations |
| 2 | DB MySQL Server | Done, **on PostgreSQL** | Requirement 2 says "MySQL **atau** PostgreSQL"; PostgreSQL 16 chosen. Swapping to MySQL is a `.env` change plus dropping `ILIKE` for `LIKE` |
| 3 | React JS & Spring Boot | Done, **on Laravel** | Requirement 1 says Laravel explicitly; this row appears to be boilerplate from another test. The architecture maps 1:1 — see the mapping note below |
| 4 | Framework (CSS AMPD) | Done | Tailwind CSS 4, with every token bound to a Material Design 3 colour/type/shape role |
| 5 | Responsive layout | Done | Verified at 375 / 600 / 840 / 1440 dp |
| 6 | Swagger | Done | `/api/documentation`, annotated from PHP attributes so the spec cannot drift from the code |
| 7 | Login (single user) | Done | Two seeded accounts so the role split is demonstrable |
| 8 | Authentication Validation Input | Done | FormRequests server-side, Zod client-side, from one shared schema |
| 9 | Filter | Done | Search term + role filter, both in the request body |
| 10 | Pagination | Done | Cursor-based, not offset |

**Beyond the brief:** microfrontend architecture (Module Federation), Material Design 3
design system, TanStack Query + Table, cursor pagination, RFC 9457 error envelopes, ETag
optimistic concurrency, UUID public identifiers, and 54 backend tests.

### If asked "why Laravel, the table says Spring Boot"

Requirement 1 names Laravel; the scoring row names Spring Boot. The written requirement
wins, and the concepts map directly:

| Spring Boot | Laravel here |
|---|---|
| `@RestController` | `UserController` |
| `@Valid` + DTO | `FormRequest` classes |
| `@ControllerAdvice` | `bootstrap/app.php` `withExceptions` |
| Spring Security filter chain | `AuthenticateJwtCookie` + `role` middleware |
| Spring Data repository | `UserRepository` + Eloquent |
| springdoc-openapi | l5-swagger |

### Where the "props from parent to child" requirement lives

[`UsersPage`](FE/Microfrontend/users/src/pages/UsersPage.tsx) is the parent. It owns the
fetched page, the loading and error flags, the search term, the role filter and the
pagination cursor. `UserToolbar`, `UserTable`, `Pagination`, `UserFormModal`,
`ConfirmDialog` and `ErrorPanel` hold no server state of their own — they receive what they
render as props and report changes back through callbacks.

---

## Design system — Material Design 3

The UI follows [Material Design 3](https://m3.material.io/). Nothing in a component
carries a hex value; every element names the **role** it plays and the role resolves to
a colour guaranteed to pair accessibly with its partner.

### Colour

The whole scheme is generated from one brand seed with Google's own
`material-color-utilities` — the same HCT algorithm the M3 spec and Material Theme
Builder use:

```bash
cd FE && npm run generate:theme
```

Seed `#0C4DA2` (Jasindo corporate blue) → 49 role tokens × light/dark, written to
`FE/Microfrontend/shared/m3-color.css`. That file is generated; edit the seed in
`FE/scripts/generate-m3-theme.mjs`, never the CSS.

Dark theme costs nothing at the component level: the tokens are redefined under
`prefers-color-scheme: dark`, and Tailwind is bridged with `@theme inline` so
`bg-primary` follows the override instead of freezing the light value at build time.

### What is applied where

| M3 concept | In this app |
|---|---|
| Colour roles | Body `surface`, navigation `surface-container`, admin badge `tertiary-container`, errors `error-container` |
| Type scale | All 15 baseline styles as `.md-*` classes; buttons use `label-large` |
| Shape scale | Buttons/chips `full`, cards `medium` 12dp, dialogs `extra-large` 28dp, fields `extra-small` 4dp |
| Elevation | 6 levels; tonal surfaces preferred, shadow only for dialogs and the elevated card |
| State layers | `.md-state-layer` — content-colour overlay at hover 8%, focus/press 10% |
| Components | Buttons (5 variants), filled text fields (56dp), cards (3 variants), dialogs, filter chips, snackbar, navigation drawer + bottom bar |

### Why filled text fields, not outlined

The outlined variant's label sits *on* the border, so the outline has to be notched
behind it. Doing that reliably needs a `fieldset`/`legend`, and it still breaks when the
field moves to a different surface colour. The filled variant carries the same
information with a container fill plus an active indicator, and is what M3 recommends
where fields sit close together in a form.

Tokens: `FE/Microfrontend/shared/m3-theme.css` · Components:
`FE/Microfrontend/shared/src/ui/`

### Adaptive navigation

M3 Expressive deprecates the navigation *drawer*; a persistent sidebar is now the
**expanded navigation rail** in its standard configuration. Collapsed and expanded are
the same component, so toggling is a width change rather than a swap to a different
navigation pattern.

| Breakpoint | Width | Navigation |
|---|---|---|
| Compact | <600dp | Navigation bar at the bottom, plus a modal expanded rail from the menu |
| Medium | 600–839dp | Collapsed rail — 96dp, icon over label |
| Expanded+ | 840dp+ | Standard expanded rail — 280dp sidebar, indicator fills the row |

The rail and the bar are never on screen together. The collapsed/expanded choice is
remembered in `localStorage`, defaulting to expanded from 840dp up.

Breakpoints are M3's own (600/840/1200/1600dp), declared as named Tailwind variants
`medium:` / `expanded:` / `large:` / `xlarge:` — so a class states which spec rule it is
applying rather than which arbitrary pixel value.

---

## Frontend data layer

### DTOs — one schema, four jobs

Every request/response shape crossing the API boundary is a Zod schema in
[shared/src/dto](FE/Microfrontend/shared/src/dto), doing four jobs from one definition:

1. **Runtime validation at the boundary** — `parseApiResponse(schema, data)` in every API
   function ([usersApi.ts](FE/Microfrontend/users/src/api/usersApi.ts)) parses the raw
   response before a component ever sees it. A backend field rename or type change surfaces
   immediately as a readable `SCHEMA_ERROR`, not `undefined` three components downstream.
2. **The TypeScript type** — `z.infer<typeof UserSchema>` and friends. The type cannot
   drift from the runtime check because it *is* the runtime check, inferred.
3. **The request payload** — the exact object sent as the body.
4. **The form's live-validation resolver** — `UserPayloadSchema` is passed straight into
   `zodResolver()` for React Hook Form, so the rules a user sees while typing are the exact
   rules the request body must satisfy. One schema, not a form-rules list that could drift
   from what the server accepts.

`UsersQuerySchema` plays three roles from one definition: the component state `UsersPage`
holds, the react-query cache key, and the JSON body POSTed to `users:find` / `users:search`.
Because it's the same object in all three, the cache key can never describe a different query
than the one actually sent. It also owns the `isSearchQuery()` predicate that decides which of
the two endpoints a given query goes to, keeping that routing rule in one place.

**This caught a real bug during development.** Adding the field policy made `phone` absent
(not null) for non-admins, while `UserSchema` still required it — so every non-admin list
response failed validation. Instead of `undefined` quietly reaching the table and rendering
a blank column, `parseApiResponse` threw `SCHEMA_ERROR` and the ErrorPanel said the response
didn't match the expected shape. The fix was to model the three distinct states explicitly:

```ts
phone: z.string().nullable().optional()
//  "0812…"    visible, has a value
//  null       visible, no value on file
//  undefined  withheld — see the response's field_policy
```

That `.optional()` is load-bearing, not defensive: any field that becomes restrictable
later has to be made optional at the same time, and keeping one schema is what forces
those two changes to travel together.

### TanStack Query — the server cache

[shared/src/queryClient.ts](FE/Microfrontend/shared/src/queryClient.ts) creates **one**
`QueryClient`; host and every microfrontend import the same module instance (workspace
symlink + `@tanstack/react-query` declared a Module Federation singleton — see
"Rules that keep it working" below), so a remote's `useQuery()` shares the host's cache
instead of starting cold every time a route mounts it.

- `staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: true` — an admin dashboard
  doesn't need per-keystroke freshness, but catching a colleague's change on tab-focus is
  worth the extra request.
- Query keys are centralised in [queryKeys.ts](FE/Microfrontend/shared/src/queryKeys.ts)
  — a typo in a hand-written key is a cache bug that fails silently (a mutation
  invalidates `['uses']` while every list reads `['users']`); building every key through
  one factory turns that into a TypeScript error.
- Mutations (`useCreateUserMutation`, etc., in
  [queries.ts](FE/Microfrontend/users/src/api/queries.ts)) invalidate `users` **and**
  `stats` on success — creating a user updates the table and the dashboard totals from
  one action, verified live in the browser during development.
- **Session state lives in the query cache, not `localStorage`.** See "Authentication"
  above for why: the cookie is unreadable from JS, so "am I logged in" has to be the
  answer to a query (`useSession()`), not a synchronous read.
- Devtools are mounted in dev (`AppQueryProvider`, bottom-left icon) — every request,
  cache entry, and staleness state is inspectable live, which is also the direct fix for
  "I don't see requests in the Network tab": they were always firing (verified — the
  `/api/login`, `/api/stats`, `/api/users` calls all appear with 200s), but a hand-rolled
  `useEffect` fetch gives you nothing to inspect *between* requests. The Query devtools
  panel is that missing visibility.

### TanStack Table

[UserTable.tsx](FE/Microfrontend/users/src/components/UserTable.tsx) uses
`@tanstack/react-table` **v8**, not the v9 preview `npm install` resolves to by default.
v9 is a from-scratch, atoms-based rewrite (`useTable`, TanStack Store, opt-in feature
modules) with no stable docs to build against yet — v8 is what "TanStack Table" means in
every tutorial and production codebase today, so all three `package.json`s pin
`^8.21.3` explicitly.

The table is `manualSorting: true` — it never reorders rows itself. Clicking a sortable
header reports the column up to `UsersPage`, which writes `?sort=&direction=` into the
URL; the URL change is what drives the `useUsersQuery` query key and triggers the
server-side `ORDER BY`. Backend column names are whitelisted
(`UserRepository::SORTABLE_COLUMNS`) since the sort field lands directly in an `orderBy`.

The mobile card list is **not** built on TanStack Table — it maps `users` directly. A
table library adds nothing to a single-column card layout.

### React Hook Form + Zod

Every form is `useForm({ resolver: zodResolver(schema), mode: 'onChange' })` — `onChange`
is what makes validation live: an error clears the moment a field becomes valid, not on
the next submit attempt. Server-side 422s are mapped onto the same field via `setError()`
in a `useEffect` (never during render — see the comment in
[UserFormModal.tsx](FE/Microfrontend/users/src/components/UserFormModal.tsx) for why
calling it inline broke under Strict Mode's double-invoke).

### Framer Motion

Driven by the same easing tokens the CSS uses
(`--md-sys-motion-easing-emphasized-decelerate` / `-standard`), not Framer's own
defaults layered on top — a dialog materialising should move like the rest of the app.

- **Dialog** ([Surfaces.tsx](FE/Microfrontend/shared/src/ui/Surfaces.tsx)) — scrim fades,
  card scales up from 0.92 with a slight rise, M3's emphasized-decelerate curve.
- **Snackbar** — slides up on mount, used for real "User created" / "\<name\> was
  deleted" confirmations after a mutation, not left as an unused component.
- **UserTable rows** — `AnimatePresence` + `layout` fade rows in/out as search/filter/sort
  changes the result set, instead of the list silently jumping between states.

### Rules that keep it working (Module Federation)

`@tanstack/react-query`, `zod`, and `framer-motion` are declared **singleton** MF shares
in all three `vite.config.ts` files, for the same reason `react`/`react-dom` already are:
each one's *value* crosses the federation boundary through React context or an
`instanceof` check, and two module instances silently break that.

- **react-query** — the host's `<QueryClientProvider>` has to be the same module a
  remote's `useQuery()` looks up, or the remote falls back to "no QueryClient set".
- **zod** — `ApiError` handling does `err instanceof ApiError`, and DTO validation lives
  behind `z.ZodType` checks; two zod instances make those silently false.
- **framer-motion** — `AnimatePresence` coordinates exit animations through its own
  context; a dialog exposed by a remote needs the same instance the host uses.

`react-hook-form` and `@tanstack/react-table` are **not** singletons — every form and
table owns its instance locally, nothing about them crosses the federation boundary
through context.
