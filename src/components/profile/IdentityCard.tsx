import { useEffect, useRef, useState, type Ref } from 'react';
import { formatBountyAmount } from '../../lib/bounty';
import type { Profile, ProfileStats } from '../../lib/profile';
import { Avatar } from './Avatar';
import { CheckGlyph, CopyGlyph, FOCUS_RING, HEADING_LG, ICON_BUTTON, Meta, XGlyph } from './glyphs';

/**
 * The left card of the profile's two-card top: polymarket's identity card (avatar, name, joined line, bio, three
 * stats, then key-value lines) with agent-bounty numbers. Prizes on track is our Positions Value; Total earned sits in
 * Total PnL's slot.
 */

const JOINED = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const COPIED_MS = 1500;

/** "AdRn…MaZt": the wallet's first and last four characters. */
export const shortWallet = (w: string): string => (w.length > 10 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w);

/** Writes to the clipboard; true when it landed. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function IdentityCard({ profile, stats, onEdit, editRef }: { profile: Profile; stats: ProfileStats; onEdit: () => void; editRef: Ref<HTMLButtonElement> }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copyWallet = async () => {
    if (!(await copyText(profile.wallet))) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const joined = JOINED.format(new Date(profile.joinedAt));
  const best = stats.bestFinish;

  return (
    <section aria-labelledby="profile-name" data-testid="profile-identity" className="flex min-w-0 flex-col rounded-xl border border-pk-border bg-pk-elevated p-4">
      <div className="flex items-start gap-3">
        <Avatar profile={profile} size={56} testId="profile-avatar" />
        {/* The buttons share the name row only, so the handle and joined line get the column's full width. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <h1 id="profile-name" data-testid="profile-display-name" className="min-w-0 truncate text-heading-xl text-pk-content-primary">
                {profile.displayName}
              </h1>
              {profile.x && (
                <a
                  href={`https://x.com/${encodeURIComponent(profile.x)}`}
                  target="_blank"
                  rel="noopener"
                  aria-label={`@${profile.x} on X`}
                  className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none ${FOCUS_RING}`}
                >
                  <XGlyph />
                </a>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                ref={editRef}
                type="button"
                onClick={onEdit}
                data-testid="profile-edit-button"
                className={`inline-flex h-8 cursor-pointer items-center rounded-md border border-pk-gray-200 bg-pk-elevated px-3 text-body-sm font-semibold text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none ${FOCUS_RING}`}
              >
                Edit profile
              </button>
              <button
                type="button"
                onClick={copyWallet}
                aria-label={copied ? 'Wallet address copied' : `Copy wallet address ${shortWallet(profile.wallet)}`}
                data-testid="profile-copy-wallet"
                data-copied={copied || undefined}
                className={ICON_BUTTON}
              >
                {copied ? <CheckGlyph className="size-5 text-pk-green-500" /> : <CopyGlyph />}
              </button>
            </div>
          </div>
          <Meta
            nowrap
            className="text-body-sm text-pk-content-secondary"
            parts={[<span data-testid="profile-handle">@{profile.handle}</span>, <span data-testid="profile-joined">Joined {joined}</span>]}
          />
        </div>
      </div>

      {profile.bio && (
        <p data-testid="profile-bio" className="mt-3 max-w-[80ch] text-body-base text-pk-content-primary text-pretty break-words">
          {profile.bio}
        </p>
      )}

      <div className="-mx-4 my-4 border-t border-pk-border" />

      <dl data-testid="profile-stats" className="grid grid-cols-3 gap-2 text-center">
        <Stat testId="profile-stat-on-track" value={formatBountyAmount(stats.prizesOnTrack)} label="Prizes on track" />
        <Stat testId="profile-stat-biggest-win" value={formatBountyAmount(stats.biggestWin)} label="Biggest win" />
        <Stat testId="profile-stat-entered" value={stats.entered.toLocaleString('en-US')} label="Bounties entered" />
      </dl>

      <div className="my-4 border-t border-pk-border" />

      <dl className="flex flex-col gap-2 text-body-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-pk-content-secondary">Total earned</dt>
          <dd data-testid="profile-total-earned" className={`font-semibold tabular-nums ${stats.totalEarned > 0 ? 'text-pk-green-600' : 'text-pk-content-primary'}`}>
            {stats.totalEarned > 0 ? '+' : ''}
            {formatBountyAmount(stats.totalEarned)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-pk-content-secondary">Best finish</dt>
          <dd data-testid="profile-best-finish" className="font-semibold text-pk-content-primary tabular-nums">
            {best ? `#${best.rank} of ${best.of.toLocaleString('en-US')}` : 'None yet'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Stat({ value, label, testId }: { value: string; label: string; testId: string }) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col-reverse items-center gap-0.5">
      <dt className="text-body-xs text-pk-content-secondary">{label}</dt>
      <dd className={`${HEADING_LG} font-semibold text-pk-content-primary tabular-nums`}>{value}</dd>
    </div>
  );
}
