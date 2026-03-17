# astatus

Async status signal. No data, no fetch — just the stage.

```js
import astatus from "astatus";

const AS = astatus();

AS.pending();
await fetchUser();
await processData(); // however many steps
AS.success(); // you decide when
```

Most async state libraries tie status to data or fetch logic. `astatus` doesn't.  
It's a standalone signal you inject into any flow, at any point you choose.

---

## Install

```bash
npm install astatus
```

---

## Usage

```js
import astatus, { STATUS } from "astatus";

const loginAS = astatus({ name: "login" });

// Inject status at the right moment
loginAS.pending();
const data = await fetchUser();
await syncStore(data); // sync or async, as many steps as needed
loginAS.success();

// Read
console.log(loginAS.status); // 'success'
console.log(loginAS.isSuccess); // true
```

---

## Vue / Nuxt

`astatus` includes a Vue composable out of the box. No extra install needed.

```ts
import { useAstatus } from "astatus/vue";
```

### Basic usage

```vue
<script setup>
import { useAstatus } from "astatus/vue";

const loginAS = useAstatus({ name: "login" });

const handleLogin = async () => {
    loginAS.pending();
    try {
        await fetchUser();
        loginAS.success();
    } catch (e) {
        loginAS.failure(e);
    }
};
</script>

<template>
    <button :disabled="loginAS.isPending" @click="handleLogin">
        {{ loginAS.isPending ? "Loading..." : "Login" }}
    </button>
    <p v-if="loginAS.isFailure">{{ loginAS.error }}</p>
</template>
```

### Reactivity

`status` and `error` are readonly refs. `isInitial`, `isPending`, `isSuccess`, `isFailure`, `isCustom` are computed values — all reactive and safe to use in templates.

Refs are automatically unwrapped inside templates, so `.value` is not needed there.

```ts
const AS = useAstatus();

// script: use .value
watch(AS.isPending, (val) => {
    console.log("pending:", val);
});

// template: no .value needed
// <p v-if="AS.isPending">...</p>
```

> **Note:** Destructuring breaks reactivity. Always use the returned object directly.
>
> ```ts
> // ✅
> const loginAS = useAstatus();
> // loginAS.isPending in template
>
> // ❌ reactivity lost
> const { isPending } = useAstatus();
> ```

### Auto cleanup

The composable automatically calls `destroy()` on component unmount via `onUnmounted`. No manual cleanup needed in most cases.

If you use `useAstatus` outside of a component (e.g. in a Pinia store), auto cleanup does not apply — call `destroy()` manually when done.

```ts
// Pinia store
const AS = useAstatus();

// when no longer needed
AS.destroy();
```

### wait() in Nuxt

`wait()` uses `setTimeout` internally. In Nuxt, avoid calling it during SSR — use it inside `onMounted` or guard with `import.meta.client`.

```ts
// ✅ safe
onMounted(async () => {
    await AS.wait();
});

// ✅ safe
if (import.meta.client) {
    await AS.wait();
}
```

### Requirements

- Vue >= 3.3.0

---

## API

> All examples use `const AS = astatus()` unless otherwise noted.

### Create

```js
astatus({ name?, status? })
```

| Option   | Type     | Default     | Description         |
| -------- | -------- | ----------- | ------------------- |
| `name`   | `string` | `null`      | Name for debug logs |
| `status` | `string` | `'initial'` | Initial status      |

---

### Inject

```js
AS.initial()
AS.pending()
AS.success()
AS.failure(error?)      // optional error value
AS.custom('uploading')  // any string outside built-in stages
```

---

### Read

```js
AS.status; // 'initial' | 'pending' | 'success' | 'failure' | custom
AS.error; // value passed to failure(), otherwise null
AS.isInitial;
AS.isPending;
AS.isSuccess;
AS.isFailure;
AS.isCustom; // true if current status is not a built-in stage
AS.isLocked;
```

---

### Observe

```js
// All changes
const unsub = AS.subscribe((curr, prev) => {
  console.log(curr.status, prev.status)
})

// Specific status — triggers on both entry and exit
const unwatch = AS.watch('success', (curr, prev) => { ... })
AS.watch(['success', 'failure'], (curr, prev) => { ... })

// Entry only — triggers once on transition into the status
const unwatch = AS.when('success', (curr, prev) => { ... })

// Cleanup
unsub()
unwatch()
```

---

### Wait

```js
// As a timing gate — wait for the right moment, then continue
await AS.wait();
await AS.wait("success");

// As a result — inspect what happened
const { status, error, timeout, immediate } = await AS.wait();
const result = await AS.wait(["success", "failure"], 15); // timeout in seconds
```

| Field       | Description                        |
| ----------- | ---------------------------------- |
| `status`    | Status at resolve time (snapshot)  |
| `error`     | Error at resolve time              |
| `timeout`   | `true` if timed out                |
| `immediate` | `true` if already in target status |
| `destroyed` | `true` if instance was destroyed   |

---

### Lock

```js
AS.lock(); // block all status changes
AS.unlock(); // unblock
```

---

### Reset / Destroy

```js
AS.reset(); // back to initial, clears lock
AS.destroy(); // clears all listeners, blocks all further changes
```

---

### STATUS constant

```js
import { STATUS } from "astatus";

STATUS.INITIAL; // 'initial'
STATUS.PENDING; // 'pending'
STATUS.SUCCESS; // 'success'
STATUS.FAILURE; // 'failure'
```

---

## Notes

- `subscribe` / `watch` / `when` return an unsubscribe function — call it to clean up.
- `destroy()` clears all listeners at once. Useful on route change or component unmount.
- Listener errors are caught and logged individually without breaking other listeners.

---

## License

MIT

---

_Readme partially edited with AI assistance._
