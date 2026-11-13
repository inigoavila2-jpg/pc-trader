const STORAGE_KEY = "pc-trader-backup-history-v1";
const MAX_BACKUPS = 20;
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_BACKUP_JSON_BYTES = 50 * 1024 * 1024;

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

export async function downloadBackup(backup) {
  const JSZip = (await import("jszip")).default;
  const archive = new JSZip();
  archive.file("pc-trader-backup.json", JSON.stringify(backup, null, 2));
  return archive.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export async function readBackupArchive(file) {
  if (!file?.name?.toLowerCase().endsWith(".zip")) throw new Error("Choose a .zip backup file.");
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("This ZIP is larger than the 25 MB import limit.");
  const JSZip = (await import("jszip")).default;
  const archive = await JSZip.loadAsync(file, { checkCRC32: true });
  const entry = archive.file("pc-trader-backup.json");
  if (!entry || entry._data?.uncompressedSize > MAX_BACKUP_JSON_BYTES) {
    throw new Error("This ZIP does not contain a supported PC Trader backup.");
  }
  let backup;
  try {
    backup = JSON.parse(await entry.async("string"));
  } catch {
    throw new Error("The backup file is damaged or is not valid JSON.");
  }
  if (!isValidBackup(backup)) throw new Error("The ZIP does not contain valid PC Trader data.");
  return backup;
}
