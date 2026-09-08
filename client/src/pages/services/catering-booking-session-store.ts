import { useSyncExternalStore } from "react";

/**
 * State that outlives the component holding it, for the browser session.
 *
 * Both booking sections keep their pending mutations in booking-keyed maps, which was enough while the section
 * stayed mounted: navigating between bookings changed a prop, not the component. Following Back out of the
 * workspace does something different -- it UNMOUNTS the section, and component state dies with it.
 *
 * That is not a cosmetic loss. The state destroyed includes the `clientRequestId` of a request that is still in
 * flight. Returning before it settles gave a fresh component with no knowledge of the attempt: the control was
 * offered again, the next submission minted a NEW token, and the server -- correctly -- treated it as a second
 * logical message or a second upload. Every exactly-once guarantee in Phase 2I rests on that token surviving for
 * as long as its request might, and a request outlives the component that started it.
 *
 * So the authority moves out of the instance and into a module-scoped store. It is deliberately the smallest thing
 * that can be: one value, one set of subscribers, no dependencies, no persistence, no serialization. Nothing here
 * is written to `localStorage` or `sessionStorage` -- a `File` cannot be, and booking text should not be -- so a
 * reload or a new tab legitimately starts empty. Surviving a route change is the whole requirement.
 *
 * `read()` is the synchronous authority, which is what a completion callback needs: it fires long after its render
 * and must resolve against what is true NOW, not against a snapshot React last committed. `useCateringSession`
 * subscribes a component to the same value for rendering, so the two can never disagree.
 */
export type CateringSessionStore<T> = {
  /** The current value. Always the latest, with no commit or effect in between. */
  read: () => T;
  /** Applies a transition. Returning the same value notifies nobody, so an inert update renders nothing. */
  update: (apply: (current: T) => T) => T;
  subscribe: (listener: () => void) => () => void;
};

export function createCateringSessionStore<T>(initial: T): CateringSessionStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    read: () => value,
    update: (apply) => {
      const next = apply(value);
      if (next === value) return value;
      value = next;
      listeners.forEach((listener) => listener());
      return value;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/**
 * Replaces one field of a session record, leaving the record itself untouched when nothing changed.
 *
 * The per-field shape is what keeps each call site reading like the `useState` setter it replaces, and the identity
 * check is what stops an inert transition -- settling a booking that holds nothing, say -- from rerendering every
 * subscriber.
 */
export function updateCateringSessionField<T, K extends keyof T>(store: CateringSessionStore<T>, field: K, apply: (value: T[K]) => T[K]): void {
  store.update((current) => {
    const next = apply(current[field]);
    return next === current[field] ? current : { ...current, [field]: next };
  });
}

/**
 * Subscribes a component to a session store.
 *
 * `subscribe` and `read` are created once by the factory, so they are stable across renders, and `read` returns the
 * same object until a real transition replaces it -- both of which `useSyncExternalStore` requires. The third
 * argument is the same reading again: there is no server render of a booking workspace, and answering with a
 * different value there would tear.
 */
export function useCateringSession<T>(store: CateringSessionStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.read, store.read);
}
