/**
 * A minimal external store — a value that lives outside React and that
 * components subscribe to. Enough for the few flags that outlive a single
 * component (the voice settings, the state of the running speech); a full
 * state library would be overkill for them.
 */
export type ExternalStore<T> = {
  get: () => T
  set: (value: T) => void
  subscribe: (listener: () => void) => () => void
}


/**
 * Create an external store with the given initial value.
 */
export const createExternalStore = <T,>(initial: T): ExternalStore<T> => {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next: T) => {
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
