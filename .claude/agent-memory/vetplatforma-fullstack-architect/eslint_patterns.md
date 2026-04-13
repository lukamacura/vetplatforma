---
name: ESLint patterns to watch
description: Known ESLint rules that trigger in this codebase and how to fix them
type: feedback
---

The project uses a custom ESLint rule (`react-hooks/set-state-in-effect`) that flags `setState()` called directly inside a `useEffect` body.

**Why:** Cascading renders; the rule treats synchronous setState in effects as an anti-pattern.

**How to apply:** When a useEffect exists solely to set state from already-available state/props, replace it with `useMemo`. Example: `useEffect(() => { setAvailableDays(compute(map)) }, [map])` → `const availableDays = useMemo(() => compute(map), [map])`.

Also: `let` declarations that are never reassigned must be `const` — linter enforces `prefer-const`.
