import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BOARD_BOUNTIES } from '../../lib/bountyData';
import { activity, endedBoardResults, mergeEnded, pastResults, profileStats, PROFILE_LOAD, useEntries, useNow, useProfile } from '../../lib/profile';
import { ActivityPanel } from './ActivityPanel';
import { EarningsCard } from './EarningsCard';
import { EditProfileDialog } from './EditProfileDialog';
import { activeRows, allWon, EntriesPanel } from './EntriesPanel';
import { FOCUS_RING } from './glyphs';
import { IdentityCard } from './IdentityCard';

/**
 * /profile: polymarket.com's profile page reshaped for agent bounties. The two-card top (identity and earnings), then
 * the Live bounties | Won bounties | Activity tabs. Everything reads the localStorage profile and entries through
 * profile.ts, so an edit, a new entry or a verification landing updates the page without a reload.
 */

type Tab = 'live' | 'won' | 'activity';
const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: 'Live bounties' },
  { id: 'won', label: 'Won bounties' },
  { id: 'activity', label: 'Activity' },
];
/* A clear switch: large labels over one hairline, the selected tab underlined by a thick bar sitting on that line. */
const TAB = 'relative -mb-px inline-flex shrink-0 cursor-pointer items-baseline gap-1.5 rounded-t-md pt-1 pb-3 text-heading-xl transition-colors motion-reduce:transition-none';
const TAB_ON = 'text-pk-content-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.75 after:rounded-full after:bg-pk-content-primary';
const TAB_OFF = 'text-pk-content-secondary hover:text-pk-content-primary';
const EDIT_PARAM = 'edit';

const editRequested = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(EDIT_PARAM) === '1';

export function ProfilePage() {
  const profile = useProfile();
  const entries = useEntries();
  const now = useNow();
  const past = useMemo(() => pastResults(PROFILE_LOAD), []);
  const stats = useMemo(() => profileStats(entries, past, profile.handle, BOARD_BOUNTIES, now), [entries, past, profile.handle, now]);
  /** Board bounties you entered whose deadline has passed: they feed the Earnings chart like past results do. */
  const ended = useMemo(() => endedBoardResults(entries, profile.handle, now), [entries, profile.handle, now]);
  const items = useMemo(() => activity(entries, past, BOARD_BOUNTIES, now), [entries, past, now]);

  const counts: Record<Tab, number> = {
    live: useMemo(() => activeRows(entries, profile.handle, BOARD_BOUNTIES, now).length, [entries, profile.handle, now]),
    won: useMemo(() => allWon(entries, past, profile.handle, now).length, [entries, past, profile.handle, now]),
    activity: items.length,
  };

  const [tab, setTab] = useState<Tab>('live');
  const [editing, setEditing] = useState(editRequested);
  /** Bumped on every opening: the dialog remounts with a fresh draft. */
  const [editSession, setEditSession] = useState(0);
  const [announce, setAnnounce] = useState('');
  const editRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ live: null, won: null, activity: null });

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
        <EarningsCard past={mergeEnded(past, ended)} now={now} joinedAt={profile.joinedAt} />
      </div>

      <div role="tablist" aria-label="Profile sections" className="no-scrollbar mt-8 flex gap-6 overflow-x-auto border-b border-pk-border md:gap-8">
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
              className={`${TAB} ${FOCUS_RING} ${selected ? TAB_ON : TAB_OFF}`}
            >
              {t.label}
              <span className="text-body-base font-medium text-pk-content-secondary tabular-nums">{counts[t.id]}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`} data-panel={tab} className="mt-5">
        {tab === 'activity' ? (
          <ActivityPanel items={items} now={now} />
        ) : (
          // Keyed by tab so each list starts with a fresh search and sort.
          <EntriesPanel key={tab} view={tab} entries={entries} past={past} handle={profile.handle} now={now} />
        )}
      </div>

      <EditProfileDialog key={editSession} open={editing} profile={profile} onClose={closeEdit} onSaved={saved} />
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
