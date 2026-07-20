<script lang="ts">
  let { class: className = '' }: { class?: string } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  aria-hidden="true"
  class={className}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m9 18 6-6-6-6" />
</svg>
