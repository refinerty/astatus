import { describe, it, expect, vi, afterEach } from "vitest";
import astatus, { STATUS } from "../src/index.js";

describe("astatus", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    // ----------------------------------------
    // 1. 초기 상태
    // ----------------------------------------
    it("기본 초기 상태는 initial이어야 한다", () => {
        const AS = astatus();
        expect(AS.status).toBe(STATUS.INITIAL);
        expect(AS.isInitial).toBe(true);
        expect(AS.isPending).toBe(false);
        expect(AS.isSuccess).toBe(false);
        expect(AS.isFailure).toBe(false);
        expect(AS.isCustom).toBe(false);
        expect(AS.isLocked).toBe(false);
        expect(AS.error).toBeNull();
    });

    // ----------------------------------------
    // 2. 커스텀 초기 상태
    // ----------------------------------------
    it("options.status로 초기 상태를 지정할 수 있다", () => {
        const AS = astatus({ status: STATUS.PENDING });
        expect(AS.status).toBe(STATUS.PENDING);
        expect(AS.isPending).toBe(true);
    });

    // ----------------------------------------
    // 3. 상태 주입 흐름
    // ----------------------------------------
    it("initial → pending → success 흐름이 정상 동작해야 한다", () => {
        const AS = astatus();
        AS.pending();
        expect(AS.isPending).toBe(true);
        AS.success();
        expect(AS.isSuccess).toBe(true);
        expect(AS.isPending).toBe(false);
    });

    // ----------------------------------------
    // 4. failure + error 값
    // ----------------------------------------
    it("failure()에 전달한 error가 저장되어야 한다", () => {
        const AS = astatus();
        const err = new Error("network error");
        AS.failure(err);
        expect(AS.isFailure).toBe(true);
        expect(AS.error).toBe(err);
    });

    it("success()로 전환하면 error가 null로 초기화되어야 한다", () => {
        const AS = astatus();
        AS.failure(new Error("fail"));
        expect(AS.error).not.toBeNull();
        AS.success();
        expect(AS.isSuccess).toBe(true);
        expect(AS.error).toBeNull();
    });

    // ----------------------------------------
    // 5. custom 상태
    // ----------------------------------------
    it("custom() 상태는 isCustom이 true여야 한다", () => {
        const AS = astatus();
        AS.custom("uploading");
        expect(AS.status).toBe("uploading");
        expect(AS.isCustom).toBe(true);
        expect(AS.isInitial).toBe(false);
    });

    it("custom()에 빈 문자열을 전달하면 상태가 변경되지 않아야 한다", () => {
        const AS = astatus();
        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        AS.custom("");
        expect(AS.status).toBe(STATUS.INITIAL);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    // ----------------------------------------
    // 6. 동일 상태 중복 주입
    // ----------------------------------------
    it("동일한 상태를 재주입해도 subscriber가 호출되지 않아야 한다", () => {
        const AS = astatus();
        const fn = vi.fn();
        AS.subscribe(fn);
        AS.initial(); // 이미 initial
        expect(fn).not.toHaveBeenCalled();
    });

    // ----------------------------------------
    // 7. subscribe
    // ----------------------------------------
    it("subscribe는 상태 변경 시 curr/prev를 올바르게 전달해야 한다", () => {
        const AS = astatus();
        const fn = vi.fn();
        AS.subscribe(fn);
        AS.pending();
        expect(fn).toHaveBeenCalledWith(
            { status: "pending", error: null },
            { status: "initial", error: null },
        );
    });

    it("unsubscribe 후에는 subscriber가 호출되지 않아야 한다", () => {
        const AS = astatus();
        const fn = vi.fn();
        const unsub = AS.subscribe(fn);
        unsub();
        AS.pending();
        expect(fn).not.toHaveBeenCalled();
    });

    // ----------------------------------------
    // 8. watch
    // ----------------------------------------
    it("watch는 지정한 상태로 진입할 때 호출되어야 한다", () => {
        const AS = astatus();
        const fn = vi.fn();
        AS.watch("success", fn);
        AS.pending();
        expect(fn).not.toHaveBeenCalled();
        AS.success();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("watch는 지정한 상태에서 이탈할 때도 호출되어야 한다", () => {
        const AS = astatus();
        const fn = vi.fn();
        AS.watch("pending", fn);
        AS.pending();
        expect(fn).toHaveBeenNthCalledWith(
            1,
            { status: "pending", error: null },
            { status: "initial", error: null },
        );
        AS.success();
        expect(fn).toHaveBeenNthCalledWith(
            2,
            { status: "success", error: null },
            { status: "pending", error: null },
        );
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("watch는 배열로 여러 상태를 동시에 감시할 수 있어야 한다", () => {
        const AS = astatus();
        const fn = vi.fn();
        AS.watch(["success", "failure"], fn);
        AS.success();
        AS.failure();
        expect(fn).toHaveBeenCalledTimes(2);
    });

    // ----------------------------------------
    // 9. when
    // ----------------------------------------
    it("when은 진입 시점에만 호출되어야 한다", () => {
        const AS = astatus();
        const fn = vi.fn();
        AS.when("success", fn);
        AS.success();
        AS.success(); // 동일 상태 재주입 — 호출 안 됨
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("when은 다른 상태를 거쳐 재진입하면 다시 호출되어야 한다", () => {
        const AS = astatus();
        const fn = vi.fn();
        AS.when("success", fn);
        AS.success();
        expect(fn).toHaveBeenCalledTimes(1);
        AS.failure();
        expect(fn).toHaveBeenCalledTimes(1); // failure에선 호출 안 됨
        AS.success();
        expect(fn).toHaveBeenCalledTimes(2);
    });

    // ----------------------------------------
    // 10. lock / unlock
    // ----------------------------------------
    it("lock 중에는 상태가 변경되지 않아야 한다", () => {
        const AS = astatus();
        AS.lock();
        AS.pending();
        expect(AS.status).toBe(STATUS.INITIAL);
        expect(AS.isLocked).toBe(true);
    });

    it("unlock 후에는 상태 변경이 다시 가능해야 한다", () => {
        const AS = astatus();
        AS.lock();
        AS.pending();
        AS.unlock();
        AS.pending();
        expect(AS.isPending).toBe(true);
    });

    // ----------------------------------------
    // 11. reset
    // ----------------------------------------
    it("reset()은 상태를 initial로 되돌리고 lock을 해제해야 한다", () => {
        const AS = astatus();
        AS.pending();
        AS.lock();
        AS.reset();
        expect(AS.status).toBe(STATUS.INITIAL);
        expect(AS.isLocked).toBe(false);
    });

    it("reset() 후에도 subscriber는 유지되어야 한다", () => {
        const AS = astatus();
        const fn = vi.fn();
        AS.subscribe(fn);
        AS.pending();
        AS.reset();
        expect(fn).toHaveBeenCalledTimes(2); // pending 진입 + initial 복귀
    });

    // ----------------------------------------
    // 12. wait
    // ----------------------------------------
    it("wait()은 success 진입 시 resolve되어야 한다", async () => {
        const AS = astatus();
        setTimeout(() => AS.success(), 50);
        const result = await AS.wait();
        expect(result.status).toBe("success");
        expect(result.timeout).toBe(false);
        expect(result.immediate).toBe(false);
    });

    it("wait()은 이미 target 상태이면 즉시 resolve되어야 한다", async () => {
        const AS = astatus({ status: STATUS.SUCCESS });
        const result = await AS.wait();
        expect(result.immediate).toBe(true);
        expect(result.status).toBe("success");
    });

    it("wait()은 타임아웃 시 timeout: true로 resolve되어야 한다", async () => {
        vi.useFakeTimers();
        try {
            const AS = astatus();
            const promise = AS.wait([STATUS.SUCCESS], 5);
            vi.advanceTimersByTime(5001);
            const result = await promise;
            expect(result.timeout).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    // ----------------------------------------
    // 13. destroy
    // ----------------------------------------
    it("destroy() 후에는 상태 변경이 차단되어야 한다", () => {
        const AS = astatus();
        AS.destroy();
        AS.pending();
        expect(AS.status).toBe(STATUS.INITIAL);
    });

    it("destroy() 후 subscribe는 아무것도 등록하지 않아야 한다", () => {
        const AS = astatus();
        AS.destroy();
        const fn = vi.fn();
        const unsub = AS.subscribe(fn);
        AS.pending();
        expect(fn).not.toHaveBeenCalled();
        expect(unsub).toBeTypeOf("function");
    });

    it("destroy() 후 wait()은 destroyed: true로 즉시 resolve되어야 한다", async () => {
        const AS = astatus();
        AS.destroy();
        const result = await AS.wait();
        expect(result.destroyed).toBe(true);
        expect(result.immediate).toBe(true);
    });

    // ----------------------------------------
    // 14. subscriber 에러 격리
    // ----------------------------------------
    it("subscriber 하나가 에러를 던져도 다른 subscriber는 정상 호출되어야 한다", () => {
        const AS = astatus();
        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const badFn = vi.fn(() => {
            throw new Error("boom");
        });
        const goodFn = vi.fn();
        AS.subscribe(badFn);
        AS.subscribe(goodFn);
        AS.pending();
        expect(goodFn).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
