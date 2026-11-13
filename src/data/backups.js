const STORAGE_KEY = "pc-trader-backup-history-v1";
const MAX_BACKUPS = 20;

export function readBackups() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isValidBackup).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  } catch {
    return [];
  }
}

export function isValidBackup(backup) {
  const state = backup?.state;
  return backup?.version === 1 && typeof backup.createdAt === "string" &&
    state && typeof state === "object" && Array.isArray(state.parts) &&
    Array.isArray(state.bundles) && Array.isArray(state.builds) &&
    Array.isArray(state.sales) && Array.isArray(state.expenses) &&
    Array.isArray(state.transactions) && Number.isFinite(Number(state.businessCash));
}

export function saveBackup(state) {
  const backup = { version: 1, createdAt: new Date().toISOString(), state };
  const backups = [backup, ...readBackups()].slice(0, MAX_BACKUPS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(backups));
  return backup;
}
