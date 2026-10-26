import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { BIO_MAX, DISPLAY_NAME_MAX, downscalePfp, PFP_PRESETS, pfpGradient, validateProfile, writeProfile, type Pfp, type Profile, type ProfileErrors } from '../../lib/profile';
import { Avatar } from './Avatar';
import { copyText } from './IdentityCard';
import { AlertGlyph, CheckGlyph, CopyGlyph, FOCUS_RING, HELP, ICON_BUTTON, INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON, UploadGlyph } from './glyphs';

/**
 * Edit profile: a native modal <dialog> (showModal gives the focus trap, Escape and the inert page). Centred at 480px
 * from `sm` up, a bottom sheet below it. Validates a field on blur and every field on Save, focusing the first
 * problem; Save writes the profile, which every surface re-reads through PROFILE_CHANGE_EVENT. Key it per opening.
 */

type Field = 'displayName' | 'handle' | 'bio' | 'x';
const FIELD_ORDER: Field[] = ['displayName', 'handle', 'bio', 'x'];
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const COPIED_MS = 1500;

/** What Save writes: names trimmed, handles without a typed "@". */
export function normalizeDraft(d: Profile): Profile {
  return { ...d, displayName: d.displayName.trim(), handle: d.handle.trim().replace(/^@/, ''), x: d.x.trim().replace(/^@/, ''), bio: d.bio.trim() };
}

const sameProfile = (a: Profile, b: Profile) => JSON.stringify(normalizeDraft(a)) === JSON.stringify(normalizeDraft(b));
const pfpKey = (p: Pfp) => (p.kind === 'preset' ? p.id : p.kind);

