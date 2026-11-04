import { Ref, ShallowRef, WatchSource, ref, shallowRef, watch } from "vue";

export interface AutoCalc<R> {
  result: ShallowRef<R | null>;
  error: Ref<string | null>;
  loading: Ref<boolean>;
}

const DEBOUNCE_MS = 120;

// Reruns `run` when `source` changes, debounced. Only the latest run updates
// the state, so a slow early run can't overwrite a newer result.
export function useAutoCalc<S, R>(source: WatchSource<S | null>, run: (value: S) => R | Promise<R>): AutoCalc<R> {
  const result = shallowRef<R | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticket = 0;

  // Never rejects: failures end up in `error`.
  async function compute(value: S | null): Promise<void> {
    const mine = ++ticket;
    if (value == null) {
      result.value = null;
      error.value = null;
      return;
    }
    loading.value = true;
    try {
      const outcome = await run(value);
      if (mine === ticket) {
        result.value = outcome;
        error.value = null;
      }
    } catch (e) {
      if (mine === ticket) {
        result.value = null;
        error.value = e instanceof Error ? e.message : String(e);
      }
    } finally {
      if (mine === ticket) loading.value = false;
    }
  }

  watch(
    source,
    (value) => {
      clearTimeout(timer);
      timer = setTimeout(() => void compute(value), DEBOUNCE_MS);
    },
    { deep: true, immediate: true },
  );
  return { result, error, loading };
}
