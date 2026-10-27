import { useEffect, useMemo, useState } from 'react';
import { formatBountyAmount, type BoardBounty } from '../../lib/bounty';
import { appHref } from '../../lib/paths';
import { useProfile, useWinners } from '../../lib/profile';
import { WON_BOUNTIES, wonRepo } from '../../lib/wonBounties';
import { BountyCard } from '../BountyCard';
import { BountyIcon } from '../BountyIcon';
import { BountyDescription } from './BountyDescription';

/**
 * A won bounty, as the board's Won cards and their "Use" button open it: the name, the description, then the winning
 * entry's GitHub repository with the winner and what they won. Live bounties open the full BountyPage instead.
 */

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-pk-surface';

/** GitHub usernames allow letters, digits and single hyphens: "agent.wisp" becomes "agent-wisp". */
const githubOwner = (handle: string): string => handle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path fill="currentColor" d="M12.286 14.786a.876.876 0 0 1-1.238 0L6.882 10.62a.875.875 0 0 1 0-1.237l4.166-4.167a.876.876 0 0 1 1.238 1.237L8.738 10l3.548 3.548a.877.877 0 0 1 0 1.238" />
  </svg>
);

/** GitHub's mark (octicon mark-github, 16px grid). */
const GitHubMark = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
    />
  </svg>
);

/** A copy button that confirms for 1.5s. */
function CopyButton({ text, label, testId }: { text: string; label: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false));
      }}
      className={`inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md border border-pk-gray-200 px-3 text-body-sm font-semibold text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none ${FOCUS_RING}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function WonBountyPage({ bounty }: { bounty: BoardBounty }) {
  const profile = useProfile();
  const winner = useWinners(bounty)[0];
  const owner = githubOwner(winner ? (winner.you ? profile.handle : winner.hunter) : bounty.sponsor.slug ?? bounty.sponsor.name);
  const repo = `github.com/${owner}/${wonRepo(bounty.slug) ?? bounty.slug}`;
  const clone = `git clone https://${repo}.git`;
  // Every other won bounty: same category first, then the rest, each group highest reward first. All memes stay unique.
  const similar = useMemo(
    () =>
      WON_BOUNTIES.filter((b) => b.slug !== bounty.slug).sort(
        (a, b) => Number(b.category === bounty.category) - Number(a.category === bounty.category) || b.rewardAmount - a.rewardAmount,
      ),
    [bounty.slug, bounty.category],
  );

  return (
    <article data-testid="won-bounty-page" aria-labelledby="won-bounty-title" className="mx-auto flex w-full max-w-[1350px] flex-col gap-6 px-4 pt-6 pb-16 lg:px-6">
      <a
        href={appHref('/?status=won')}
        data-testid="won-bounty-back"
        className={`-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-body-base font-semibold text-pk-content-secondary transition-colors hover:text-pk-content-primary motion-reduce:transition-none ${FOCUS_RING}`}
      >
        <ChevronLeft />
        Won bounties
      </a>

      <header className="flex items-start gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-md">
          <BountyIcon bounty={bounty} size={64} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-body-base text-pk-content-secondary">{bounty.category}</p>
          <h1 id="won-bounty-title" className="text-2xl font-semibold text-pretty text-pk-content-primary">
            {bounty.title}
          </h1>
        </div>
      </header>

      <section aria-labelledby="won-bounty-description" data-testid="won-bounty-description" className="flex max-w-[80ch] flex-col gap-2">
        {/* Same weight as the description's own Deliverables and Requirements subheadings. */}
        <h2 id="won-bounty-description" className="text-body-base font-semibold text-pk-content-primary">
          Description
        </h2>
        <BountyDescription text={bounty.description ?? ''} />
      </section>

      <section aria-labelledby="won-bounty-repo" data-testid="won-bounty-repo" className="flex flex-col rounded-xl border border-pk-border bg-pk-elevated">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="shrink-0 text-pk-content-primary">
            <GitHubMark />
          </span>
          <h2 id="won-bounty-repo" className="min-w-0 flex-1 truncate font-mono text-body-base font-semibold text-pk-content-primary" data-testid="won-bounty-repo-url">
            {repo}
          </h2>
          <CopyButton text={`https://${repo}`} label="repository link" testId="won-bounty-copy-repo" />
        </div>
        <dl className="grid grid-cols-2 border-t border-pk-border">
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <dt className="text-body-sm text-pk-content-secondary">Winner</dt>
            <dd className="truncate text-body-base font-semibold text-pk-content-primary" data-testid="won-bounty-winner">
              {winner ? (
                <>
                  @{winner.you ? profile.handle : winner.hunter}
                  {winner.you && <span className="font-normal text-pk-content-secondary"> (you)</span>}
                </>
              ) : (
                'Not announced'
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 border-l border-pk-border px-4 py-3">
            <dt className="text-body-sm text-pk-content-secondary">Won</dt>
            <dd className="text-body-base font-semibold text-pk-green-600 tabular-nums" data-testid="won-bounty-amount">
              {formatBountyAmount(winner?.payout ?? bounty.rewardAmount)}
            </dd>
          </div>
        </dl>
        <div className="flex items-center gap-3 border-t border-pk-border px-4 py-3">
          <code className="min-w-0 flex-1 truncate rounded-md bg-pk-gray-100 px-3 py-2 font-mono text-body-sm text-pk-content-primary" data-testid="won-bounty-clone">
            {clone}
          </code>
          <CopyButton text={clone} label="clone command" testId="won-bounty-copy-clone" />
        </div>
      </section>

      <section aria-labelledby="won-bounty-similar" data-testid="won-bounty-similar" className="mt-4 flex flex-col gap-3">
        <h2 id="won-bounty-similar" className="text-heading-xl text-pk-content-primary">
          Similar won bounties
        </h2>
        <ul role="list" aria-label="Similar won bounties" className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {similar.map((b) => (
            <li key={b.id} className="relative h-[180px]" data-status="won" data-category={b.category}>
              <BountyCard bounty={b} />
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
