import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/connection';
import {
  authAccounts,
  diaryLogs,
  foods,
  mealShortcutItems,
  mealShortcuts,
  nutritionGoals,
  sessions,
  users,
  type NewDiaryLog
} from '$lib/server/db/schema';
import {
  buildDiaryCsvExport,
  buildPortableDataExport
} from './data-export';

function withMigratedDatabase(run: (connection: DatabaseConnection) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'calories-export-'));
  const connection = createDatabase(join(directory, 'test.db'));

  try {
    migrate(connection.db, { migrationsFolder: 'drizzle' });
    run(connection);
  } finally {
    connection.client.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

const baseTime = new Date('2026-07-20T07:00:00.000Z');

function insertUser(connection: DatabaseConnection, id: string, email: string): void {
  connection.db
    .insert(users)
    .values({
      id,
      name: id === 'user-a' ? 'Patrick' : 'Other user',
      email,
      settingsJson: { theme: 'dark' },
      createdAt: baseTime,
      updatedAt: baseTime
    })
    .run();
}

function diaryEntry(
  overrides: Partial<NewDiaryLog> & Pick<NewDiaryLog, 'id' | 'userId' | 'foodId' | 'foodName'>
): NewDiaryLog {
  return {
    diaryDate: '2026-07-20',
    mealSlot: 'lunch',
    clientMutationId: `mutation-${overrides.id}`,
    clientRequestFingerprint: `fingerprint-${overrides.id}`,
    foodBrand: null,
    amountUnit: 'mg',
    basisAmount: 100_000,
    energyMkcalPerBasis: 62_500,
    proteinMgPerBasis: 10_000,
    carbsMgPerBasis: 4_000,
    fatMgPerBasis: 500,
    additionalNutritionPerBasisJson: null,
    portionKind: 'hundred',
    portionLabel: '100 g',
    portionAmount: 100_000,
    portionCountMilli: 1_000,
    resolvedAmount: 100_000,
    energyMkcal: 62_500,
    proteinMg: 10_000,
    carbsMg: 4_000,
    fatMg: 500,
    additionalNutritionTotalJson: null,
    loggedAt: baseTime,
    createdAt: baseTime,
    updatedAt: baseTime,
    deletedAt: null,
    ...overrides
  };
}

function seedExportData(connection: DatabaseConnection): void {
  insertUser(connection, 'user-a', 'patrick@example.com');
  insertUser(connection, 'user-b', 'other@example.com');

  connection.db
    .insert(authAccounts)
    .values({
      id: 'auth-a',
      userId: 'user-a',
      provider: 'google',
      providerSubject: 'secret-provider-subject',
      emailAtLink: 'patrick@example.com',
      createdAt: baseTime
    })
    .run();

  connection.db
    .insert(sessions)
    .values({
      id: 'session-a',
      userId: 'user-a',
      tokenHash: 'secret-session-token-hash',
      createdAt: baseTime,
      lastSeenAt: baseTime,
      expiresAt: new Date('2026-10-20T07:00:00.000Z'),
      userAgent: 'Export test'
    })
    .run();

  connection.db
    .insert(nutritionGoals)
    .values({
      id: 'goal-a',
      userId: 'user-a',
      effectiveFrom: '2026-01-01',
      targetEnergyMkcal: 2_123_456,
      targetProteinMg: 150_250,
      targetCarbsMg: 250_000,
      targetFatMg: 70_000,
      createdAt: baseTime,
      updatedAt: baseTime
    })
    .run();

  connection.db
    .insert(foods)
    .values([
      {
        id: 'food-a',
        userId: 'user-a',
        name: '=SUM(1,1)',
        brand: 'Brand, "Quoted"\nLine',
        amountUnit: 'mg',
        basisAmount: 100_000,
        servingAmount: 125_000,
        energyMkcalPerBasis: 62_500,
        proteinMgPerBasis: 10_000,
        carbsMgPerBasis: 4_000,
        fatMgPerBasis: 500,
        additionalNutritionJson: { fibreMg: 1_500, sodiumMg: 230 },
        notes: 'Breakfast option',
        createdAt: baseTime,
        updatedAt: baseTime
      },
      {
        id: 'food-archived',
        userId: 'user-a',
        name: 'Archived drink',
        amountUnit: 'ul',
        basisAmount: 250_000,
        energyMkcalPerBasis: 120_000,
        proteinMgPerBasis: 1_000,
        carbsMgPerBasis: 25_000,
        fatMgPerBasis: 0,
        createdAt: new Date('2026-07-20T08:00:00.000Z'),
        updatedAt: new Date('2026-07-20T08:00:00.000Z'),
        deletedAt: new Date('2026-07-21T08:00:00.000Z')
      },
      {
        id: 'food-other',
        userId: 'user-b',
        name: 'Other private food',
        amountUnit: 'mg',
        basisAmount: 100_000,
        energyMkcalPerBasis: 100_000,
        proteinMgPerBasis: 1_000,
        carbsMgPerBasis: 1_000,
        fatMgPerBasis: 1_000,
        createdAt: baseTime,
        updatedAt: baseTime
      }
    ])
    .run();

  connection.db
    .insert(diaryLogs)
    .values([
      diaryEntry({
        id: 'entry-lunch',
        userId: 'user-a',
        foodId: 'food-a',
        foodName: '=SUM(1,1)',
        foodBrand: 'Brand, "Quoted"\nLine',
        additionalNutritionPerBasisJson: { fibreMg: 1_500, sodiumMg: 230 },
        additionalNutritionTotalJson: { fibreMg: 1_500, sodiumMg: 230 },
        loggedAt: new Date('2026-07-20T08:00:00.000Z')
      }),
      diaryEntry({
        id: 'entry-breakfast',
        userId: 'user-a',
        foodId: 'food-archived',
        foodName: 'Water',
        mealSlot: 'breakfast',
        amountUnit: 'ul',
        basisAmount: 1_000,
        energyMkcalPerBasis: 0,
        proteinMgPerBasis: 0,
        carbsMgPerBasis: 0,
        fatMgPerBasis: 0,
        portionKind: 'unit',
        portionLabel: '1 ml',
        portionAmount: 1_000,
        portionCountMilli: 1_500,
        resolvedAmount: 1_500,
        energyMkcal: 0,
        proteinMg: 0,
        carbsMg: 0,
        fatMg: 0,
        loggedAt: new Date('2026-07-20T09:00:00.000Z')
      }),
      diaryEntry({
        id: 'entry-deleted',
        userId: 'user-a',
        foodId: 'food-a',
        foodName: 'Deleted entry',
        diaryDate: '2026-07-19',
        deletedAt: new Date('2026-07-21T10:00:00.000Z')
      }),
      diaryEntry({
        id: 'entry-other',
        userId: 'user-b',
        foodId: 'food-other',
        foodName: 'Other private entry'
      })
    ])
    .run();

  connection.db
    .insert(mealShortcuts)
    .values({
      id: 'shortcut-a',
      userId: 'user-a',
      name: 'Old breakfast',
      clientMutationId: 'secret-shortcut-mutation',
      createdAt: baseTime,
      updatedAt: baseTime,
      deletedAt: new Date('2026-07-21T11:00:00.000Z')
    })
    .run();

  connection.db
    .insert(mealShortcutItems)
    .values({
      id: 'shortcut-item-a',
      userId: 'user-a',
      shortcutId: 'shortcut-a',
      foodId: 'food-a',
      amountUnit: 'mg',
      position: 0,
      defaultAmount: 125_000,
      defaultPortionKind: 'serving',
      defaultPortionLabel: 'Serving',
      defaultPortionAmount: 125_000,
      defaultPortionCountMilli: 1_000
    })
    .run();
}

describe('data export', () => {
  it('builds an owned, lossless JSON archive without auth or retry data', () => {
    withMigratedDatabase((connection) => {
      seedExportData(connection);
      const exportedAt = new Date('2026-07-22T12:34:56.000Z');
      const result = buildPortableDataExport(connection.db, 'user-a', exportedAt);

      expect(result).toMatchObject({
        formatVersion: 1,
        exportedAt: '2026-07-22T12:34:56.000Z',
        timezone: 'Europe/Dublin',
        account: {
          id: 'user-a',
          name: 'Patrick',
          email: 'patrick@example.com',
          theme: 'dark'
        }
      });
      expect(result.foods).toHaveLength(2);
      expect(result.foods[0]).toMatchObject({
        id: 'food-a',
        basisAmount: {
          storageValue: 100_000,
          storageUnit: 'mg',
          displayValue: '100',
          displayUnit: 'g'
        },
        nutritionPerBasis: {
          energy: { mkcal: 62_500, kcal: '62.5' },
          additional: {
            fibre: { mg: 1_500, g: '1.5' },
            sodium: { mg: 230, g: '0.23' }
          }
        }
      });
      expect(result.foods[1]).toMatchObject({
        id: 'food-archived',
        archivedAt: '2026-07-21T08:00:00.000Z'
      });
      expect(result.diaryEntries.map((entry) => entry.id)).toEqual([
        'entry-deleted',
        'entry-lunch',
        'entry-breakfast'
      ]);
      expect(result.diaryEntries[0].deletedAt).toBe('2026-07-21T10:00:00.000Z');
      expect(result.mealShortcuts[0]).toMatchObject({
        id: 'shortcut-a',
        archivedAt: '2026-07-21T11:00:00.000Z',
        items: [{
          id: 'shortcut-item-a',
          defaultAmount: { storageValue: 125_000, displayValue: '125' },
          defaultPortion: { count: { milli: 1_000, value: '1' } }
        }]
      });

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('Other private');
      expect(serialized).not.toContain('secret-provider-subject');
      expect(serialized).not.toContain('secret-session-token-hash');
      expect(serialized).not.toContain('secret-shortcut-mutation');
      expect(serialized).not.toContain('mutation-entry');
      expect(serialized).not.toContain('fingerprint-entry');
    });
  });

  it('builds an active-entry CSV with exact units, meal ordering, and safe escaping', () => {
    withMigratedDatabase((connection) => {
      seedExportData(connection);
      const result = buildDiaryCsvExport(connection.db, 'user-a');

      expect(result.diaryEntryCount).toBe(2);
      expect(result.content.startsWith('\uFEFFdiary_date,meal,food_name')).toBe(true);
      expect(result.content.indexOf('Breakfast,Water')).toBeLessThan(
        result.content.indexOf('Lunch,')
      );
      expect(result.content).toContain(
        '2026-07-20,Breakfast,Water,,unit,1 ml,1.5,1.5,ml,0,0,0,0,,,,,,2026-07-20T09:00:00.000Z'
      );
      expect(result.content).toContain('"\'=SUM(1,1)"');
      expect(result.content).toContain('"Brand, ""Quoted""\nLine"');
      expect(result.content).toContain(',62.5,10,4,0.5,1.5,,,230,,');
      expect(result.content).not.toContain('Deleted entry');
      expect(result.content).not.toContain('Other private entry');
      expect(result.content.endsWith('\r\n')).toBe(true);
    });
  });

  it('returns a header-only CSV for an empty diary', () => {
    withMigratedDatabase((connection) => {
      insertUser(connection, 'user-a', 'patrick@example.com');
      const result = buildDiaryCsvExport(connection.db, 'user-a');

      expect(result.diaryEntryCount).toBe(0);
      expect(result.content.split('\r\n')).toHaveLength(2);
    });
  });
});
