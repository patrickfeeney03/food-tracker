<script lang="ts">
  let {
    class: className = '',
    strokeWidth = '1.7'
  }: {
    class?: string;
    strokeWidth?: string;
  } = $props();
</script>

<svg
  aria-hidden="true"
  viewBox="0 0 24 24"
  class={className}
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
>
  <path d="M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14"></path>
</svg>
