<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import PwaUpdateBanner from '$lib/components/PwaUpdateBanner.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

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
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="icon" href="/pwa-192x192.png" type="image/png" sizes="192x192" />
	<meta name="description" content="Personal calorie and macro tracker for fast food logging." />
</svelte:head>

<PwaUpdateBanner />
{@render children()}
