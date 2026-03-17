export const STATUS = Object.freeze({
    INITIAL: "initial",
    PENDING: "pending",
    SUCCESS: "success",
    FAILURE: "failure",
} as const);

export type StatusValue = (typeof STATUS)[keyof typeof STATUS];

export interface AstatusState {
    status: string;
    error: unknown;
}

export type AstatusListener = (curr: AstatusState, prev: AstatusState) => void;

export interface AstatusOptions {
    status?: string;
    name?: string;
}

export interface AstatusWaitResult {
    timeout: boolean;
    immediate: boolean;
    destroyed?: boolean;
    status: string;
    error: unknown;
}

export interface Astatus {
    readonly status: string;
    readonly error: unknown;
    readonly isInitial: boolean;
    readonly isPending: boolean;
    readonly isSuccess: boolean;
    readonly isFailure: boolean;
    readonly isCustom: boolean;
    readonly isLocked: boolean;

    initial: () => void;
    pending: () => void;
    success: () => void;
    failure: (error?: unknown) => void;
    custom: (type: string) => void;

    lock: () => void;
    unlock: () => void;

    subscribe: (fn: AstatusListener) => () => void;
    watch: (types: string | string[], fn: AstatusListener) => () => void;
    when: (type: string, fn: AstatusListener) => () => void;

    wait: (
        types?: string | string[],
        timeoutSec?: number,
    ) => Promise<AstatusWaitResult>;

    reset: () => void;
    destroy: () => void;
}

/**
 * astatus
 *
 * A signal that manages only the stage of an async operation
 * (initial / pending / success / failure).
 * Completely decoupled from data and fetch logic —
 * you decide when and where to inject each status.
 *
 * @param options.status - Initial status (default: 'initial')
 * @param options.name - Name for debug logs
 */
const astatus = (options: AstatusOptions = {}): Astatus => {
    const { name = null } = options;
    const _prefix = `[astatus${name ? `:${name}` : ""}]`;
    const _builtinStatuses = new Set<string>(Object.values(STATUS));

    let _status: string = options.status ?? STATUS.INITIAL;
    let _error: unknown = null;
    let _locked = false;
    let _destroyed = false;
    const _listeners = new Set<AstatusListener>();

    // ----------------------------------------
    // Internal utils
    // ----------------------------------------

    const _notify = (prevStatus: string, prevError: unknown): void => {
        const curr: AstatusState = { status: _status, error: _error };
        const prev: AstatusState = { status: prevStatus, error: prevError };
        _listeners.forEach((fn) => {
            try {
                fn(curr, prev);
            } catch (e) {
                console.error(`${_prefix} subscriber error:`, e);
            }
        });
    };

    const _set = (newStatus: string, newError: unknown = null): void => {
        if (_locked || _destroyed) {
            return;
        }
        if (_status === newStatus && _error === newError) {
            return;
        }
        const prevStatus = _status;
        const prevError = _error;
        _status = newStatus;
        _error = newError;
        _notify(prevStatus, prevError);
    };

    // ----------------------------------------
    // Read
    // ----------------------------------------

    const isInitial = () => _status === STATUS.INITIAL;
    const isPending = () => _status === STATUS.PENDING;
    const isSuccess = () => _status === STATUS.SUCCESS;
    const isFailure = () => _status === STATUS.FAILURE;
    const isCustom = () => !_builtinStatuses.has(_status);

    // ----------------------------------------
    // Inject
    // ----------------------------------------

    const initial = () => _set(STATUS.INITIAL);
    const pending = () => _set(STATUS.PENDING);
    const success = () => _set(STATUS.SUCCESS);
    const failure = (error: unknown = null) => _set(STATUS.FAILURE, error);
    const custom = (type: string) => {
        if (!type) {
            console.error(`${_prefix} custom() requires a non-empty string`);
            return;
        }
        _set(type);
    };

    // ----------------------------------------
    // Lock
    // ----------------------------------------

    const lock = () => {
        _locked = true;
    };
    const unlock = () => {
        _locked = false;
    };

    // ----------------------------------------
    // Subscribe
    // ----------------------------------------

    const subscribe = (fn: AstatusListener): (() => void) => {
        if (_destroyed) {
            return () => {};
        }
        _listeners.add(fn);
        return () => _listeners.delete(fn);
    };

    const watch = (
        types: string | string[],
        fn: AstatusListener,
    ): (() => void) => {
        const _types = Array.isArray(types) ? types : [types];
        return subscribe((curr, prev) => {
            if (_types.includes(curr.status) || _types.includes(prev.status))
                fn(curr, prev);
        });
    };

    const when = (type: string, fn: AstatusListener): (() => void) => {
        return subscribe((curr, prev) => {
            if (curr.status === type && prev.status !== type) fn(curr, prev);
        });
    };

    // ----------------------------------------
    // Wait
    // ----------------------------------------

    const wait = (
        types: string | string[] = [STATUS.SUCCESS, STATUS.FAILURE],
        timeoutSec = 10,
    ): Promise<AstatusWaitResult> => {
        const _types = typeof types === "string" ? [types] : types;

        if (_destroyed) {
            return Promise.resolve({
                timeout: false,
                immediate: true,
                destroyed: true,
                status: _status,
                error: _error,
            });
        }

        return new Promise((resolve) => {
            if (_types.includes(_status)) {
                resolve({
                    timeout: false,
                    immediate: true,
                    status: _status,
                    error: _error,
                });
                return;
            }

            let unsubscribe: () => void;

            const timer = setTimeout(() => {
                unsubscribe();
                resolve({
                    timeout: true,
                    immediate: false,
                    status: _status,
                    error: _error,
                });
            }, timeoutSec * 1000);

            unsubscribe = subscribe(({ status, error }) => {
                if (_types.includes(status)) {
                    clearTimeout(timer);
                    unsubscribe();
                    resolve({
                        timeout: false,
                        immediate: false,
                        status,
                        error,
                    });
                }
            });
        });
    };

    // ----------------------------------------
    // Reset / Destroy
    // ----------------------------------------

    const reset = (): void => {
        if (_destroyed) {
            return;
        }
        unlock();
        _set(STATUS.INITIAL);
    };

    const destroy = (): void => {
        _listeners.clear();
        _destroyed = true;
    };

    return {
        get status() {
            return _status;
        },
        get error() {
            return _error;
        },
        get isInitial() {
            return isInitial();
        },
        get isPending() {
            return isPending();
        },
        get isSuccess() {
            return isSuccess();
        },
        get isFailure() {
            return isFailure();
        },
        get isCustom() {
            return isCustom();
        },
        get isLocked() {
            return _locked;
        },

        initial,
        pending,
        success,
        failure,
        custom,

        lock,
        unlock,

        subscribe,
        watch,
        when,

        wait,

        reset,
        destroy,
    };
};

export default astatus;
