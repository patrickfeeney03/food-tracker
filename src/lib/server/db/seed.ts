import type { D1Database } from '@cloudflare/workers-types';
import { randomUUID } from 'node:crypto';
import { createDatabase } from './connection';
import { getPlatformProxy } from 'wrangler';
import type { MealSlot, PortionKind } from '../../nutrition/constants';
import { users, authAccounts, nutritionGoals, foods, mealShortcuts, mealShortcutItems, diaryLogs, type AdditionalNutrition } from './schema';
import { scaleNutritionValue, divideRoundHalfUp } from '../../nutrition/math';
import { eq } from 'drizzle-orm';
const dbUrl = 'local Cloudflare D1';
const proxy = await getPlatformProxy<{
    DB: D1Database;
    GOOGLE_ALLOWED_EMAILS?: string;
}>({ configPath: 'wrangler.jsonc', persist: { path: '.wrangler/state/v3' } });
const userEmail = (process.env.GOOGLE_ALLOWED_EMAILS || proxy.env.GOOGLE_ALLOWED_EMAILS || 'dev@example.test')
    .split(',')[0].trim().toLowerCase();
const userName = 'Local developer';
console.log(`Seeding ${dbUrl} for ${userEmail}...`);
const { db } = createDatabase(proxy.env.DB);
const client = { close: () => proxy.dispose() };
function scaleAdditional(basis?: AdditionalNutrition | null, resolvedAmount?: bigint, basisAmount?: bigint): AdditionalNutrition | undefined {
    if (!basis || !resolvedAmount || !basisAmount)
        return undefined;
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
    let user = await db.select().from(users).where(eq(users.email, userEmail)).get();
    if (!user) {
        user = await db
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
        await db.insert(authAccounts)
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
    }
    else {
        console.log(`👤 Found existing user: ${user.name} (${user.id})`);
    }
    const userId = user.id;
    // 2. Clear existing user data if requested via argument or wipe for clean seed
    const resetArg = process.argv.includes('--reset');
    if (resetArg) {
        console.log('🧹 Clearing existing user entries for clean re-seed...');
        await db.delete(diaryLogs).where(eq(diaryLogs.userId, userId)).run();
        await db.delete(mealShortcutItems).where(eq(mealShortcutItems.userId, userId)).run();
        await db.delete(mealShortcuts).where(eq(mealShortcuts.userId, userId)).run();
        await db.delete(foods).where(eq(foods.userId, userId)).run();
        await db.delete(nutritionGoals).where(eq(nutritionGoals.userId, userId)).run();
    }
    // 3. Nutrition Goal
    const existingGoal = await db.select().from(nutritionGoals).where(eq(nutritionGoals.userId, userId)).get();
    if (!existingGoal) {
        await db.insert(nutritionGoals)
            .values({
            id: randomUUID(),
            userId,
            effectiveFrom: '2024-01-01',
            targetEnergyMkcal: 2200000, // 2200 kcal
            targetProteinMg: 160000, // 160 g
            targetCarbsMg: 220000, // 220 g
            targetFatMg: 70000, // 70 g
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
            basisAmount: 100000, // 100g
            servingAmount: 40000, // 40g serving
            containerAmount: 1000000, // 1kg
            energyMkcalPerBasis: 366000, // 366 kcal
            proteinMgPerBasis: 11000, // 11g
            carbsMgPerBasis: 60000, // 60g
            fatMgPerBasis: 6900, // 6.9g
            additional: { fibreMg: 9000, sugarMg: 1000, saturatedFatMg: 1200, sodiumMg: 0, potassiumMg: 350 },
            notes: 'Whole grain oat flakes. Great breakfast staple.'
        },
        {
            name: 'Greek Style Yogurt 0% Fat',
            brand: 'Fage Total',
            barcode: '5201051000021',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 170000, // 170g pot
            containerAmount: 500000, // 500g tub
            energyMkcalPerBasis: 54000, // 54 kcal
            proteinMgPerBasis: 10300, // 10.3g
            carbsMgPerBasis: 3000, // 3.0g
            fatMgPerBasis: 0,
            additional: { fibreMg: 0, sugarMg: 3000, saturatedFatMg: 0, sodiumMg: 40, potassiumMg: 140 },
            notes: 'Strained 0% fat Greek yoghurt. High protein.'
        },
        {
            name: 'Whole Fresh Milk',
            brand: 'Avonmore',
            barcode: '5099047000123',
            amountUnit: 'ul',
            basisAmount: 100000, // 100 ml
            servingAmount: 200000, // 200 ml glass
            containerAmount: 1000000, // 1 L bottle
            energyMkcalPerBasis: 65000, // 65 kcal
            proteinMgPerBasis: 3400, // 3.4g
            carbsMgPerBasis: 4700, // 4.7g
            fatMgPerBasis: 3600, // 3.6g
            additional: { fibreMg: 0, sugarMg: 4700, saturatedFatMg: 2300, sodiumMg: 44, potassiumMg: 150 }
        },
        {
            name: 'Impact Whey Protein Isolate (Vanilla)',
            brand: 'MyProtein',
            barcode: '5055100000001',
            amountUnit: 'mg',
            basisAmount: 25000, // 25g scoop
            servingAmount: 25000, // 25g
            containerAmount: 1000000, // 1 kg pouch
            energyMkcalPerBasis: 93000, // 93 kcal
            proteinMgPerBasis: 22000, // 22g
            carbsMgPerBasis: 600, // 0.6g
            fatMgPerBasis: 300, // 0.3g
            additional: { fibreMg: 0, sugarMg: 600, saturatedFatMg: 200, sodiumMg: 50, potassiumMg: 110 }
        },
        {
            name: 'Skinless Chicken Breast Fillet (Raw)',
            brand: 'Butcher Select',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 150000, // 150g breast
            containerAmount: 500000, // 500g pack
            energyMkcalPerBasis: 106000, // 106 kcal
            proteinMgPerBasis: 24000, // 24g
            carbsMgPerBasis: 0,
            fatMgPerBasis: 1100, // 1.1g
            additional: { fibreMg: 0, sugarMg: 0, saturatedFatMg: 300, sodiumMg: 65, potassiumMg: 350 }
        },
        {
            name: 'Cooked Basmati Rice',
            brand: 'Tilda',
            barcode: '5011800000150',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g cooked
            servingAmount: 150000, // 150g portion
            containerAmount: 250000, // 250g pouch
            energyMkcalPerBasis: 130000, // 130 kcal
            proteinMgPerBasis: 2700, // 2.7g
            carbsMgPerBasis: 28000, // 28g
            fatMgPerBasis: 400, // 0.4g
            additional: { fibreMg: 400, sugarMg: 100, saturatedFatMg: 100, sodiumMg: 2, potassiumMg: 35 }
        },
        {
            name: 'Fresh Medium Banana',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 118000, // 1 medium banana ~ 118g
            energyMkcalPerBasis: 89000, // 89 kcal
            proteinMgPerBasis: 1100, // 1.1g
            carbsMgPerBasis: 22800, // 22.8g
            fatMgPerBasis: 300, // 0.3g
            additional: { fibreMg: 2600, sugarMg: 12200, saturatedFatMg: 100, sodiumMg: 1, potassiumMg: 358 }
        },
        {
            name: 'Smooth Peanut Butter 100% Nuts',
            brand: 'Whole Earth',
            barcode: '5011835101010',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 15000, // 15g tbsp
            containerAmount: 340000, // 340g jar
            energyMkcalPerBasis: 596000, // 596 kcal
            proteinMgPerBasis: 26000, // 26g
            carbsMgPerBasis: 11600, // 11.6g
            fatMgPerBasis: 46000, // 46g
            additional: { fibreMg: 8500, sugarMg: 5900, saturatedFatMg: 8200, sodiumMg: 5, potassiumMg: 650 }
        },
        {
            name: 'Extra Virgin Olive Oil',
            brand: 'Filippo Berio',
            barcode: '8000610000501',
            amountUnit: 'ul',
            basisAmount: 100000, // 100 ml
            servingAmount: 15000, // 15 ml tbsp
            containerAmount: 500000, // 500 ml bottle
            energyMkcalPerBasis: 824000, // 824 kcal
            proteinMgPerBasis: 0,
            carbsMgPerBasis: 0,
            fatMgPerBasis: 91600, // 91.6g
            additional: { fibreMg: 0, sugarMg: 0, saturatedFatMg: 13000, sodiumMg: 0, potassiumMg: 0 }
        },
        {
            name: 'Large Free Range Egg',
            brand: 'Irish Farm Fresh',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 58000, // 1 large egg ~ 58g
            containerAmount: 348000, // 6 eggs pack
            energyMkcalPerBasis: 143000, // 143 kcal
            proteinMgPerBasis: 12600, // 12.6g
            carbsMgPerBasis: 700, // 0.7g
            fatMgPerBasis: 9500, // 9.5g
            additional: { fibreMg: 0, sugarMg: 700, saturatedFatMg: 3100, sodiumMg: 140, potassiumMg: 138 }
        },
        {
            name: 'Atlantic Salmon Fillet (Raw)',
            brand: 'Ocean Fresh',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 130000, // 130g fillet
            containerAmount: 260000, // 2 pack
            energyMkcalPerBasis: 208000, // 208 kcal
            proteinMgPerBasis: 20000, // 20g
            carbsMgPerBasis: 0,
            fatMgPerBasis: 13000, // 13g
            additional: { fibreMg: 0, sugarMg: 0, saturatedFatMg: 3000, sodiumMg: 60, potassiumMg: 363 }
        },
        {
            name: 'Fresh Hass Avocado',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 150000, // 1 medium avocado
            energyMkcalPerBasis: 160000, // 160 kcal
            proteinMgPerBasis: 2000, // 2g
            carbsMgPerBasis: 8500, // 8.5g
            fatMgPerBasis: 14700, // 14.7g
            additional: { fibreMg: 6700, sugarMg: 700, saturatedFatMg: 2100, sodiumMg: 7, potassiumMg: 485 }
        },
        {
            name: 'Wholemeal Seeded Bread Slice',
            brand: 'Brennans',
            barcode: '5099123456789',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 40000, // 1 slice = 40g
            containerAmount: 800000, // 800g loaf
            energyMkcalPerBasis: 235000, // 235 kcal
            proteinMgPerBasis: 10000, // 10g
            carbsMgPerBasis: 38000, // 38g
            fatMgPerBasis: 3500, // 3.5g
            additional: { fibreMg: 7000, sugarMg: 3000, saturatedFatMg: 600, sodiumMg: 380, potassiumMg: 220 }
        },
        {
            name: 'Steamed Broccoli Florets',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 85000, // 85g portion
            energyMkcalPerBasis: 35000, // 35 kcal
            proteinMgPerBasis: 2400, // 2.4g
            carbsMgPerBasis: 7200, // 7.2g
            fatMgPerBasis: 400, // 0.4g
            additional: { fibreMg: 3300, sugarMg: 1400, saturatedFatMg: 100, sodiumMg: 30, potassiumMg: 316 }
        },
        {
            name: 'Raw Whole Almonds',
            brand: 'Baking Essentials',
            barcode: '5020202020202',
            amountUnit: 'mg',
            basisAmount: 100000, // 100g
            servingAmount: 28000, // 28g handful
            containerAmount: 200000, // 200g bag
            energyMkcalPerBasis: 579000, // 579 kcal
            proteinMgPerBasis: 21200, // 21.2g
            carbsMgPerBasis: 21600, // 21.6g
            fatMgPerBasis: 49900, // 49.9g
            additional: { fibreMg: 12500, sugarMg: 4400, saturatedFatMg: 3800, sodiumMg: 1, potassiumMg: 733 }
        },
        {
            name: 'Black Double Espresso Coffee',
            amountUnit: 'ul',
            basisAmount: 60000, // 60 ml shot
            servingAmount: 60000, // 60 ml
            energyMkcalPerBasis: 5000, // 5 kcal
            proteinMgPerBasis: 400, // 0.4g
            carbsMgPerBasis: 800, // 0.8g
            fatMgPerBasis: 100, // 0.1g
            additional: { fibreMg: 0, sugarMg: 0, saturatedFatMg: 0, sodiumMg: 8, potassiumMg: 115 }
        }
    ];
    const createdFoodsMap = new Map<string, typeof foods.$inferSelect>();
    for (const item of foodCatalog) {
        let existing = (await db
            .select()
            .from(foods)
            .where(eq(foods.userId, userId))
            .all()).find((f) => f.name === item.name && f.deletedAt === null);
        if (!existing) {
            existing = await db
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
                    portionAmount: 40000,
                    portionCountMilli: 1000
                },
                {
                    food: milkFood,
                    position: 1,
                    portionKind: 'hundred' as PortionKind,
                    portionLabel: '100 ml',
                    portionAmount: 100000,
                    portionCountMilli: 2000 // 200 ml
                },
                {
                    food: wheyFood,
                    position: 2,
                    portionKind: 'serving' as PortionKind,
                    portionLabel: '25 g scoop',
                    portionAmount: 25000,
                    portionCountMilli: 1000
                },
                {
                    food: bananaFood,
                    position: 3,
                    portionKind: 'serving' as PortionKind,
                    portionLabel: '1 medium banana',
                    portionAmount: 118000,
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
                    portionAmount: 150000,
                    portionCountMilli: 1200 // 180 g
                },
                {
                    food: riceFood,
                    position: 1,
                    portionKind: 'hundred' as PortionKind,
                    portionLabel: '100 g',
                    portionAmount: 100000,
                    portionCountMilli: 2000 // 200 g cooked
                },
                {
                    food: broccoliFood,
                    position: 2,
                    portionKind: 'serving' as PortionKind,
                    portionLabel: '85 g portion',
                    portionAmount: 85000,
                    portionCountMilli: 1500 // ~127.5 g
                },
                {
                    food: oilFood,
                    position: 3,
                    portionKind: 'serving' as PortionKind,
                    portionLabel: '15 ml tbsp',
                    portionAmount: 15000,
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
                    portionAmount: 100000,
                    portionCountMilli: 3000 // 300 ml
                },
                {
                    food: wheyFood,
                    position: 1,
                    portionKind: 'serving' as PortionKind,
                    portionLabel: '25 g scoop',
                    portionAmount: 25000,
                    portionCountMilli: 1500 // 37.5 g
                },
                {
                    food: pbFood,
                    position: 2,
                    portionKind: 'serving' as PortionKind,
                    portionLabel: '15 g tbsp',
                    portionAmount: 15000,
                    portionCountMilli: 1000
                }
            ]
        }
    ];
    for (const scData of shortcutsData) {
        let shortcut = (await db
            .select()
            .from(mealShortcuts)
            .where(eq(mealShortcuts.userId, userId))
            .all()).find((s) => s.name === scData.name && s.deletedAt === null);
        if (!shortcut) {
            shortcut = await db
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
                const resolvedAmt = Number(divideRoundHalfUp(BigInt(item.portionAmount) * BigInt(item.portionCountMilli), 1000n));
                await db.insert(mealShortcutItems)
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
    const existingLogsCount = (await db.select().from(diaryLogs).where(eq(diaryLogs.userId, userId)).all()).length;
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
                    portionAmount: 40000,
                    portionCountMilli: 1250 // 50g oats
                },
                {
                    slot: 'breakfast',
                    food: milkFood,
                    portionKind: 'hundred',
                    portionLabel: '100 ml',
                    portionAmount: 100000,
                    portionCountMilli: 1500 // 150ml milk
                },
                {
                    slot: 'breakfast',
                    food: coffeeFood,
                    portionKind: 'serving',
                    portionLabel: '60 ml shot',
                    portionAmount: 60000,
                    portionCountMilli: 1000
                },
                // Lunch
                {
                    slot: 'lunch',
                    food: chickenFood,
                    portionKind: 'serving',
                    portionLabel: '150 g fillet',
                    portionAmount: 150000,
                    portionCountMilli: 1000 // 150g fillet
                },
                {
                    slot: 'lunch',
                    food: riceFood,
                    portionKind: 'hundred',
                    portionLabel: '100 g',
                    portionAmount: 100000,
                    portionCountMilli: 1800 // 180g rice
                },
                {
                    slot: 'lunch',
                    food: broccoliFood,
                    portionKind: 'serving',
                    portionLabel: '85 g portion',
                    portionAmount: 85000,
                    portionCountMilli: 1000
                },
                // Dinner
                {
                    slot: 'dinner',
                    food: salmonFood,
                    portionKind: 'serving',
                    portionLabel: '130 g fillet',
                    portionAmount: 130000,
                    portionCountMilli: 1000
                },
                {
                    slot: 'dinner',
                    food: avocadoFood,
                    portionKind: 'hundred',
                    portionLabel: '100 g',
                    portionAmount: 100000,
                    portionCountMilli: 750 // 75g avocado
                },
                {
                    slot: 'dinner',
                    food: breadFood,
                    portionKind: 'serving',
                    portionLabel: '1 slice (40g)',
                    portionAmount: 40000,
                    portionCountMilli: 2000 // 2 slices
                },
                // Snacks
                {
                    slot: 'snacks',
                    food: wheyFood,
                    portionKind: 'serving',
                    portionLabel: '25 g scoop',
                    portionAmount: 25000,
                    portionCountMilli: 1000
                },
                {
                    slot: 'snacks',
                    food: almondsFood,
                    portionKind: 'serving',
                    portionLabel: '28 g handful',
                    portionAmount: 28000,
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
                const addlTotal = scaleAdditional(food.additionalNutritionJson as AdditionalNutrition | null, resolvedAmtBig, basisAmount);
                await db.insert(diaryLogs)
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
                    loggedAt: new Date(d.getTime() + Math.random() * 3600000),
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null
                })
                    .run();
                loggedEntriesCount++;
            }
        }
        console.log(`📖 Logged ${loggedEntriesCount} diary entries across the last ${daysToSeed} days.`);
    }
    else {
        console.log(`📖 User already has ${existingLogsCount} diary entries. (Use --reset to re-seed logs).`);
    }
    console.log('✅ Database seeding finished successfully!');
}
seed().finally(() => client.close()).catch((err) => {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
});
