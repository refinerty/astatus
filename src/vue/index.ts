import { ref, readonly, computed, onUnmounted, hasInjectionContext } from "vue";
import astatus, { STATUS, type AstatusOptions } from "astatus";

const BUILTIN_STATUSES = new Set<string>(Object.values(STATUS));

export const useAstatus = (options: AstatusOptions = {}) => {
    const instance = astatus(options);

    const status = ref<string>(instance.status);
    const error = ref<unknown>(instance.error);

    const unsub = instance.subscribe((curr) => {
        status.value = curr.status;
        error.value = curr.error;
    });

    const destroy = () => {
        unsub();
        instance.destroy();
    };

    if (hasInjectionContext()) {
        onUnmounted(destroy);
    }

    const isInitial = computed(() => status.value === STATUS.INITIAL);
    const isPending = computed(() => status.value === STATUS.PENDING);
    const isSuccess = computed(() => status.value === STATUS.SUCCESS);
    const isFailure = computed(() => status.value === STATUS.FAILURE);
    const isCustom = computed(() => !BUILTIN_STATUSES.has(status.value));

    const isLocked = () => instance.isLocked;

    return {
        status: readonly(status),
        error: readonly(error),

        isInitial,
        isPending,
        isSuccess,
        isFailure,
        isCustom,
        isLocked,

        name: options.name ?? null,

        initial: instance.initial,
        pending: instance.pending,
        success: instance.success,
        failure: instance.failure,
        custom: instance.custom,

        lock: instance.lock,
        unlock: instance.unlock,
        wait: instance.wait,
        reset: instance.reset,
        destroy,
    };
};
