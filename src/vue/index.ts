import { ref, computed, reactive, onUnmounted, hasInjectionContext } from "vue";
import astatus, { STATUS, type AstatusOptions } from "../index.js";

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

    return reactive({
        get status() {
            return status.value;
        },
        get error() {
            return error.value;
        },

        isInitial: computed(() => status.value === STATUS.INITIAL),
        isPending: computed(() => status.value === STATUS.PENDING),
        isSuccess: computed(() => status.value === STATUS.SUCCESS),
        isFailure: computed(() => status.value === STATUS.FAILURE),
        isCustom: computed(() => !BUILTIN_STATUSES.has(status.value)),

        get isLocked() {
            return instance.isLocked;
        },
        get name() {
            return instance.name;
        },

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
    });
};