export function EditProfileDialog({ open, profile, onClose, onSaved }: { open: boolean; profile: Profile; onClose: () => void; onSaved: () => void }) {
  const uid = useId();
  const dom = (f: string) => `${uid}-${f}`;
  const titleId = dom('title');
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const [draft, setDraft] = useState<Profile>(profile);
  const [touched, setTouched] = useState<Set<Field>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [pfpError, setPfpError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  // Open and close the native dialog from `open`. The owner remounts this component (a new `key`) for every opening,
  // so the draft always starts from the saved profile without a stale frame.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Escape (cancel) and any other close route back through the owner, so `open` stays the single source.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCloseEvent = () => onClose();
    el.addEventListener('close', onCloseEvent);
    return () => el.removeEventListener('close', onCloseEvent);
  }, [onClose]);

  const normalized = useMemo(() => normalizeDraft(draft), [draft]);
  const errors: ProfileErrors = useMemo(() => validateProfile(normalized, profile.handle), [normalized, profile.handle]);
  const err = (f: Field) => (submitted || touched.has(f) ? errors[f] : undefined);
  const touch = (f: Field) => setTouched((s) => (s.has(f) ? s : new Set(s).add(f)));
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const unchanged = sameProfile(draft, profile);

  const a11y = (f: Field, help = false, extra?: string) => {
    const e = err(f);
    return {
      id: dom(f),
      'aria-invalid': e ? (true as const) : undefined,
      'aria-describedby': [help && `${dom(f)}-help`, extra, e && `${dom(f)}-error`].filter(Boolean).join(' ') || undefined,
      onBlur: () => touch(f),
    };
  };

  const onUpload = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setPfpError(null);
    setUploading(true);
    try {
      const dataUrl = await downscalePfp(file);
      set('pfp', { kind: 'image', dataUrl });
    } catch (e) {
      setPfpError(e instanceof Error ? e.message : 'Could not read that image.');
    } finally {
      setUploading(false);
    }
  };

  const copyWallet = async () => {
    if (!(await copyText(profile.wallet))) return;
    setWalletCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setWalletCopied(false), COPIED_MS);
  };

  const onSubmit = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setSubmitted(true);
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (first) {
      document.getElementById(dom(first))?.focus();
      return;
    }
    if (errors.pfp) {
      setPfpError(errors.pfp);
      return;
    }
    if (!writeProfile(normalized)) {
      setPfpError('Could not save. Try a smaller image.');
      return;
    }
    onSaved();
  };

  const bioLen = draft.bio.length;
  const picked = pfpKey(draft.pfp);
  const swatches: { key: string; label: string; pfp: Pfp }[] = [{ key: 'generated', label: 'Generated', pfp: { kind: 'generated' } }, ...PFP_PRESETS.map((p) => ({ key: p.id, label: p.label, pfp: { kind: 'preset', id: p.id } as Pfp }))];

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-testid="profile-edit"
      onPointerDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // A press that starts and ends on the backdrop closes, like Cancel (a drag out of a field does not).
        if (e.target === e.currentTarget && pressedOnBackdrop.current) onClose();
      }}
      className="fixed max-h-[90dvh] w-full max-w-none overflow-y-auto border border-pk-border bg-pk-elevated p-0 text-pk-content-primary shadow-pk-middle transition-[opacity,translate] duration-200 ease-out backdrop:bg-pk-content-primary/40 starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:mx-0 max-sm:mt-auto max-sm:mb-0 max-sm:rounded-t-xl max-sm:rounded-b-none sm:m-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[480px] sm:max-w-[calc(100vw-2rem)] sm:rounded-xl"
    >
      <form noValidate onSubmit={onSubmit} aria-labelledby={titleId} data-testid="profile-edit-form" className="flex flex-col">
        <header className="px-5 pt-5 pb-4">
          <h2 id={titleId} className="text-heading-xl text-pk-content-primary">
            Edit profile
          </h2>
        </header>

        <div className="flex flex-col gap-5 border-t border-pk-border px-5 py-5">
          {/* 1. Picture */}
          <div role="group" aria-labelledby={dom('pfp-label')} className="flex flex-col gap-3">
            <span id={dom('pfp-label')} className={LABEL}>
              Profile picture
            </span>
            <div className="flex items-center gap-4">
              <Avatar profile={{ pfp: draft.pfp, wallet: draft.wallet }} size={64} testId="profile-edit-avatar" />
              <div className="flex flex-wrap items-center gap-2">
                <label
                  data-testid="profile-edit-pfp-upload"
                  aria-busy={uploading || undefined}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-pk-gray-200 bg-pk-elevated px-4 text-body-base font-semibold text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none has-focus-visible:ring-2 has-focus-visible:ring-pk-content-secondary has-focus-visible:ring-offset-2"
                >
                  <UploadGlyph />
                  {uploading ? 'Reading image' : 'Upload image'}
                  <input type="file" accept={ACCEPT} onChange={onUpload} aria-describedby={`${dom('pfp')}-help`} className="sr-only" />
                </label>
                {draft.pfp.kind === 'image' && (
                  <button type="button" onClick={() => set('pfp', { kind: 'generated' })} className={`h-10 rounded-md px-3 text-body-base font-semibold text-pk-content-secondary hover:text-pk-content-primary ${FOCUS_RING}`}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span id={dom('swatch-label')} className="text-body-sm text-pk-content-secondary">
                Or pick a gradient
              </span>
              <div role="radiogroup" aria-labelledby={dom('swatch-label')} className="flex flex-wrap gap-3">
                {swatches.map((s) => (
                  <label
                    key={s.key}
                    data-testid="profile-edit-pfp-preset"
                    data-preset={s.key}
                    title={s.label}
                    className="relative block size-7 cursor-pointer rounded-full has-checked:ring-2 has-checked:ring-pk-content-primary has-checked:ring-offset-2 has-checked:ring-offset-pk-elevated has-focus-visible:ring-2 has-focus-visible:ring-pk-content-secondary has-focus-visible:ring-offset-2"
                  >
                    <input type="radio" name={dom('swatch')} aria-label={s.label} checked={picked === s.key} onChange={() => set('pfp', s.pfp)} className="sr-only" />
                    <span aria-hidden="true" className="block size-full rounded-full bg-pk-gray-100" style={{ background: pfpGradient(s.pfp, draft.wallet) ?? undefined }} />
                  </label>
                ))}
              </div>
            </div>
            <p id={`${dom('pfp')}-help`} className={HELP}>
              PNG, JPG, WebP or GIF up to 5 MB. Cropped to a square and kept in this browser.
            </p>
            {pfpError && <ErrorText id={`${dom('pfp')}-error`}>{pfpError}</ErrorText>}
          </div>

          {/* 2. Display name */}
          <FieldShell id={dom('displayName')} label="Display name" error={err('displayName')}>
            <input
              {...a11y('displayName')}
              name="displayName"
              autoComplete="name"
              maxLength={DISPLAY_NAME_MAX * 2}
              value={draft.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              data-testid="profile-edit-display-name"
              className={`${INPUT} h-10`}
            />
          </FieldShell>

          {/* 3. Username */}
          <FieldShell id={dom('handle')} label="Username" error={err('handle')} help="Shown on your entries and in discussions.">
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body-base text-pk-content-tertiary">
                @
              </span>
              <input
                {...a11y('handle', true)}
                name="handle"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                value={draft.handle}
                onChange={(e) => set('handle', e.target.value.replace(/^@/, ''))}
                data-testid="profile-edit-handle"
                className={`${INPUT} h-10 pl-7`}
              />
            </div>
          </FieldShell>

          {/* 4. Bio */}
          <FieldShell
            id={dom('bio')}
            label="Bio"
            optional
            error={err('bio')}
            aside={
              <span id={`${dom('bio')}-count`} className={`text-body-xs tabular-nums ${bioLen > BIO_MAX ? 'text-pk-red-500' : 'text-pk-content-secondary'}`}>
                {bioLen} / {BIO_MAX}
              </span>
            }
          >
            <textarea
              {...a11y('bio', false, `${dom('bio')}-count`)}
              name="bio"
              rows={3}
              value={draft.bio}
              onChange={(e) => set('bio', e.target.value)}
              data-testid="profile-edit-bio"
              className={`${INPUT} min-h-20 resize-y py-2.5`}
            />
          </FieldShell>

          {/* 5. X handle */}
          <FieldShell id={dom('x')} label="X handle" optional error={err('x')}>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body-base text-pk-content-tertiary">
                @
              </span>
              <input
                {...a11y('x')}
                name="x"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={draft.x}
                onChange={(e) => set('x', e.target.value.replace(/^@/, ''))}
                data-testid="profile-edit-x"
                className={`${INPUT} h-10 pl-7`}
              />
            </div>
          </FieldShell>

          {/* 6. Wallet */}
          <FieldShell id={dom('wallet')} label="Wallet" help="Payouts go here. Connected wallets cannot be edited in this preview.">
            <div className="flex gap-2">
              <input
                id={dom('wallet')}
                readOnly
                value={profile.wallet}
                aria-describedby={`${dom('wallet')}-help`}
                data-testid="profile-edit-wallet"
                className={`${INPUT} h-10 min-w-0 bg-pk-gray-100 font-mono text-body-sm!`}
              />
              <button type="button" onClick={copyWallet} aria-label={walletCopied ? 'Wallet address copied' : 'Copy wallet address'} className={`${ICON_BUTTON} size-10 border border-pk-gray-200`}>
                {walletCopied ? <CheckGlyph className="size-5 text-pk-green-500" /> : <CopyGlyph />}
              </button>
            </div>
          </FieldShell>
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-pk-border bg-pk-elevated px-5 py-4">
          <button type="button" onClick={onClose} data-testid="profile-edit-cancel" className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={unchanged || uploading} data-testid="profile-edit-save" className={PRIMARY_BUTTON}>
            Save changes
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function FieldShell({ id, label, optional, help, error, aside, children }: { id: string; label: string; optional?: boolean; help?: string; error?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {label}
          {optional && <span className="font-normal text-pk-content-secondary"> (optional)</span>}
        </label>
        {aside}
      </div>
      {children}
      {help && (
        <p id={`${id}-help`} className={HELP}>
          {help}
        </p>
      )}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  );
}

function ErrorText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1 text-body-xs text-pk-red-500" data-testid="profile-edit-error">
      <AlertGlyph />
      <span>{children}</span>
    </p>
  );
}
