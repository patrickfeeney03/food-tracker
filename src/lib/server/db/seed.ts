import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';
import { createDatabase } from './connection';
import type { MealSlot, PortionKind } from '../../nutrition/constants';
import {
  users,
  authAccounts,
  nutritionGoals,
  foods,
  mealShortcuts,
  mealShortcutItems,
  diaryLogs,
  type AdditionalNutrition
} from './schema';
import { scaleNutritionValue, divideRoundHalfUp } from '../../nutrition/math';
import { eq } from 'drizzle-orm';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const dbUrl = process.env.DATABASE_URL || 'local.db';
const userEmail = (process.env.GOOGLE_ALLOWED_EMAILS || 'patrickfeeneytamayo@gmail.com')
  .split(',')[0]
  .trim()
  .toLowerCase();
const userName = 'Patrick Feeney';

console.log(`🌱 Seeding database at "${dbUrl}" for user "${userEmail}"...`);

const { db, client } = createDatabase(dbUrl);

function scaleAdditional(
  basis?: AdditionalNutrition | null,
  resolvedAmount?: bigint,
  basisAmount?: bigint
): AdditionalNutrition | undefined {
  if (!basis || !resolvedAmount || !basisAmount) return undefined;
  const result: AdditionalNutrition = {};
  if (basis.fibreMg !== undefined) {
    result.fibreMg = Number(scaleNutritionValue(BigInt(basis.fibreMg), resolvedAmount, basisAmount));
  }
  if (basis.sugarMg !== undefined) {
    result.sugarMg = Number(scaleNutritionValue(BigInt(basis.sugarMg), resolvedAmount, basisAmount));
  }
  if (basis.saturatedFatMg !== undefined) {
    result.saturatedFatMg = Number(scaleNutritionValue(BigInt(basis.saturatedFatMg), resolvedAmount, basisAmount));
  }
  if (basis.sodiumMg !== undefined) {
    result.sodiumMg = Number(scaleNutritionValue(BigInt(basis.sodiumMg), resolvedAmount, basisAmount));
  }
  if (basis.potassiumMg !== undefined) {
    result.potassiumMg = Number(scaleNutritionValue(BigInt(basis.potassiumMg), resolvedAmount, basisAmount));
  }
  return result;
}

