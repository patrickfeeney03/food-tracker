<script lang="ts">
  let { class: className = '' }: { class?: string } = $props();
</script>

<svg
  aria-hidden="true"
  viewBox="0 0 24 24"
  class={className}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
>
  <path d="m7 7 10 10M17 7 7 17"></path>
</svg>
