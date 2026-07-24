import {
  deleteExpiredAuthTransactions,
  expireAuthTransactions,
  getAuthzPool,
} from "@idnest/authz-store";
import { getAuthzDatabaseUrl } from "./config";

const MAINTENANCE_INTERVAL_MS = 5 * 60 * 1000;

async function maintain(): Promise<void> {
  const db = getAuthzPool(getAuthzDatabaseUrl());
  if (!db) return;
  try {
    await expireAuthTransactions(db);
    await deleteExpiredAuthTransactions(db, 7);
  } catch (error) {
    console.error("Authentication transaction maintenance failed", error);
  }
}

/** Expire pending records promptly and purge seven-day-old transaction data. */
export function startAuthTransactionMaintenance(): void {
  void maintain();
  const timer = setInterval(() => void maintain(), MAINTENANCE_INTERVAL_MS);
  timer.unref();
}
