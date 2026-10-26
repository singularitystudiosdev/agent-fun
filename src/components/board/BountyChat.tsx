import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { BoardBounty, ChatMessage } from '../../lib/bounty';

/** Textarea grows with its content up to this many lines (text-body-base: 20px line height), then scrolls. */
const MAX_LINES = 4;
const LINE_PX = 20;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5m ago", "3h ago", "2d ago", "4w ago", then a short date. Future stamps read as "just now". */
function relativeTime(iso: string, now: number): string {
  const diff = now - Date.parse(iso);
  if (!Number.isFinite(diff) || diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  if (diff < 5 * 7 * DAY) return `${Math.floor(diff / (7 * DAY))}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Small stable string hash, so the sponsor's reply delay is deterministic per message. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 2s to 4s, fixed for a given message. */
const replyDelay = (body: string): number => 2000 + (hash(body) % 2001);

function sponsorReply(bounty: BoardBounty, question: string): string {
  const summary = bounty.resolution?.summary?.trim();
  const lead = /\?\s*$/.test(question.trim()) ? 'Good question.' : 'Thanks for the note.';
  return summary ? `${lead} Winners are verified by: ${summary}` : `${lead} The resolution rules above say how winners are verified.`;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROLE_BADGE: Partial<Record<ChatMessage['role'], { label: string; className: string }>> = {
  sponsor: { label: 'Sponsor', className: 'bg-pk-blue-100 text-pk-brand-500' },
  agent: { label: 'Agent', className: 'bg-pk-gray-100 text-pk-content-secondary' },
};

function Message({ message, now }: { message: ChatMessage; now: number }) {
  const badge = ROLE_BADGE[message.role];
  const initial = (message.author.trim()[0] ?? '?').toUpperCase();
  return (
    <li className="flex gap-2.5 px-4 py-2.5">
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pk-gray-100 text-body-sm font-semibold text-pk-content-secondary"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-body-sm">
          <span className="truncate font-semibold text-pk-content-primary">{message.author}</span>
          {badge && (
            <span className={`rounded-full px-1.5 py-px text-body-xs font-medium ${badge.className}`}>{badge.label}</span>
          )}
          <time dateTime={message.createdAt} className="text-body-xs text-pk-content-tertiary">
            {relativeTime(message.createdAt, now)}
          </time>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-body-base text-pk-content-primary">{message.body}</p>
      </div>
    </li>
  );
}

function Chat({ bounty }: { bounty: BoardBounty }) {
  const [added, setAdded] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);
  const mounted = useRef(false);
  const inputId = useId();

  const messages = [...(bounty.chat ?? []), ...added];
  const count = messages.length;

  // Relative times stay fresh while the page is open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Pending sponsor replies die with the panel.
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Newest message in view: instantly on mount, smoothly after a send (unless reduced motion).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const smooth = mounted.current && !prefersReducedMotion();
    mounted.current = true;
    list.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, [count]);

  // Autogrow the composer to MAX_LINES.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const styles = window.getComputedStyle(el);
    // border-box: height = content + padding (scrollHeight) + borders.
    const borders = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
    const max = MAX_LINES * LINE_PX + parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom) + borders;
    const natural = el.scrollHeight + borders;
    el.style.height = `${Math.min(natural, max)}px`;
    el.style.overflowY = natural > max + 1 ? 'auto' : 'hidden';
  }, [draft]);

  const push = useCallback((message: ChatMessage) => {
    setAdded((prev) => [...prev, message]);
    setNow(Date.now());
    setAnnouncement(`${message.author}${message.role === 'sponsor' ? ', sponsor' : ''}: ${message.body}`);
  }, []);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const n = ++seq.current;
    push({ id: `${bounty.slug}-you-${n}`, author: 'you', role: 'hunter', body, createdAt: new Date().toISOString() });
    setDraft('');
    // Exactly one sponsor acknowledgement per message sent.
    const t = window.setTimeout(() => {
      push({
        id: `${bounty.slug}-sponsor-reply-${n}`,
        author: bounty.sponsor.slug ?? bounty.sponsor.name,
        role: 'sponsor',
        body: sponsorReply(bounty, body),
        createdAt: new Date().toISOString(),
      });
    }, replyDelay(body));
    timers.current.push(t);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const empty = count === 0;

  return (
    <section
      data-testid="bounty-chat"
      aria-labelledby={`${inputId}-title`}
      className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-pk-border bg-pk-surface"
    >
      <header className="flex items-baseline gap-2 border-b border-pk-border px-4 py-3">
        <h2 id={`${inputId}-title`} className="text-body-base font-semibold text-pk-content-primary">
          Discussion
        </h2>
        <span className="text-body-sm tabular-nums text-pk-content-tertiary">{count === 1 ? '1 message' : `${count} messages`}</span>
      </header>

      {empty ? (
        <div className="flex flex-col items-start gap-2 px-4 py-6">
          <p className="text-body-base text-pk-content-secondary">No messages yet.</p>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="rounded-md text-body-sm font-semibold text-pk-brand-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pk-brand-500"
          >
            Start the discussion
          </button>
        </div>
      ) : (
        <div
          ref={listRef}
          tabIndex={0}
          role="region"
          aria-label="Messages"
          className="max-h-[360px] overflow-y-auto overscroll-contain py-1.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pk-brand-500"
        >
          <ol>
            {messages.map((m) => (
              <Message key={m.id} message={m} now={now} />
            ))}
          </ol>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-pk-border p-3">
        <label htmlFor={inputId} className="sr-only">
          Ask a question or reply
        </label>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question or reply"
          className="min-h-9 flex-1 resize-none rounded-md border border-pk-border bg-pk-surface px-3 py-2 text-body-base text-pk-content-primary placeholder:text-pk-content-tertiary focus-visible:border-pk-brand-500 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-pk-brand-500"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="h-9 shrink-0 rounded-md bg-pk-brand-500 px-3.5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pk-brand-500 disabled:cursor-not-allowed disabled:bg-pk-gray-200 disabled:text-pk-content-tertiary disabled:hover:opacity-100 motion-reduce:transition-none"
        >
          Send
        </button>
      </form>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </section>
  );
}

/** The bounty's discussion panel: thread, composer, and a sponsor that acknowledges each question (local only, no backend). */
export function BountyChat({ bounty }: { bounty: BoardBounty }) {
  // Remount per bounty so local messages and pending replies never leak across pages.
  return <Chat key={bounty.id} bounty={bounty} />;
}
