import { useMemo, useSyncExternalStore } from 'react';

/** BookmarkButton's storage: `pm-card:favorite:<eventId>` = '1' | '0'; bounty cards use eventId `bounty:<id>`. */
export const SAVED_KEY_PREFIX = 'pm-card:favorite:bounty:';
/** Dispatched on window by BookmarkButton after it writes localStorage. */
export const SAVED_CHANGE_EVENT = 'bounty-saved-change';

type KeyValueStore = Pick<Storage, 'length' | 'key' | 'getItem'>;

/** Saved bounty ids (the part after `bounty:`), read straight from storage. */
export function readSavedIds(storage: KeyValueStore | undefined = globalThis.localStorage): Set<string> {
  const ids = new Set<string>();
  if (!storage) return ids;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(SAVED_KEY_PREFIX) && storage.getItem(key) === '1') ids.add(key.slice(SAVED_KEY_PREFIX.length));
  }
  return ids;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(SAVED_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(SAVED_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

// A string snapshot keeps useSyncExternalStore's identity check stable between unrelated renders.
const snapshot = () => [...readSavedIds()].sort().join('\n');

/** The saved bounty ids, live: follows bookmark toggles in this tab and in other tabs. */
export function useSavedIds(): ReadonlySet<string> {
  const key = useSyncExternalStore(subscribe, snapshot, () => '');
  return useMemo(() => new Set(key ? key.split('\n') : []), [key]);
}
