<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
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

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
