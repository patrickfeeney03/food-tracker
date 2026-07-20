<script lang="ts">
  let { class: className = '' }: { class?: string } = $props();
</script>

<svg
  aria-hidden="true"
  viewBox="0 0 24 24"
  class={className}
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M13 2 5.5 13h6L11 22l7.5-12h-6L13 2Z"></path>
</svg>
