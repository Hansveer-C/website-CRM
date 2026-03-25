# Website-CRM Architecture

## Boundary Enforcement: Server-Only Modules

To ensure production security and prevent the exposure of administrative credentials (like the Supabase `service_role` key), this project enforces a strict boundary between Frontend and Backend code.

### 🛡️ The Server-Only Layer
The following directories and files are classified as **Server-Only**. They may contain sensitive logic, database connection strings, or libraries that only work in a Node.js environment (e.g., `better-sqlite3`, `twilio`, `jsonwebtoken`).

- **Repositories**: `src/*_repo.ts`
- **Database Utilities**: `src/utils/db/*`, `src/database.ts`
- **Logic Engines**: `src/sms_logic.ts`, `src/leads_logic.ts`, `src/automation.ts`
- **Services**: `src/smsService.ts`
- **API Controllers**: `src/*_api.ts`

**Rule**: These files must **NEVER** be imported into any file that is bundled for the browser (e.g., `src/main.ts`, component files, or site-level UI).

### 🌐 The Frontend Layer
The frontend resides in `src/main.ts` and associated UI components. It is strictly limited to:
- Rendering HTML/CSS.
- Managing client-side state.
- Communicating with the backend exclusively via the **`/api/*`** HTTP layer.

### 🌉 The API Bridge
The boundary is bridged by HTTP requests.
- **Frontend**: Calls `fetch('/api/request')`.
- **Backend (Mock Interceptor)**: In development, `main.ts` uses an interceptor to route `/api` calls. **However, this must only be used for testing.** In production, a real server (fastify/express) resolves these routes by calling the Repositories.

### 🔒 Multi-tenancy
All backend repositories enforce `user_id` scoping. Even if a backend module is called, it must receive a `userId` from the authentication session to prevent data leakage between users.
