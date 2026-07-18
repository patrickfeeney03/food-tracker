import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import { logFoodInputSchema } from '$lib/nutrition/portion-input';
import {
  createDatabase,
  type DatabaseConnection
} from '$lib/server/db/connection';
import {
  diaryLogs,
  foods,
  users,
  type Food
} from '$lib/server/db/schema';
import { buildDiaryLogValues } from './diary-entry';
import {
  findActiveFoodByBarcode,
  listActiveFoods
} from './food-catalogue';

function withMigratedDatabase(
  run: (connection: DatabaseConnection) => void
): void {
  const directory = mkdtempSync(
    join(tmpdir(), 'calories-food-catalogue-')
  );
  const connection = createDatabase(
    join(directory, 'test.db')
  );

  try {
    migrate(connection.db, {
      migrationsFolder: 'drizzle'
    });
    run(connection);
  } finally {
    connection.client.close();
    rmSync(directory, {
      recursive: true,
      force: true
    });
  }
}

function insertUser(
  connection: DatabaseConnection
): string {
  return connection.db
    .insert(users)
    .values({
      name: 'Patrick',
      email: 'patrick@example.com'
    })
    .returning({ id: users.id })
    .get().id;
}

function insertFood(
  connection: DatabaseConnection,
  userId: string,
  name: string,
  barcode?: string
): Food {
  return connection.db
    .insert(foods)
    .values({
      userId,
      name,
      barcode,
      amountUnit: 'mg',
      basisAmount: 100_000,
      energyMkcalPerBasis: 100_000,
      proteinMgPerBasis: 10_000,
      carbsMgPerBasis: 20_000,
      fatMgPerBasis: 5_000
    })
    .returning()
    .get();
}

describe('listActiveFoods', () => {
  it('finds an exact barcode only in the active user catalogue', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const otherUserId = connection.db
        .insert(users)
        .values({
          name: 'Another user',
          email: 'other@example.com'
        })
        .returning({ id: users.id })
        .get().id;

      const matchingFood = insertFood(
        connection,
        userId,
        'Own barcode match',
        '0012345678905'
      );
      insertFood(
        connection,
        otherUserId,
        'Other user barcode match',
        '0012345678905'
      );

      const result = findActiveFoodByBarcode(
        connection.db,
        userId,
        '0012345678905'
      );

      expect(result).toMatchObject({
        id: matchingFood.id,
        barcode: '0012345678905'
      });
    });
  });

  it('orders by latest use before applying the result limit', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);

      for (let index = 0; index < 50; index += 1) {
        insertFood(
          connection,
          userId,
          `Food ${index.toString().padStart(2, '0')}`
        );
      }

      const recentlyUsedFood = insertFood(
        connection,
        userId,
        'Zulu recent'
      );
      const logInput = logFoodInputSchema.parse({
        clientMutationId:
          '550e8400-e29b-41d4-a716-446655440000',
        portionKind: 'hundred',
        portionCount: '1.25',
        diaryDate: '2026-07-16',
        mealSlot: 'lunch'
      });

      connection.db
        .insert(diaryLogs)
        .values({
          ...buildDiaryLogValues(
            recentlyUsedFood,
            logInput
          ),
          loggedAt: new Date(
            '2026-07-16T12:00:00Z'
          )
        })
        .run();

      const results = listActiveFoods(
        connection.db,
        userId,
        '',
        50
      );

      expect(results).toHaveLength(50);
      expect(results[0]).toMatchObject({
        id: recentlyUsedFood.id,
        name: 'Zulu recent',
        latestUse: {
          resolvedAmount: 125_000,
          amountUnit: 'mg',
          energyMkcal: 125_000
        }
      });
    });
  });
});