async function seed() {
  const now = new Date();

  // 1. Ensure user exists
  let user = db.select().from(users).where(eq(users.email, userEmail)).get();

  if (!user) {
    user = db
      .insert(users)
      .values({
        id: randomUUID(),
        name: userName,
        email: userEmail,
        settingsJson: { theme: 'system' },
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .get();

    db.insert(authAccounts)
      .values({
        id: randomUUID(),
        userId: user.id,
        provider: 'google',
        providerSubject: `google-${user.id}`,
        emailAtLink: userEmail,
        createdAt: now
      })
      .run();

    console.log(`👤 Created new user: ${user.name} (${user.id})`);
  } else {
    console.log(`👤 Found existing user: ${user.name} (${user.id})`);
  }

  const userId = user.id;

  // 2. Clear existing user data if requested via argument or wipe for clean seed
  const resetArg = process.argv.includes('--reset');
  if (resetArg) {
    console.log('🧹 Clearing existing user entries for clean re-seed...');
    db.delete(diaryLogs).where(eq(diaryLogs.userId, userId)).run();
    db.delete(mealShortcutItems).where(eq(mealShortcutItems.userId, userId)).run();
    db.delete(mealShortcuts).where(eq(mealShortcuts.userId, userId)).run();
    db.delete(foods).where(eq(foods.userId, userId)).run();
    db.delete(nutritionGoals).where(eq(nutritionGoals.userId, userId)).run();
  }

  // 3. Nutrition Goal
  const existingGoal = db.select().from(nutritionGoals).where(eq(nutritionGoals.userId, userId)).get();
  if (!existingGoal) {
    db.insert(nutritionGoals)
      .values({
        id: randomUUID(),
        userId,
        effectiveFrom: '2024-01-01',
        targetEnergyMkcal: 2_200_000, // 2200 kcal
        targetProteinMg: 160_000,     // 160 g
        targetCarbsMg: 220_000,       // 220 g
        targetFatMg: 70_000,          // 70 g
        createdAt: now,
        updatedAt: now
      })
      .run();
    console.log('🎯 Created default nutrition goal: 2200 kcal (160g P / 220g C / 70g F)');
  }

  // 4. Populate Food Library
  type SeedFood = {
    name: string;
    brand?: string;
    barcode?: string;
    amountUnit: 'mg' | 'ul';
    basisAmount: number; // in mg or ul
    servingAmount?: number;
    containerAmount?: number;
    energyMkcalPerBasis: number;
    proteinMgPerBasis: number;
    carbsMgPerBasis: number;
    fatMgPerBasis: number;
    additional?: AdditionalNutrition;
    notes?: string;
  };

  const foodCatalog: SeedFood[] = [
    {
      name: 'Rolled Porridge Oats',
      brand: 'Quaker Oats',
      barcode: '5010044000100',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 40_000, // 40g serving
      containerAmount: 1_000_000, // 1kg
      energyMkcalPerBasis: 366_000, // 366 kcal
      proteinMgPerBasis: 11_000, // 11g
      carbsMgPerBasis: 60_000, // 60g
      fatMgPerBasis: 6_900, // 6.9g
      additional: { fibreMg: 9_000, sugarMg: 1_000, saturatedFatMg: 1_200, sodiumMg: 0, potassiumMg: 350 },
      notes: 'Whole grain oat flakes. Great breakfast staple.'
    },
    {
      name: 'Greek Style Yogurt 0% Fat',
      brand: 'Fage Total',
      barcode: '5201051000021',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 170_000, // 170g pot
      containerAmount: 500_000, // 500g tub
      energyMkcalPerBasis: 54_000, // 54 kcal
      proteinMgPerBasis: 10_300, // 10.3g
      carbsMgPerBasis: 3_000, // 3.0g
      fatMgPerBasis: 0,
      additional: { fibreMg: 0, sugarMg: 3_000, saturatedFatMg: 0, sodiumMg: 40, potassiumMg: 140 },
      notes: 'Strained 0% fat Greek yoghurt. High protein.'
    },
    {
      name: 'Whole Fresh Milk',
      brand: 'Avonmore',
      barcode: '5099047000123',
      amountUnit: 'ul',
      basisAmount: 100_000, // 100 ml
      servingAmount: 200_000, // 200 ml glass
      containerAmount: 1_000_000, // 1 L bottle
      energyMkcalPerBasis: 65_000, // 65 kcal
      proteinMgPerBasis: 3_400, // 3.4g
      carbsMgPerBasis: 4_700, // 4.7g
      fatMgPerBasis: 3_600, // 3.6g
      additional: { fibreMg: 0, sugarMg: 4_700, saturatedFatMg: 2_300, sodiumMg: 44, potassiumMg: 150 }
    },
    {
      name: 'Impact Whey Protein Isolate (Vanilla)',
      brand: 'MyProtein',
      barcode: '5055100000001',
      amountUnit: 'mg',
      basisAmount: 25_000, // 25g scoop
      servingAmount: 25_000, // 25g
      containerAmount: 1_000_000, // 1 kg pouch
      energyMkcalPerBasis: 93_000, // 93 kcal
      proteinMgPerBasis: 22_000, // 22g
      carbsMgPerBasis: 600, // 0.6g
      fatMgPerBasis: 300, // 0.3g
      additional: { fibreMg: 0, sugarMg: 600, saturatedFatMg: 200, sodiumMg: 50, potassiumMg: 110 }
    },
    {
      name: 'Skinless Chicken Breast Fillet (Raw)',
      brand: 'Butcher Select',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 150_000, // 150g breast
      containerAmount: 500_000, // 500g pack
      energyMkcalPerBasis: 106_000, // 106 kcal
      proteinMgPerBasis: 24_000, // 24g
      carbsMgPerBasis: 0,
      fatMgPerBasis: 1_100, // 1.1g
      additional: { fibreMg: 0, sugarMg: 0, saturatedFatMg: 300, sodiumMg: 65, potassiumMg: 350 }
    },
    {
      name: 'Cooked Basmati Rice',
      brand: 'Tilda',
      barcode: '5011800000150',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g cooked
      servingAmount: 150_000, // 150g portion
      containerAmount: 250_000, // 250g pouch
      energyMkcalPerBasis: 130_000, // 130 kcal
      proteinMgPerBasis: 2_700, // 2.7g
      carbsMgPerBasis: 28_000, // 28g
      fatMgPerBasis: 400, // 0.4g
      additional: { fibreMg: 400, sugarMg: 100, saturatedFatMg: 100, sodiumMg: 2, potassiumMg: 35 }
    },
    {
      name: 'Fresh Medium Banana',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 118_000, // 1 medium banana ~ 118g
      energyMkcalPerBasis: 89_000, // 89 kcal
      proteinMgPerBasis: 1_100, // 1.1g
      carbsMgPerBasis: 22_800, // 22.8g
      fatMgPerBasis: 300, // 0.3g
      additional: { fibreMg: 2_600, sugarMg: 12_200, saturatedFatMg: 100, sodiumMg: 1, potassiumMg: 358 }
    },
    {
      name: 'Smooth Peanut Butter 100% Nuts',
      brand: 'Whole Earth',
      barcode: '5011835101010',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 15_000, // 15g tbsp
      containerAmount: 340_000, // 340g jar
      energyMkcalPerBasis: 596_000, // 596 kcal
      proteinMgPerBasis: 26_000, // 26g
      carbsMgPerBasis: 11_600, // 11.6g
      fatMgPerBasis: 46_000, // 46g
      additional: { fibreMg: 8_500, sugarMg: 5_900, saturatedFatMg: 8_200, sodiumMg: 5, potassiumMg: 650 }
    },
    {
      name: 'Extra Virgin Olive Oil',
      brand: 'Filippo Berio',
      barcode: '8000610000501',
      amountUnit: 'ul',
      basisAmount: 100_000, // 100 ml
      servingAmount: 15_000, // 15 ml tbsp
      containerAmount: 500_000, // 500 ml bottle
      energyMkcalPerBasis: 824_000, // 824 kcal
      proteinMgPerBasis: 0,
      carbsMgPerBasis: 0,
      fatMgPerBasis: 91_600, // 91.6g
      additional: { fibreMg: 0, sugarMg: 0, saturatedFatMg: 13_000, sodiumMg: 0, potassiumMg: 0 }
    },
    {
      name: 'Large Free Range Egg',
      brand: 'Irish Farm Fresh',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 58_000, // 1 large egg ~ 58g
      containerAmount: 348_000, // 6 eggs pack
      energyMkcalPerBasis: 143_000, // 143 kcal
      proteinMgPerBasis: 12_600, // 12.6g
      carbsMgPerBasis: 700, // 0.7g
      fatMgPerBasis: 9_500, // 9.5g
      additional: { fibreMg: 0, sugarMg: 700, saturatedFatMg: 3_100, sodiumMg: 140, potassiumMg: 138 }
    },
    {
      name: 'Atlantic Salmon Fillet (Raw)',
      brand: 'Ocean Fresh',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 130_000, // 130g fillet
      containerAmount: 260_000, // 2 pack
      energyMkcalPerBasis: 208_000, // 208 kcal
      proteinMgPerBasis: 20_000, // 20g
      carbsMgPerBasis: 0,
      fatMgPerBasis: 13_000, // 13g
      additional: { fibreMg: 0, sugarMg: 0, saturatedFatMg: 3_000, sodiumMg: 60, potassiumMg: 363 }
    },
    {
      name: 'Fresh Hass Avocado',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 150_000, // 1 medium avocado
      energyMkcalPerBasis: 160_000, // 160 kcal
      proteinMgPerBasis: 2_000, // 2g
      carbsMgPerBasis: 8_500, // 8.5g
      fatMgPerBasis: 14_700, // 14.7g
      additional: { fibreMg: 6_700, sugarMg: 700, saturatedFatMg: 2_100, sodiumMg: 7, potassiumMg: 485 }
    },
    {
      name: 'Wholemeal Seeded Bread Slice',
      brand: 'Brennans',
      barcode: '5099123456789',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 40_000, // 1 slice = 40g
      containerAmount: 800_000, // 800g loaf
      energyMkcalPerBasis: 235_000, // 235 kcal
      proteinMgPerBasis: 10_000, // 10g
      carbsMgPerBasis: 38_000, // 38g
      fatMgPerBasis: 3_500, // 3.5g
      additional: { fibreMg: 7_000, sugarMg: 3_000, saturatedFatMg: 600, sodiumMg: 380, potassiumMg: 220 }
    },
    {
      name: 'Steamed Broccoli Florets',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 85_000, // 85g portion
      energyMkcalPerBasis: 35_000, // 35 kcal
      proteinMgPerBasis: 2_400, // 2.4g
      carbsMgPerBasis: 7_200, // 7.2g
      fatMgPerBasis: 400, // 0.4g
      additional: { fibreMg: 3_300, sugarMg: 1_400, saturatedFatMg: 100, sodiumMg: 30, potassiumMg: 316 }
    },
    {
      name: 'Raw Whole Almonds',
      brand: 'Baking Essentials',
      barcode: '5020202020202',
      amountUnit: 'mg',
      basisAmount: 100_000, // 100g
      servingAmount: 28_000, // 28g handful
      containerAmount: 200_000, // 200g bag
      energyMkcalPerBasis: 579_000, // 579 kcal
      proteinMgPerBasis: 21_200, // 21.2g
      carbsMgPerBasis: 21_600, // 21.6g
      fatMgPerBasis: 49_900, // 49.9g
      additional: { fibreMg: 12_500, sugarMg: 4_400, saturatedFatMg: 3_800, sodiumMg: 1, potassiumMg: 733 }
    },
    {
      name: 'Black Double Espresso Coffee',
      amountUnit: 'ul',
      basisAmount: 60_000, // 60 ml shot
      servingAmount: 60_000, // 60 ml
      energyMkcalPerBasis: 5_000, // 5 kcal
      proteinMgPerBasis: 400, // 0.4g
      carbsMgPerBasis: 800, // 0.8g
      fatMgPerBasis: 100, // 0.1g
      additional: { fibreMg: 0, sugarMg: 0, saturatedFatMg: 0, sodiumMg: 8, potassiumMg: 115 }
    }
  ];

  const createdFoodsMap = new Map<string, typeof foods.$inferSelect>();

  for (const item of foodCatalog) {
    let existing = db
      .select()
      .from(foods)
      .where(eq(foods.userId, userId))
      .all()
      .find((f) => f.name === item.name && f.deletedAt === null);

    if (!existing) {
      existing = db
        .insert(foods)
        .values({
          id: randomUUID(),
          userId,
          name: item.name,
          brand: item.brand ?? null,
          barcode: item.barcode ?? null,
          amountUnit: item.amountUnit,
          basisAmount: item.basisAmount,
          servingAmount: item.servingAmount ?? null,
          containerAmount: item.containerAmount ?? null,
          energyMkcalPerBasis: item.energyMkcalPerBasis,
          proteinMgPerBasis: item.proteinMgPerBasis,
          carbsMgPerBasis: item.carbsMgPerBasis,
          fatMgPerBasis: item.fatMgPerBasis,
          additionalNutritionJson: item.additional ?? null,
          notes: item.notes ?? null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        })
        .returning()
        .get();
    }
    createdFoodsMap.set(item.name, existing);
  }

  console.log(`🍎 Populated ${createdFoodsMap.size} foods in food catalog.`);

  // 5. Populate Meal Shortcuts
  const oatsFood = createdFoodsMap.get('Rolled Porridge Oats')!;
  const milkFood = createdFoodsMap.get('Whole Fresh Milk')!;
  const wheyFood = createdFoodsMap.get('Impact Whey Protein Isolate (Vanilla)')!;
  const bananaFood = createdFoodsMap.get('Fresh Medium Banana')!;
  const pbFood = createdFoodsMap.get('Smooth Peanut Butter 100% Nuts')!;
  const chickenFood = createdFoodsMap.get('Skinless Chicken Breast Fillet (Raw)')!;
  const riceFood = createdFoodsMap.get('Cooked Basmati Rice')!;
  const broccoliFood = createdFoodsMap.get('Steamed Broccoli Florets')!;
  const oilFood = createdFoodsMap.get('Extra Virgin Olive Oil')!;

  const shortcutsData = [
    {
      name: 'High-Protein Morning Oats',
      items: [
        {
          food: oatsFood,
          position: 0,
          portionKind: 'serving' as PortionKind,
          portionLabel: '40 g serving',
          portionAmount: 40_000,
          portionCountMilli: 1000
        },
        {
          food: milkFood,
          position: 1,
          portionKind: 'hundred' as PortionKind,
          portionLabel: '100 ml',
          portionAmount: 100_000,
          portionCountMilli: 2000 // 200 ml
        },
        {
          food: wheyFood,
          position: 2,
          portionKind: 'serving' as PortionKind,
          portionLabel: '25 g scoop',
          portionAmount: 25_000,
          portionCountMilli: 1000
        },
        {
          food: bananaFood,
          position: 3,
          portionKind: 'serving' as PortionKind,
          portionLabel: '1 medium banana',
          portionAmount: 118_000,
          portionCountMilli: 1000
        }
      ]
    },
    {
      name: 'Chicken, Rice & Broccoli Prep',
      items: [
        {
          food: chickenFood,
          position: 0,
          portionKind: 'serving' as PortionKind,
          portionLabel: '150 g fillet',
          portionAmount: 150_000,
          portionCountMilli: 1200 // 180 g
        },
        {
          food: riceFood,
          position: 1,
          portionKind: 'hundred' as PortionKind,
          portionLabel: '100 g',
          portionAmount: 100_000,
          portionCountMilli: 2000 // 200 g cooked
        },
        {
          food: broccoliFood,
          position: 2,
          portionKind: 'serving' as PortionKind,
          portionLabel: '85 g portion',
          portionAmount: 85_000,
          portionCountMilli: 1500 // ~127.5 g
        },
        {
          food: oilFood,
          position: 3,
          portionKind: 'serving' as PortionKind,
          portionLabel: '15 ml tbsp',
          portionAmount: 15_000,
          portionCountMilli: 1000
        }
      ]
    },
    {
      name: 'Post-Workout Shake',
      items: [
        {
          food: milkFood,
          position: 0,
          portionKind: 'hundred' as PortionKind,
          portionLabel: '100 ml',
          portionAmount: 100_000,
          portionCountMilli: 3000 // 300 ml
        },
        {
          food: wheyFood,
          position: 1,
          portionKind: 'serving' as PortionKind,
          portionLabel: '25 g scoop',
          portionAmount: 25_000,
          portionCountMilli: 1500 // 37.5 g
        },
        {
          food: pbFood,
          position: 2,
          portionKind: 'serving' as PortionKind,
          portionLabel: '15 g tbsp',
          portionAmount: 15_000,
          portionCountMilli: 1000
        }
      ]
    }
  ];

  for (const scData of shortcutsData) {
    let shortcut = db
      .select()
      .from(mealShortcuts)
      .where(eq(mealShortcuts.userId, userId))
      .all()
      .find((s) => s.name === scData.name && s.deletedAt === null);

    if (!shortcut) {
      shortcut = db
        .insert(mealShortcuts)
        .values({
          id: randomUUID(),
          userId,
          name: scData.name,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        })
        .returning()
        .get();

      for (const item of scData.items) {
        const resolvedAmt = Number(
          divideRoundHalfUp(
            BigInt(item.portionAmount) * BigInt(item.portionCountMilli),
            1000n
          )
        );

        db.insert(mealShortcutItems)
          .values({
            id: randomUUID(),
            userId,
            shortcutId: shortcut.id,
            foodId: item.food.id,
            amountUnit: item.food.amountUnit,
            position: item.position,
            defaultAmount: resolvedAmt,
            defaultPortionKind: item.portionKind,
            defaultPortionLabel: item.portionLabel,
            defaultPortionAmount: item.portionAmount,
            defaultPortionCountMilli: item.portionCountMilli
          })
          .run();
      }
    }
  }

  console.log(`⚡ Populated ${shortcutsData.length} meal shortcuts with items.`);

  // 6. Populate Diary Logs for past 7 days (ending today)
  function formatDateISO(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  const daysToSeed = 7;
  const breadFood = createdFoodsMap.get('Wholemeal Seeded Bread Slice')!;
  const avocadoFood = createdFoodsMap.get('Fresh Hass Avocado')!;
  const salmonFood = createdFoodsMap.get('Atlantic Salmon Fillet (Raw)')!;
  const almondsFood = createdFoodsMap.get('Raw Whole Almonds')!;
  const coffeeFood = createdFoodsMap.get('Black Double Espresso Coffee')!;

  const existingLogsCount = db.select().from(diaryLogs).where(eq(diaryLogs.userId, userId)).all().length;

  if (existingLogsCount === 0 || resetArg) {
    let loggedEntriesCount = 0;

    for (let i = daysToSeed - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const diaryDate = formatDateISO(d);

      const dayMeals: Array<{
        slot: MealSlot;
        food: typeof foods.$inferSelect;
        portionKind: PortionKind;
        portionLabel: string;
        portionAmount: number;
        portionCountMilli: number;
      }> = [
        // Breakfast
        {
          slot: 'breakfast',
          food: oatsFood,
          portionKind: 'serving',
          portionLabel: '40 g serving',
          portionAmount: 40_000,
          portionCountMilli: 1250 // 50g oats
        },
        {
          slot: 'breakfast',
          food: milkFood,
          portionKind: 'hundred',
          portionLabel: '100 ml',
          portionAmount: 100_000,
          portionCountMilli: 1500 // 150ml milk
        },
        {
          slot: 'breakfast',
          food: coffeeFood,
          portionKind: 'serving',
          portionLabel: '60 ml shot',
          portionAmount: 60_000,
          portionCountMilli: 1000
        },
        // Lunch
        {
          slot: 'lunch',
          food: chickenFood,
          portionKind: 'serving',
          portionLabel: '150 g fillet',
          portionAmount: 150_000,
          portionCountMilli: 1000 // 150g fillet
        },
        {
          slot: 'lunch',
          food: riceFood,
          portionKind: 'hundred',
          portionLabel: '100 g',
          portionAmount: 100_000,
          portionCountMilli: 1800 // 180g rice
        },
        {
          slot: 'lunch',
          food: broccoliFood,
          portionKind: 'serving',
          portionLabel: '85 g portion',
          portionAmount: 85_000,
          portionCountMilli: 1000
        },
        // Dinner
        {
          slot: 'dinner',
          food: salmonFood,
          portionKind: 'serving',
          portionLabel: '130 g fillet',
          portionAmount: 130_000,
          portionCountMilli: 1000
        },
        {
          slot: 'dinner',
          food: avocadoFood,
          portionKind: 'hundred',
          portionLabel: '100 g',
          portionAmount: 100_000,
          portionCountMilli: 750 // 75g avocado
        },
        {
          slot: 'dinner',
          food: breadFood,
          portionKind: 'serving',
          portionLabel: '1 slice (40g)',
          portionAmount: 40_000,
          portionCountMilli: 2000 // 2 slices
        },
        // Snacks
        {
          slot: 'snacks',
          food: wheyFood,
          portionKind: 'serving',
          portionLabel: '25 g scoop',
          portionAmount: 25_000,
          portionCountMilli: 1000
        },
        {
          slot: 'snacks',
          food: almondsFood,
          portionKind: 'serving',
          portionLabel: '28 g handful',
          portionAmount: 28_000,
          portionCountMilli: 1000
        }
      ];

      for (const meal of dayMeals) {
        const food = meal.food;
        const portionAmount = BigInt(meal.portionAmount);
        const portionCountMilli = BigInt(meal.portionCountMilli);

        const resolvedAmtBig = divideRoundHalfUp(portionAmount * portionCountMilli, 1000n);
        const resolvedAmount = Number(resolvedAmtBig);

        const basisAmount = BigInt(food.basisAmount);
        const energyMkcal = Number(scaleNutritionValue(BigInt(food.energyMkcalPerBasis), resolvedAmtBig, basisAmount));
        const proteinMg = Number(scaleNutritionValue(BigInt(food.proteinMgPerBasis), resolvedAmtBig, basisAmount));
        const carbsMg = Number(scaleNutritionValue(BigInt(food.carbsMgPerBasis), resolvedAmtBig, basisAmount));
        const fatMg = Number(scaleNutritionValue(BigInt(food.fatMgPerBasis), resolvedAmtBig, basisAmount));

        const addlTotal = scaleAdditional(
          food.additionalNutritionJson as AdditionalNutrition | null,
          resolvedAmtBig,
          basisAmount
        );

        db.insert(diaryLogs)
          .values({
            id: randomUUID(),
            userId,
            foodId: food.id,
            diaryDate,
            mealSlot: meal.slot,
            clientRequestFingerprint: 'seed-script',
            foodName: food.name,
            foodBrand: food.brand,
            amountUnit: food.amountUnit,
            basisAmount: food.basisAmount,
            energyMkcalPerBasis: food.energyMkcalPerBasis,
            proteinMgPerBasis: food.proteinMgPerBasis,
            carbsMgPerBasis: food.carbsMgPerBasis,
            fatMgPerBasis: food.fatMgPerBasis,
            additionalNutritionPerBasisJson: (food.additionalNutritionJson as AdditionalNutrition | null) ?? null,
            portionKind: meal.portionKind,
            portionLabel: meal.portionLabel,
            portionAmount: meal.portionAmount,
            portionCountMilli: meal.portionCountMilli,
            resolvedAmount,
            energyMkcal,
            proteinMg,
            carbsMg,
            fatMg,
            additionalNutritionTotalJson: addlTotal ?? null,
            loggedAt: new Date(d.getTime() + Math.random() * 3600_000),
            createdAt: now,
            updatedAt: now,
            deletedAt: null
          })
          .run();

        loggedEntriesCount++;
      }
    }

    console.log(`📖 Logged ${loggedEntriesCount} diary entries across the last ${daysToSeed} days.`);
  } else {
    console.log(`📖 User already has ${existingLogsCount} diary entries. (Use --reset to re-seed logs).`);
  }

  client.close();
  console.log('✅ Database seeding finished successfully!');
}

seed().catch((err) => {
  console.error('❌ Error during seeding:', err);
  process.exit(1);
});
