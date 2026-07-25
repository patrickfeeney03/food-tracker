import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import {
  createDatabase,
  type DatabaseConnection
} from '$lib/server/db/connection';
import {
  diaryLogs,
  foods,
  nutritionGoals,
  users,
  type Food,
  type User
} from '$lib/server/db/schema';
import { buildDiaryLogValues } from '$lib/server/nutrition/diary-entry';
import { buildOfflineBootstrap } from './bootstrap';

function withMigratedDatabase(
  run: (connection: DatabaseConnection) => void
): void {
  const directory = mkdtempSync(
    join(tmpdir(), 'calories-offline-bootstrap-')
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
  connection: DatabaseConnection,
  name: string,
  email: string
): User {
  return connection.db
    .insert(users)
    .values({ name, email })
    .returning()
    .get();
}

function insertFood(
  connection: DatabaseConnection,
  userId: string,
  values: {
    name: string;
    deletedAt?: Date;
  }
): Food {
  return connection.db
    .insert(foods)
    .values({
      userId,
      name: values.name,
      brand: 'Test brand',
      barcode: null,
      amountUnit: 'mg',
      basisAmount: 250_000,
      servingAmount: 125_000,
      containerAmount: 500_000,
      energyMkcalPerBasis: 342_000,
      proteinMgPerBasis: 52_500,
      carbsMgPerBasis: 1_000,
      fatMgPerBasis: 12_500,
      additionalNutritionJson: {
        fibreMg: 4_000,
        sodiumMg: 350
      },
      notes: 'Full food snapshot',
      deletedAt: values.deletedAt
    })
    .returning()
    .get();
}

function insertDiaryEntry(
  connection: DatabaseConnection,
  food: Food,
  values: {
    diaryDate: string;
    portionKind: 'hundred' | 'serving';
    portionCount: string;
    loggedAt: Date;
    deletedAt?: Date;
  }
): void {
  connection.db
    .insert(diaryLogs)
    .values({
      ...buildDiaryLogValues(food, {
        clientMutationId: crypto.randomUUID(),
        diaryDate: values.diaryDate,
        mealSlot: 'breakfast',
        portionKind: values.portionKind,
        portionCount: values.portionCount
      }),
      loggedAt: values.loggedAt,
      deletedAt: values.deletedAt
    })
    .run();
}

describe('buildOfflineBootstrap', () => {
  it('returns a complete user-scoped diary and every active food', () => {
    withMigratedDatabase((connection) => {
      const user = insertUser(
        connection,
        'Patrick',
        'patrick@example.com'
      );
      const otherUser = insertUser(
        connection,
        'Other',
        'other@example.com'
      );
      const savedAt = new Date(
        '2026-07-24T12:30:00.000Z'
      );

      connection.db
        .insert(nutritionGoals)
        .values({
          userId: user.id,
          effectiveFrom: '2026-07-01',
          targetEnergyMkcal: 2_500_000,
          targetProteinMg: 200_000,
          targetCarbsMg: 300_000,
          targetFatMg: 90_000
        })
        .run();

      const usedFood = insertFood(
        connection,
        user.id,
        { name: 'Used food' }
      );

      for (let index = 0; index < 51; index += 1) {
        insertFood(connection, user.id, {
          name: `Unused food ${index.toString().padStart(2, '0')}`
        });
      }

      insertFood(connection, user.id, {
        name: 'Archived food',
        deletedAt: new Date('2026-07-20T00:00:00.000Z')
      });
      insertFood(connection, otherUser.id, {
        name: 'Other user food'
      });

      insertDiaryEntry(connection, usedFood, {
        diaryDate: '2026-07-20',
        portionKind: 'hundred',
        portionCount: '1',
        loggedAt: new Date('2026-07-20T08:00:00.000Z')
      });
      insertDiaryEntry(connection, usedFood, {
        diaryDate: '2026-07-24',
        portionKind: 'serving',
        portionCount: '2',
        loggedAt: new Date('2026-07-24T08:00:00.000Z')
      });
      insertDiaryEntry(connection, usedFood, {
        diaryDate: '2026-07-25',
        portionKind: 'hundred',
        portionCount: '3',
        loggedAt: new Date('2026-07-25T08:00:00.000Z'),
        deletedAt: new Date('2026-07-25T09:00:00.000Z')
      });

      const result = buildOfflineBootstrap(
        connection.db,
        user,
        '2026-07-24',
        savedAt
      );

      expect(result).toMatchObject({
        schemaVersion: 1,
        user: {
          id: user.id,
          name: 'Patrick'
        },
        savedAt: savedAt.getTime(),
        diary: {
          date: '2026-07-24',
          goal: {
            effectiveFrom: '2026-07-01',
            targetEnergyMkcal: 2_500_000
          },
          totals: {
            energyMkcal: 342_000,
            proteinMg: 52_500,
            carbsMg: 1_000,
            fatMg: 12_500
          }
        }
      });
      expect(result.diary.meals.breakfast.entries).toHaveLength(1);
      expect(result.diary.meals.breakfast.entries[0]).toMatchObject({
        foodId: usedFood.id,
        foodName: 'Used food',
        portionKind: 'serving',
        portionAmount: 125_000,
        portionCountMilli: 2_000,
        resolvedAmount: 250_000,
        additionalNutritionPerBasis: {
          fibreMg: 4_000,
          sodiumMg: 350
        },
        additionalNutritionTotal: {
          fibreMg: 4_000,
          sodiumMg: 350
        },
        loggedAt: '2026-07-24T08:00:00.000Z'
      });
      expect(result.diary.meals.lunch.entries).toEqual([]);
      expect(result.foods).toHaveLength(52);
      expect(result.foods.map((food) => food.name)).not.toContain(
        'Archived food'
      );
      expect(result.foods.map((food) => food.name)).not.toContain(
        'Other user food'
      );

      const offlineFood = result.foods.find(
        (food) => food.id === usedFood.id
      );
      expect(offlineFood).toMatchObject({
        brand: 'Test brand',
        basisAmount: 250_000,
        servingAmount: 125_000,
        containerAmount: 500_000,
        energyMkcalPerBasis: 342_000,
        proteinMgPerBasis: 52_500,
        carbsMgPerBasis: 1_000,
        fatMgPerBasis: 12_500,
        additionalNutrition: {
          fibreMg: 4_000,
          sodiumMg: 350
        },
        notes: 'Full food snapshot',
        latestUse: {
          loggedAt: '2026-07-24T08:00:00.000Z',
          portionKind: 'serving',
          portionAmount: 125_000,
          portionCountMilli: 2_000,
          resolvedAmount: 250_000,
          energyMkcal: 342_000
        }
      });
    });
  });
});
