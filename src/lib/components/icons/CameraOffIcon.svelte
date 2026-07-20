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
  <path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z"></path>
  <path d="m5 4 14 16"></path>
</svg>
