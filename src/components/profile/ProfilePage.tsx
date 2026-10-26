import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BOARD_BOUNTIES } from '../../lib/bountyData';
import { activity, pastResults, profileStats, PROFILE_LOAD, useEntries, useNow, useProfile } from '../../lib/profile';
import { ActivityPanel } from './ActivityPanel';
import { EarningsCard } from './EarningsCard';
import { EditProfileDialog } from './EditProfileDialog';
import { EntriesPanel } from './EntriesPanel';
import { FOCUS_RING, TAB_LABEL } from './glyphs';
import { IdentityCard } from './IdentityCard';

/**
 * /profile: polymarket.com's profile page reshaped for agent bounties. The two-card top (identity and earnings), then
 * the Entries | Activity tabs. Everything reads the localStorage profile and entries through profile.ts, so an edit,
 * a new entry or a verification landing updates the page without a reload.
 */

type Tab = 'entries' | 'activity';
const TABS: { id: Tab; label: string }[] = [
  { id: 'entries', label: 'Entries' },
  { id: 'activity', label: 'Activity' },
];
const EDIT_PARAM = 'edit';

const editRequested = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(EDIT_PARAM) === '1';

export function ProfilePage() {
  const profile = useProfile();
  const entries = useEntries();
  const now = useNow();
  const past = useMemo(() => pastResults(PROFILE_LOAD), []);
  const stats = useMemo(() => profileStats(entries, past, profile.handle, BOARD_BOUNTIES), [entries, past, profile.handle]);
  const items = useMemo(() => activity(entries, past, BOARD_BOUNTIES), [entries, past]);

  const [tab, setTab] = useState<Tab>('entries');
  const [editing, setEditing] = useState(editRequested);
  /** Bumped on every opening: the dialog remounts with a fresh draft. */
  const [editSession, setEditSession] = useState(0);
  const [announce, setAnnounce] = useState('');
  const editRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ entries: null, activity: null });

  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const closeEdit = useCallback(() => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    // Drop ?edit=1 so a reload does not reopen it, and hand focus back to the button that opens it.
    const url = new URL(window.location.href);
    if (url.searchParams.has(EDIT_PARAM)) {
      url.searchParams.delete(EDIT_PARAM);
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    requestAnimationFrame(() => editRef.current?.focus());
  }, []);

  const saved = useCallback(() => {
    closeEdit();
    setAnnounce('');
    // A fresh string each save so the live region speaks again.
    requestAnimationFrame(() => setAnnounce('Profile saved'));
  }, [closeEdit]);

  const openEdit = useCallback(() => {
    if (editingRef.current) return;
    setEditSession((n) => n + 1);
    setEditing(true);
  }, []);

  // Back/Forward onto /profile?edit=1 opens the dialog too.
  useEffect(() => {
    const onPop = () => {
      if (editRequested()) openEdit();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [openEdit]);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  return (
    <div data-testid="profile-page" className="mx-auto w-full max-w-[816px] px-4 pt-6 pb-16 lg:px-0">
      <div className="grid gap-4 md:grid-cols-2">
        <IdentityCard profile={profile} stats={stats} onEdit={openEdit} editRef={editRef} />
        <EarningsCard past={past} now={now} joinedAt={profile.joinedAt} />
      </div>

      <div role="tablist" aria-label="Profile sections" className="no-scrollbar mt-8 -mx-1 flex gap-5 overflow-x-auto px-1">
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`profile-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`profile-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={onTabKey}
              data-testid={`profile-tab-${t.id}`}
              className={`shrink-0 cursor-pointer rounded-md py-1 transition-colors motion-reduce:transition-none ${TAB_LABEL} ${FOCUS_RING} ${
                selected ? 'text-pk-content-primary' : 'text-pk-content-secondary hover:text-pk-content-primary'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`} data-panel={tab} className="mt-4">
        {tab === 'entries' ? <EntriesPanel entries={entries} past={past} handle={profile.handle} now={now} /> : <ActivityPanel items={items} now={now} />}
      </div>

      <EditProfileDialog key={editSession} open={editing} profile={profile} onClose={closeEdit} onSaved={saved} />
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
