import { mkdtempSync, rmSync } from "node:fs";
import { createDatabase, type DatabaseConnection } from "../db/connection";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { diaryLogs, foods, users } from "../db/schema";
import { describe, expect, it } from 'vitest';
import { createFoodAndLog } from "./create-food-and-log";
import { eq } from "drizzle-orm";

const clientMutationId = '550e8400-e29b-41d4-a716-446655440000';

function withMigratedDatabase(
  run: (connection: DatabaseConnection) => void
): void {
  const directory = mkdtempSync(
    join(tmpdir(), 'calories-workflow-')
  );

  const connection = createDatabase(
    join(directory, 'test.db')
  );

  try {
    migrate(connection.db, { migrationsFolder: 'drizzle' });

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
    .returning({
      id: users.id
    })
    .get().id;
}

describe('createFoodAndLog', () => {
  it('atomically inserts a food and its first diary snapshot', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);

      const result = createFoodAndLog(
        connection.db,
        userId,
        {
          name: '5% Lean Steak Mince',
          brand: 'Tesco',
          amountUnit: 'mg',
          basisAmount: '250',
          energyKcal: '342',
          proteinG: '52.5',
          carbsG: '0',
          fatG: '12.5'
        },
        {
          clientMutationId,
          portionKind: 'hundred',
          portionCount: '1.5',
          diaryDate: '2026-07-12',
          mealSlot: 'lunch'
        }
      );

      expect(result.food).toEqual(
        expect.objectContaining({
          userId,
          name: '5% Lean Steak Mince',
          basisAmount: 250_000,
          energyMkcalPerBasis: 342_000
        })
      );

      expect(result.diaryLog).toEqual(
        expect.objectContaining({
          userId,
          foodId: result.food.id,
          diaryDate: '2026-07-12',
          mealSlot: 'lunch',
          resolvedAmount: 150_000,
          energyMkcal: 205_200,
          proteinMg: 31_500,
          carbsMg: 0,
          fatMg: 7_500
        })
      );

      expect(
        connection.db
          .select()
          .from(foods)
          .where(eq(foods.userId, userId))
          .all()
      ).toHaveLength(1);

      expect(
        connection.db
          .select()
          .from(diaryLogs)
          .where(eq(diaryLogs.userId, userId))
          .all()
      ).toHaveLength(1);
    });
  });

  it('rolls back the food when diary creation fails', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);

      expect(() =>
        createFoodAndLog(
          connection.db,
          userId,
          {
            name: 'Food without serving',
            amountUnit: 'mg',
            basisAmount: '100',
            servingAmount: '',
            energyKcal: '100',
            proteinG: '10',
            carbsG: '10',
            fatG: '2'
          },
          {
            clientMutationId,
            portionKind: 'serving',
            portionCount: '1',
            diaryDate: '2026-07-12',
            mealSlot: 'breakfast'
          }
        )
      ).toThrow(
        new RangeError(
          'Food does not define a serving amount'
        )
      );

      expect(
        connection.db
          .select()
          .from(foods)
          .where(eq(foods.userId, userId))
          .all()
      ).toHaveLength(0);

      expect(
        connection.db
          .select()
          .from(diaryLogs)
          .where(eq(diaryLogs.userId, userId))
          .all()
      ).toHaveLength(0);
    });
  });

  it('stores the food under only the supplied user', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);

      const otherUserId = connection.db
        .insert(users)
        .values({
          name: 'Other',
          email: 'other@example.com'
        })
        .returning({
          id: users.id
        })
        .get().id;

      createFoodAndLog(
        connection.db,
        userId,
        {
          name: 'Banana',
          amountUnit: 'mg',
          basisAmount: '100',
          energyKcal: '89',
          proteinG: '1.1',
          carbsG: '22.8',
          fatG: '0.3'
        },
        {
          clientMutationId,
          portionKind: 'hundred',
          portionCount: '1',
          diaryDate: '2026-07-12',
          mealSlot: 'snacks'
        }
      );

      expect(
        connection.db
          .select()
          .from(foods)
          .where(eq(foods.userId, otherUserId))
          .all()
      ).toHaveLength(0);

      expect(
        connection.db
          .select()
          .from(diaryLogs)
          .where(eq(diaryLogs.userId, otherUserId))
          .all()
      ).toHaveLength(0);
    });
  });

  it('returns the original result when the mutation is retried', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);

      const foodInput = {
        name: 'Greek yogurt',
        amountUnit: 'mg',
        basisAmount: '100',
        energyKcal: '65',
        proteinG: '10',
        carbsG: '3.5',
        fatG: '0.8'
      };

      const logInput = {
        clientMutationId,
        portionKind: 'hundred',
        portionCount: '2',
        diaryDate: '2026-07-12',
        mealSlot: 'breakfast'
      } as const;

      const firstResult = createFoodAndLog(
        connection.db,
        userId,
        foodInput,
        logInput
      );

      const replayedResult = createFoodAndLog(
        connection.db,
        userId,
        foodInput,
        logInput
      );

      expect(replayedResult.food.id).toBe(
        firstResult.food.id
      );

      expect(replayedResult.diaryLog.id).toBe(
        firstResult.diaryLog.id
      );

      expect(
        connection.db
          .select()
          .from(foods)
          .where(eq(foods.userId, userId))
          .all()
      ).toHaveLength(1);

      expect(
        connection.db
          .select()
          .from(diaryLogs)
          .where(eq(diaryLogs.userId, userId))
          .all()
      ).toHaveLength(1);
    });
  });
});
