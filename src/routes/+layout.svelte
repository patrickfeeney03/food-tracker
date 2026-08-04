<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { navigating } from '$app/state';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import PwaUpdateBanner from '$lib/components/PwaUpdateBanner.svelte';
	import { offlineSyncStatus } from '$lib/offline/sync';
	import {
		hydrateTrackerStore,
		reloadTrackerStore
	} from '$lib/tracker/tracker-service';
	import { isLocalTrackerPath } from '$lib/tracker/routes';
	import { provideTrackerStore } from '$lib/tracker/tracker-store.svelte';
	import { onMount, untrack } from 'svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
	const tracker = provideTrackerStore(
		untrack(() => data.trackerSnapshot),
		untrack(() => data.trackerSessionUserId)
	);
	let navigationMessageTimer: ReturnType<typeof setTimeout> | undefined;

	function showNavigationMessage(message: string): void {
		tracker.navigationMessage = message;
		clearTimeout(navigationMessageTimer);
		navigationMessageTimer = setTimeout(() => {
			tracker.navigationMessage = null;
		}, 4_000);
	}

	beforeNavigate(({ cancel, to }) => {
		if (
			tracker.isOffline &&
			to?.url.origin === window.location.origin &&
			!isLocalTrackerPath(to.url.pathname)
		) {
			cancel();
			showNavigationMessage('That page needs an internet connection.');
		}
	});

	$effect(() => {
		const root = document.documentElement;
		const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
		const applyTheme = () => {
			root.dataset.theme = data.theme;
			root.classList.toggle(
				'dark',
				data.theme === 'dark' || (data.theme === 'system' && systemTheme.matches)
			);
		};

		applyTheme();
		systemTheme.addEventListener('change', applyTheme);

		return () => systemTheme.removeEventListener('change', applyTheme);
	});

	$effect(() => {
		const phase = $offlineSyncStatus.phase;

		if (
			(phase === 'synced' || phase === 'attention' || phase === 'pending' || phase === 'error') &&
			tracker.lastSyncPhase !== phase
		) {
			void reloadTrackerStore(tracker);
		}

		tracker.lastSyncPhase = phase;
	});

	onMount(() => {
		function updateOnlineStatus(): void {
			tracker.isOffline = !navigator.onLine;
		}

		updateOnlineStatus();
		void hydrateTrackerStore(tracker).catch(() => {
			if (tracker.cache === null) {
				tracker.status = 'error';
			}
		});

		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);

		return () => {
			clearTimeout(navigationMessageTimer);
			window.removeEventListener('online', updateOnlineStatus);
			window.removeEventListener('offline', updateOnlineStatus);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="icon" href="/pwa-192x192.png" type="image/png" sizes="192x192" />
	<meta name="description" content="Personal calorie and macro tracker for fast food logging." />
</svelte:head>

<PwaUpdateBanner />
{@render children()}

{#if navigating.to !== null && !isLocalTrackerPath(navigating.to.url.pathname)}
	<div
		role="status"
		aria-label="Opening page"
		class="pointer-events-none fixed inset-x-0 top-0 z-40 h-1 overflow-hidden bg-[var(--app-accent-soft)]"
	>
		<span class="block h-full w-2/3 animate-pulse bg-[var(--app-accent)]"></span>
	</div>
{/if}

{#if tracker.navigationMessage !== null}
	<p
		role="status"
		class="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-50 mx-auto
			max-w-sm rounded-xl bg-[var(--app-text)] px-4 py-3 text-center text-sm font-semibold
			text-[var(--app-surface)] shadow-lg"
	>
		{tracker.navigationMessage}
	</p>
{/if}
