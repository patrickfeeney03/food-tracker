<script lang="ts">
  import { resolve } from "$app/paths";
  import AlertCircleIcon from "$lib/components/icons/AlertCircleIcon.svelte";
  import AppMark from "$lib/components/icons/AppMark.svelte";
  import GoogleLogo from "$lib/components/icons/GoogleLogo.svelte";
  import LockIcon from "$lib/components/icons/LockIcon.svelte";
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
  class="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--app-auth-canvas)] px-4 py-7 text-[var(--app-text)] sm:px-5 sm:py-10"
>
  <div
    class="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(rgba(23,33,48,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(23,33,48,0.025)_1px,transparent_1px)] bg-[size:36px_36px] dark:bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)]"
    aria-hidden="true"
  ></div>
  <div
    class="pointer-events-none absolute -top-44 -right-36 -z-10 size-[440px] rounded-full bg-[var(--app-accent)]/9 blur-[2px]"
    aria-hidden="true"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-60 -left-44 -z-10 size-[480px] rounded-full bg-[var(--app-green)]/7 blur-[2px]"
    aria-hidden="true"
  ></div>

  <section
    class="relative z-10 w-full max-w-[430px] text-center"
    aria-labelledby="sign-in-heading"
  >
    <div
      class="mx-auto mb-[17px] grid size-14 place-items-center rounded-[18px] border border-[var(--app-border)]/80 bg-[var(--app-panel)]/75 text-[var(--app-accent)] shadow-[0_10px_30px_rgba(23,33,48,0.08)] backdrop-blur-[10px] sm:mb-[22px]"
      aria-hidden="true"
    >
      <AppMark class="size-[38px]" />
    </div>

    <p
      class="mb-2.5 text-[0.78rem] font-extrabold tracking-[0.13em] text-[var(--app-accent)] uppercase"
    >
      Calorie Tracker
    </p>
    <h1
      id="sign-in-heading"
      class="mb-3.5 text-[clamp(2.25rem,9vw,3.15rem)] leading-[0.98] font-extrabold tracking-[-0.052em]"
    >
      Your nutrition,<br />made simple.
    </h1>
    <p class="mx-auto max-w-[350px] text-base leading-relaxed text-[var(--app-muted)]">
      Log meals, follow your macros, and see what is left for the day.
    </p>

    <div
      class="mt-[22px] mb-3.5 grid grid-cols-[1.25fr_1fr_1fr] gap-2 sm:mt-7"
      aria-label="Track calories, protein, carbohydrates and fat"
    >
      <div
        class="relative min-w-0 overflow-hidden rounded-[15px] border border-[var(--app-border)]/90 bg-[var(--app-panel)]/70 px-3 pt-[13px] pb-3 text-left text-[var(--app-accent)] backdrop-blur-[10px] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-current after:content-['']"
      >
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[var(--app-muted)]"
          >Calories</span
        >
        <strong
          class="my-1 block text-[1.1rem] leading-none font-bold tracking-[-0.03em] text-[var(--app-text)]"
          >2,900</strong
        >
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[var(--app-muted)]"
          >daily goal</span
        >
      </div>
      <div
        class="relative min-w-0 overflow-hidden rounded-[15px] border border-[var(--app-border)]/90 bg-[var(--app-panel)]/70 px-3 pt-[13px] pb-3 text-left text-[var(--app-purple)] backdrop-blur-[10px] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-current after:content-['']"
      >
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[var(--app-muted)]"
          >Protein</span
        >
        <strong
          class="my-1 block text-[1.1rem] leading-none font-bold tracking-[-0.03em] text-[var(--app-text)]"
        >
          200<span class="text-[0.72rem] font-semibold text-[var(--app-muted)]">g</span>
        </strong>
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[var(--app-muted)]"
          >daily goal</span
        >
      </div>
      <div
        class="relative min-w-0 overflow-hidden rounded-[15px] border border-[var(--app-border)]/90 bg-[var(--app-panel)]/70 px-3 pt-[13px] pb-3 text-left text-[var(--app-orange)] backdrop-blur-[10px] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-current after:content-['']"
      >
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[var(--app-muted)]"
          >Carbs</span
        >
        <strong
          class="my-1 block text-[1.1rem] leading-none font-bold tracking-[-0.03em] text-[var(--app-text)]"
        >
          300<span class="text-[0.72rem] font-semibold text-[var(--app-muted)]">g</span>
        </strong>
        <span
          class="block overflow-hidden text-[0.67rem] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-[var(--app-muted)]"
          >daily goal</span
        >
      </div>
    </div>

    <div
      class="rounded-[22px] border border-[var(--app-border)]/95 bg-[var(--app-panel)]/95 px-5 py-6 shadow-[0_24px_60px_rgba(23,33,48,0.09),0_2px_8px_rgba(23,33,48,0.035)] backdrop-blur-2xl sm:rounded-3xl sm:p-7"
    >
      <div class="mb-[22px]">
        <h2 class="mb-1 text-xl font-extrabold tracking-[-0.025em]">Welcome</h2>
        <p class="text-sm text-[var(--app-muted)]">Sign in to open your food diary.</p>
      </div>

      {#if data.errorMessage}
        <div
          class="mb-4 flex gap-[11px] rounded-[13px] border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-left text-[var(--app-danger-text)]"
          role="alert"
        >
          <AlertCircleIcon class="mt-px size-5 shrink-0" />
          <div>
            <strong class="mb-0.5 block text-[0.78rem] text-[var(--app-danger-strong)]">
              We couldn't sign you in
            </strong>
            <span class="block text-[0.78rem] leading-[1.45]">
              {data.errorMessage}
            </span>
          </div>
        </div>
      {/if}

      <a
        class="flex min-h-[54px] w-full items-center justify-center gap-3 rounded-[14px] bg-[var(--app-accent)] text-[0.94rem] font-bold text-white no-underline shadow-[0_8px_20px_rgba(46,105,235,0.2)] transition duration-150 ease-out hover:-translate-y-px hover:bg-[var(--app-accent-hover)] hover:shadow-[0_10px_24px_rgba(46,105,235,0.26)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--app-accent)]/30 active:translate-y-0 active:shadow-[0_5px_14px_rgba(46,105,235,0.2)] motion-reduce:transition-none"
        href={resolve("/auth/google")}
      >
        <GoogleLogo class="box-content size-[22px] rounded-full bg-white p-[3px]" />
        <span>
          {data.errorMessage
            ? "Try another Google account"
            : "Continue with Google"}
        </span>
      </a>

      <p
        class="mt-4 mb-0 flex items-center justify-center gap-1.5 text-[0.72rem] leading-[1.4] text-[var(--app-muted)]"
      >
        <LockIcon class="size-[15px]" />
        This is a private, invite-only tracker.
      </p>
    </div>
  </section>

  <p
    class="relative z-10 mt-6 mb-0 text-[0.72rem] font-semibold tracking-[0.03em] text-[var(--app-muted)]"
  >
    A calmer way to stay on track.
  </p>
</main>
