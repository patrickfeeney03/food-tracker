<script lang="ts">
  import { resolve } from "$app/paths";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Sign In | Calorie Tracker</title>
  <meta
    name="description"
    content="Sign in to Calorie Tracker to log meals and keep an eye on your daily nutrition."
  />
</svelte:head>

<main
  class="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#f1f3f6] px-4 py-7 text-[#172130] sm:px-5 sm:py-10"
>
  <div
    class="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(rgba(23,33,48,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(23,33,48,0.025)_1px,transparent_1px)] bg-[size:36px_36px]"
    aria-hidden="true"
  ></div>
  <div
    class="pointer-events-none absolute -top-44 -right-36 -z-10 size-[440px] rounded-full bg-[#2e69eb]/9 blur-[2px]"
    aria-hidden="true"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-60 -left-44 -z-10 size-[480px] rounded-full bg-[#20a36f]/7 blur-[2px]"
    aria-hidden="true"
  ></div>

  <section
    class="relative z-10 w-full max-w-[430px] text-center"
    aria-labelledby="sign-in-heading"
  >
    <div
      class="mx-auto mb-[17px] grid size-14 place-items-center rounded-[18px] border border-white/80 bg-white/75 text-[#2e69eb] shadow-[0_10px_30px_rgba(23,33,48,0.08)] backdrop-blur-[10px] sm:mb-[22px]"
      aria-hidden="true"
    >
      <svg class="size-[38px]" viewBox="0 0 48 48" role="img">
        <path
          d="M24 7.5a16.5 16.5 0 1 0 16.5 16.5"
          fill="none"
          stroke="currentColor"
          stroke-width="6"
          stroke-linecap="round"
        />
        <path
          d="M24 7.5a16.5 16.5 0 0 1 14.3 8.25"
          fill="none"
          stroke="#20a36f"
          stroke-width="6"
          stroke-linecap="round"
        />
        <circle cx="24" cy="24" r="3.5" fill="#172130" />
      </svg>
    </div>

    <p
      class="mb-2.5 text-[0.78rem] font-extrabold tracking-[0.13em] text-[#2e69eb] uppercase"
    >
      Calorie Tracker
    </p>
    <h1
      id="sign-in-heading"
      class="mb-3.5 text-[clamp(2.25rem,9vw,3.15rem)] leading-[0.98] font-extrabold tracking-[-0.052em]"
    >
      Your nutrition,<br />made simple.
    </h1>
    <p class="mx-auto max-w-[350px] text-base leading-relaxed text-[#727e91]">
      Log meals, follow your macros, and see what is left for the day.
    </p>

    <div
      class="mt-[22px] mb-3.5 grid grid-cols-[1.25fr_1fr_1fr] gap-2 sm:mt-7"
      aria-label="Track calories, protein, carbohydrates and fat"
    >
      <div
        class="relative min-w-0 overflow-hidden rounded-[15px] border border-[#dce2ea]/90 bg-white/70 px-3 pt-[13px] pb-3 text-left text-[#2e69eb] backdrop-blur-[10px] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-current after:content-['']"
      >
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[#727e91]"
          >Calories</span
        >
        <strong
          class="my-1 block text-[1.1rem] leading-none font-bold tracking-[-0.03em] text-[#172130]"
          >2,900</strong
        >
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[#727e91]"
          >daily goal</span
        >
      </div>
      <div
        class="relative min-w-0 overflow-hidden rounded-[15px] border border-[#dce2ea]/90 bg-white/70 px-3 pt-[13px] pb-3 text-left text-[#7658dd] backdrop-blur-[10px] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-current after:content-['']"
      >
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[#727e91]"
          >Protein</span
        >
        <strong
          class="my-1 block text-[1.1rem] leading-none font-bold tracking-[-0.03em] text-[#172130]"
        >
          200<span class="text-[0.72rem] font-semibold text-[#727e91]">g</span>
        </strong>
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[#727e91]"
          >daily goal</span
        >
      </div>
      <div
        class="relative min-w-0 overflow-hidden rounded-[15px] border border-[#dce2ea]/90 bg-white/70 px-3 pt-[13px] pb-3 text-left text-[#e69018] backdrop-blur-[10px] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-current after:content-['']"
      >
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[#727e91]"
          >Carbs</span
        >
        <strong
          class="my-1 block text-[1.1rem] leading-none font-bold tracking-[-0.03em] text-[#172130]"
        >
          300<span class="text-[0.72rem] font-semibold text-[#727e91]">g</span>
        </strong>
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[#727e91]"
          >daily goal</span
        >
      </div>
    </div>

    <div
      class="rounded-[22px] border border-[#dce2ea]/95 bg-white/95 px-5 py-6 shadow-[0_24px_60px_rgba(23,33,48,0.09),0_2px_8px_rgba(23,33,48,0.035)] backdrop-blur-2xl sm:rounded-3xl sm:p-7"
    >
      <div class="mb-[22px]">
        <h2 class="mb-1 text-xl font-extrabold tracking-[-0.025em]">Welcome</h2>
        <p class="text-sm text-[#727e91]">Sign in to open your food diary.</p>
      </div>

      {#if data.errorMessage}
        <div
          class="mb-4 flex gap-[11px] rounded-[13px] border border-[#f4c7c7] bg-[#fff5f5] p-3 text-left text-[#b33c3c]"
          role="alert"
        >
          <svg
            class="mt-px size-5 shrink-0"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              d="M10 6.5v4M10 14h.01M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            />
          </svg>
          <div>
            <strong class="mb-0.5 block text-[0.78rem] text-[#8f2f2f]">
              We couldn't sign you in
            </strong>
            <span class="block text-[0.78rem] leading-[1.45]">
              {data.errorMessage}
            </span>
          </div>
        </div>
      {/if}

      <a
        class="flex min-h-[54px] w-full items-center justify-center gap-3 rounded-[14px] bg-[#2e69eb] text-[0.94rem] font-bold text-white no-underline shadow-[0_8px_20px_rgba(46,105,235,0.2)] transition duration-150 ease-out hover:-translate-y-px hover:bg-[#245fdc] hover:shadow-[0_10px_24px_rgba(46,105,235,0.26)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2e69eb]/30 active:translate-y-0 active:shadow-[0_5px_14px_rgba(46,105,235,0.2)] motion-reduce:transition-none"
        href={resolve("/auth/google")}
      >
        <svg
          class="box-content size-[22px] rounded-full bg-white p-[3px]"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="#4285f4"
            d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
          />
          <path
            fill="#34a853"
            d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.25-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.05v2.62A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#fbbc05"
            d="M6.4 13.94A6 6 0 0 1 6.08 12c0-.67.12-1.33.32-1.94V7.44H3.05A10 10 0 0 0 2 12c0 1.64.4 3.2 1.05 4.56l3.35-2.62Z"
          />
          <path
            fill="#ea4335"
            d="M12 5.94c1.47 0 2.8.5 3.84 1.5l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.44l3.35 2.62c.8-2.36 3-4.12 5.6-4.12Z"
          />
        </svg>
        <span>
          {data.errorMessage
            ? "Try another Google account"
            : "Continue with Google"}
        </span>
      </a>

      <p
        class="mt-4 mb-0 flex items-center justify-center gap-1.5 text-[0.72rem] leading-[1.4] text-[#727e91]"
      >
        <svg class="size-[15px]" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M5.5 8V6.25a4.5 4.5 0 0 1 9 0V8m-10 0h11A1.5 1.5 0 0 1 17 9.5v7A1.5 1.5 0 0 1 15.5 18h-11A1.5 1.5 0 0 1 3 16.5v-7A1.5 1.5 0 0 1 4.5 8Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        This is a private, invite-only tracker.
      </p>
    </div>
  </section>

  <p
    class="relative z-10 mt-6 mb-0 text-[0.72rem] font-semibold tracking-[0.03em] text-[#8993a3]"
  >
    A calmer way to stay on track.
  </p>
</main>
