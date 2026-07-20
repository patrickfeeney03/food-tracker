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
  <circle cx="11" cy="11" r="7"></circle>
  <path d="m20 20-3.5-3.5"></path>
</svg>
