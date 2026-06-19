import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { systemSettings } from './settings.model';

// Default settings applied when a key doesn't exist yet
const DEFAULTS: Record<string, unknown> = {
  features: {
    registrationEnabled: true,
    trialDurationDays: 14,
    maintenanceMode: false,
    billingEnabled: true,
  },
  smtp: {
    host: '',
    port: 587,
    user: '',
    from: 'Mahalla OS <noreply@mahalla.uz>',
    ssl: false,
  },
  general: {
    siteName: 'Mahalla OS',
    supportEmail: 'support@mahalla.uz',
  },
};

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(systemSettings);
  const result: Record<string, unknown> = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key));
  return (row?.value ?? DEFAULTS[key] ?? {}) as T;
}

export async function upsertSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } });
}

export async function updateSettings(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  for (const [key, value] of Object.entries(patch)) {
    await upsertSetting(key, value);
  }
  return getAllSettings();
}
