// setup-db.js — run once to create the database structure
const PB_URL = process.env.PB_URL || "http://localhost:8090";
const PB_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_PASS = process.env.PB_ADMIN_PASS;

async function setup() {
  if (!PB_EMAIL || !PB_PASS) {
    console.error("Missing PB_ADMIN_EMAIL or PB_ADMIN_PASS environment variables.");
    process.exit(1);
  }

  // Login as superuser (PocketBase v0.23+ uses the _superusers auth collection,
  // not the old /api/admins endpoint)
  const login = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS })
  });

  if (!login.ok) {
    const errText = await login.text();
    console.error(`Login failed (${login.status}):`, errText);
    process.exit(1);
  }

  const { token } = await login.json();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // Check if the "store" collection already exists (setup-db.js may be re-run)
  const existing = await fetch(`${PB_URL}/api/collections/store`, { headers });
  if (existing.ok) {
    console.log('Collection "store" already exists — skipping creation ✓');
    return;
  }

  // Create a single "store" collection with one JSON field
  // Note: modern PocketBase uses "fields", not the old "schema" key
  const create = await fetch(`${PB_URL}/api/collections`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "store",
      type: "base",
      fields: [
        { name: "data", type: "json", required: true }
      ]
    })
  });

  if (!create.ok) {
    const errText = await create.text();
    console.error(`Collection creation failed (${create.status}):`, errText);
    process.exit(1);
  }

  console.log("Database ready ✓");
}

setup().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
