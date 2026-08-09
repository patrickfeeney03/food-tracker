<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import AmountAdjuster, {
    type AmountAdjusterFieldErrors,
    type AmountAdjusterValues
  } from '$lib/components/amount-adjuster/AmountAdjuster.svelte';
  import TrackerLoadingScreen from '$lib/components/tracker/TrackerLoadingScreen.svelte';
  import { todayInDublin } from '$lib/date';
  import { withQuery } from '$lib/navigation';
  import type { MealSlot } from '$lib/nutrition/constants';
  import { rememberPendingFoodLogReturn } from '$lib/nutrition/food-log-navigation';
  import { replayLatestFoodPortion } from '$lib/nutrition/latest-food-portion';
  import { contextSchema } from '$lib/nutrition/navigation-context';
  import { logFoodInputSchema } from '$lib/nutrition/portion-input';
  import { portionOptionsForFood } from '$lib/nutrition/portion-options';
  import { queueDiaryLog } from '$lib/offline/sync';
  import type { OfflineFood } from '$lib/offline/types';
  import {
    reloadTrackerStore
  } from '$lib/tracker/tracker-service';
  import { useTrackerStore } from '$lib/tracker/tracker-store.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { untrack } from 'svelte';
  import { z } from 'zod';

  const tracker = useTrackerStore();
  let cameFromFoodSearch = $state(false);

  afterNavigate(({ from }) => {
    if (from?.url.pathname === '/foods') {
      cameFromFoodSearch = true;
    }
  });
  const initialFoodId = untrack(() => page.params.foodId);
  const initialContextResult = contextSchema.safeParse({
    date: untrack(() => page.url.searchParams.get('date')),
    mealSlot: untrack(() => page.url.searchParams.get('mealSlot')),
    q: untrack(() => page.url.searchParams.get('q')) ?? ''
  });
  const initialContext = initialContextResult.success
    ? initialContextResult.data
    : {
        date: todayInDublin(),
        mealSlot: 'breakfast' as MealSlot,
        q: ''
      };
  const initialFood = tracker.cache?.foods.find((item) => item.id === initialFoodId);
  let amountValues = $state<AmountAdjusterValues | null>(
    initialFood === undefined ? null : initialAmountValues(initialFood, initialContext)
  );
  let amountErrors = $state<AmountAdjusterFieldErrors>({});
  let amountKey = $state(
    initialFood === undefined
      ? ''
      : `${initialFood.id}:${initialContext.date}:${initialContext.mealSlot}`
  );

  let context = $derived.by(() => {
    const result = contextSchema.safeParse({
      date: page.url.searchParams.get('date'),
      mealSlot: page.url.searchParams.get('mealSlot'),
      q: page.url.searchParams.get('q') ?? ''
    });
    return result.success
      ? result.data
      : {
          date: todayInDublin(),
          mealSlot: 'breakfast' as MealSlot,
          q: ''
        };
  });
  let food = $derived(
    tracker.cache?.foods.find((item) => item.id === page.params.foodId) ?? null
  );

  function initialAmountValues(
    selectedFood: OfflineFood,
    destination = context
  ): AmountAdjusterValues {
    const replay = selectedFood.latestUse === null
      ? null
      : replayLatestFoodPortion(selectedFood, selectedFood.latestUse);

    return {
      clientMutationId: crypto.randomUUID(),
      portionKind: replay?.portionKind ?? 'hundred',
      portionCount: replay?.portionCount ?? '',
      diaryDate: destination.date,
      mealSlot: destination.mealSlot
    };
  }

  function editFoodHref(foodId: string): string | null {
    return tracker.isOffline
      ? null
      : resolve(withQuery(`/foods/${foodId}/edit`, {
          date: context.date,
          mealSlot: context.mealSlot,
          q: context.q || undefined
        }));
  }

  const enhanceLocalLog: SubmitFunction = async ({ cancel, formData }) => {
    cancel();
    amountErrors = {};

    const values = {
      clientMutationId: String(formData.get('clientMutationId') ?? ''),
      portionKind: String(formData.get('portionKind') ?? ''),
      portionCount: String(formData.get('portionCount') ?? ''),
      diaryDate: String(formData.get('diaryDate') ?? ''),
      mealSlot: String(formData.get('mealSlot') ?? '')
    };
    const result = logFoodInputSchema.safeParse(values);

    if (!result.success) {
      amountErrors = z.flattenError(result.error).fieldErrors;
      return;
    }

    const userId = tracker.cache?.user.id;
    if (userId === undefined || food === null) {
      amountErrors = { form: ['This food is not saved on this device.'] };
      return;
    }

    try {
      await queueDiaryLog(userId, food.id, result.data);
      await reloadTrackerStore(tracker);

      const targetHref = resolve(withQuery('/foods', {
        date: result.data.diaryDate,
        mealSlot: result.data.mealSlot
      }));

      if (cameFromFoodSearch && typeof window !== 'undefined' && window.history.length > 1) {
        rememberPendingFoodLogReturn(targetHref);
        history.back();
      } else {
        await goto(targetHref, { replaceState: true });
      }
    } catch {
      amountErrors = { form: ['This change could not be saved on this device.'] };
    }
  };

  $effect(() => {
    const nextKey = food === null
      ? ''
      : `${food.id}:${context.date}:${context.mealSlot}`;
    if (food !== null && nextKey !== amountKey) {
      amountKey = nextKey;
      amountValues = initialAmountValues(food);
      amountErrors = {};
    }
  });
</script>

<svelte:head>
  <title>Add {food?.name ?? 'food'} | Calorie Tracker</title>
</svelte:head>

{#if food !== null && amountValues !== null}
  {#key amountKey}
    <AmountAdjuster
      {food}
      {context}
      portionOptions={portionOptionsForFood(food)}
      initialValues={amountValues}
      errors={amountErrors}
      enhanceSubmit={enhanceLocalLog}
      editFoodHref={editFoodHref(food.id)}
    />
  {/key}
{:else}
  <TrackerLoadingScreen message="Opening food…" />
{/if}
