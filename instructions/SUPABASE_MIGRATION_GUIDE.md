# Supabase + Render Migration Guide for pc-trader

This guide migrates the app from a PocketBase + Railway setup to a Supabase + Render setup while keeping the current Express + Vite architecture intact.

## 1. Target architecture

- Frontend: Vite + React
- Backend: Express API
- Database/auth/storage: Supabase
- Hosting: Render

Recommended deployment shape:
- Option A (simplest): one Render Web Service for the Express app, which also serves the built frontend.
- Option B (cleaner): one Render Web Service for the backend API and one Render Static Site for the frontend.

---

## 2. Supabase project setup

### 2.1 Create the Supabase project

1. Go to https://supabase.com and create a new project.
2. Note the following values from the Supabase dashboard:
   - Project URL
   - Anonymous key
   - Service role key
3. Create a new storage bucket if you plan to store images or uploads.

### 2.2 Create the database tables

Use the SQL Editor in Supabase to create the tables you need.

### Recommended tables

#### store
```sql
create table if not exists public.store (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### photos
```sql
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  record_id text,
  url text not null,
  created_at timestamptz default now()
);
```

#### chat_messages
```sql
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);
```

### 2.3 Enable Row Level Security (RLS)

Enable RLS on each table.

Example policies:

```sql
alter table public.store enable row level security;
alter table public.photos enable row level security;
alter table public.chat_messages enable row level security;
```

A simple starting point is to allow the server-side service role full access and let authenticated users read/write only their own rows.

Example policy for chat messages:
```sql
create policy "Users can manage own chat messages"
on public.chat_messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

If you want the backend to manage all rows, use the service role key on the server and keep the browser client limited to the anon/authenticated flow.

### 2.4 Create a storage bucket

1. Open Storage in the Supabase dashboard.
2. Create a bucket such as `photos`.
3. Set the bucket to public if the frontend should load image URLs directly.
4. Add policies so the service role can upload and delete files.

### 2.5 Copy the credentials

Copy the following values into your environment variables:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

---

## 3. Codebase updates

### 3.1 Install the SDKs

From the project root:

```bash
npm install @supabase/supabase-js cors
```

### 3.2 Replace PocketBase environment variables

Remove or stop relying on the old PocketBase variables and replace them with Supabase values.

Use these variables:

```env
# Frontend
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend / server
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Render and local CORS
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

### 3.3 Create a Supabase client helper

Create a frontend helper such as `src/lib/supabaseClient.js`:

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 3.4 Update the Express server

Replace the PocketBase-specific auth and proxy logic with Supabase calls.

Example:

```js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

Then use the client for the existing data routes:

```js
const { data, error } = await supabase.from('store').select('data').limit(1).single();
```

For uploads, use the Supabase Storage API rather than PocketBase file endpoints.

### 3.5 Update the chat history hook

Replace the PocketBase-based read/write logic with Supabase queries such as:

```js
const { data, error } = await supabase
  .from('chat_messages')
  .select('*')
  .order('created_at', { ascending: true });
```

Insert new messages with:

```js
await supabase.from('chat_messages').insert([{ role, content, user_id: user?.id ?? null }]);
```

### 3.6 Add CORS handling

In the Express server, enable CORS for your frontend origin:

```js
const cors = require('cors');

app.use(cors({
  origin: [process.env.FRONTEND_URL, process.env.CORS_ORIGIN, 'http://localhost:5173'],
  credentials: true,
}));
```

---

## 4. Render deployment

### 4.1 Create the backend service

1. In Render, create a new Web Service.
2. Connect your GitHub repository.
3. Choose the root folder of the app.
4. Set the build command:

```bash
npm install && npm run build
```

5. Set the start command:

```bash
node server.js
```

### 4.2 Set environment variables on Render

Add these variables in the Render dashboard:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- FRONTEND_URL
- CORS_ORIGIN
- PORT (Render usually sets this automatically)

### 4.3 Configure the frontend

If you deploy the frontend separately:
- Create a Static Site on Render.
- Set the publish directory to `dist`.
- Add the same Vite environment variables:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY

If you keep the frontend and API in one Express service:
- Build the React app during deploy.
- Serve the built files from the Express server.

### 4.4 Health check

Set a health check endpoint such as:

```text
/health
```

Render will use this to verify the service is up.

---

## 5. Data migration strategy

### 5.1 Export from PocketBase

Export the existing data from PocketBase using the admin API or a temporary script.

Typical data to export:
- app state from the existing `store` record
- uploaded image metadata and file URLs
- chat history if you want it preserved

### 5.2 Transform the data

Map the PocketBase data into Supabase-friendly structures:
- Store the main app JSON in the `store.data` JSONB column.
- Store photo metadata in `photos`.
- Store chat messages in `chat_messages`.

### 5.3 Import into Supabase

Use a one-off Node.js script or a temporary admin script to insert the exported records into Supabase.

### 5.4 Migrate authentication

Authentication migration is the hardest part because PocketBase and Supabase use different auth systems.

Recommended approaches:
1. Best option: allow users to reset passwords and sign up again in Supabase.
2. If you need to preserve accounts, export the user list from PocketBase and create matching accounts in Supabase using a migration script or invite flow.
3. If the app is mostly single-user or internal, you can keep auth simple and re-create users manually.

### 5.5 Validate the migration

After import:
- Check record counts.
- Confirm RLS policies allow the expected operations.
- Test login, save, load, and image uploads.
- Confirm the frontend can read and write data from the Render deployment.

---

## 6. Recommended rollout order

1. Create the Supabase project and tables.
2. Add the Supabase SDK and environment variables.
3. Switch the server from PocketBase to Supabase.
4. Switch the frontend chat/history logic to Supabase.
5. Deploy to Render.
6. Run the data migration.
7. Verify auth, storage, and app behavior.

---

## 7. Quick checklist

- [ ] Supabase project created
- [ ] Tables created
- [ ] RLS policies configured
- [ ] Storage bucket created
- [ ] Environment variables added
- [ ] Frontend client created
- [ ] Express server updated
- [ ] Render service configured
- [ ] Data imported
- [ ] Auth migration completed
