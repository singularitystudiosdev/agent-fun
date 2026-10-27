import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

/**
 * A menu button that picks one value: polymarket.com's SelectMenu (polykit, chunk 2-m08w_960s_z.js `menuTriggerVariants`,
 * `menuItemBaseClasses`, `MenuItemLeftSection`, `checkIndicatorCls`), rebuilt on the WAI-ARIA menu button pattern.
 * The trigger shows the picked option (icon, label, chevron); the popup lists every option as a `menuitemradio`
 * with a check on the picked one. Keyboard: Enter / Space / ArrowDown open on the picked item, ArrowUp on the last;
 * arrows wrap, Home / End jump, Enter / Space pick, Escape closes; picking or Escape puts focus back on the trigger.
 */

export interface SelectMenuOption<T extends string | number> {
  value: T;
  label: string;
  /** An 18 or 20px glyph; rendered at 20px (polymarket's `[&_svg]:size-5`). */
  icon?: ReactNode;
}

/** A free-entry field under the options, for a value no option offers (e.g. a typed minimum reward). */
export interface SelectMenuCustom<T extends string | number> {
  /** Accessible name of the field, e.g. "Custom minimum reward". */
  label: string;
  placeholder: string;
  /** A unit drawn before the text, e.g. "$". */
  prefix?: string;
  /** null while the text is not a value yet. */
  parse: (text: string) => T | null;
  /** The trigger text for a value no option matches. */
  format: (value: T) => string;
  /** The field's starting text for a value no option matches. */
  toText: (value: T) => string;
}

const FOCUS_RING ='focus-visible:ring-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-1 focus-visible:ring-offset-pk-surface';

/* polymarket's outline trigger, on this project's tokens. Open: data-[open] wash, darker hairline and a 3px gray ring. */
const TRIGGER = `inline-flex h-10 shrink-0 cursor-pointer select-none items-center gap-0.5 rounded-md border border-pk-gray-200 bg-pk-surface px-2.5 text-body-base font-semibold text-pk-content-primary outline-none transition-[color,background-color,border-color,scale] duration-[120ms] ease-out hover:bg-pk-hover-overlay-darker active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 data-open:border-pk-gray-300 data-open:bg-pk-gray-100 data-open:ring-3 data-open:ring-pk-gray-100 ${FOCUS_RING}`;

/* Clears the viewport edge by 16px (the gutter `px-4` the board uses on phones). */
const EDGE = 16;
/** The popup's `mt-2` / `mb-2` offset from its trigger, in px. */
const GAP = 8;

/** Opening one menu closes every other one on the page. */
const OPEN_EVENT = 'pk-select-menu-open';

/** polymarket's trigger chevron (20px, filled). */
function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20" aria-hidden="true">
      <path fill="currentColor" d="M13.548 7.714a.876.876 0 0 1 1.237 1.238l-4.167 4.166a.875.875 0 0 1-1.237 0L5.214 8.952a.877.877 0 0 1 1.238-1.238l3.547 3.548z" />
    </svg>
  );
}

/** polymarket's CheckSmallIcon20 (chunk 0zws79-gh-sw_.js). */
function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20" aria-hidden="true">
      <path fill="currentColor" d="M14.528 5.074a.875.875 0 0 1 1.36 1.102l-7.083 8.75a.876.876 0 0 1-1.363-.004l-3.334-4.167a.875.875 0 0 1 1.367-1.093l2.653 3.317z" />
    </svg>
  );
}

export function SelectMenu<T extends string | number>({
  label,
  value,
  options,
  onChange,
  testId,
  custom,
}: {
  /** The accessible name prefix, e.g. "Sort by"; the trigger reads "Sort by: Highest reward". */
  label: string;
  value: T;
  options: readonly SelectMenuOption<T>[];
  onChange: (next: T) => void;
  testId?: string;
  /** Adds a typed-value field below the options. Typing applies live; Enter closes (unless the text is unreadable: then the field turns red and stays open); clearing it restores the value the menu opened with. */
  custom?: SelectMenuCustom<T>;
}) {
  const id = useId();
  const menuId = `${id}-menu`;
  const [open, setOpen] = useState(false);
  /** Where focus lands when the popup mounts: the picked item, the last item, the custom field, or the popup itself (a pointer open). */
  const [initialFocus, setInitialFocus] = useState<'checked' | 'last' | 'custom' | 'menu'>('checked');
  const [shift, setShift] = useState(0);
  /** Vertical placement: open upward when there is more room above, and cap the height to the room it has (Floating UI's flip + size). */
  const [vertical, setVertical] = useState<{ up: boolean; maxHeight: number | null }>({ up: false, maxHeight: null });
  const [customText, setCustomText] = useState('');
  const openedWith = useRef(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  const preset = options.find((o) => o.value === value);
  const isCustom = !!custom && !preset;
  const selected = preset ?? (custom ? { value, label: custom.format(value) } : options[0]);

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);

  const openMenu = (focus: 'checked' | 'last' | 'menu') => {
    openedWith.current = value;
    setCustomText(isCustom && custom ? custom.toText(value) : '');
    // A typed value has no row to land on: keyboard opens go to its field instead.
    setInitialFocus(isCustom && focus === 'checked' ? 'custom' : focus);
    setShift(0);
    setVertical({ up: false, maxHeight: null });
    setOpen(true);
  };

  const typeCustom = (text: string) => {
    if (!custom) return;
    setCustomText(text);
    if (text.trim() === '') {
      const back = options.some((o) => o.value === openedWith.current) ? openedWith.current : options[0].value;
      if (back !== value) onChange(back);
      return;
    }
    const next = custom.parse(text);
    if (next !== null && next !== value) onChange(next);
  };

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const pick = (next: T) => {
    if (next !== value) onChange(next);
    close(true);
  };

  // Keep the popup on screen: shift it left when it would cross the viewport's right edge (narrow phones), and flip it
  // above the trigger when the board sits low (under the trending carousel) and below has less room than above. The
  // room above ends at the sticky site header, which would otherwise cover the menu's top rows.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const menu = popupRef.current;
      const root = rootRef.current;
      if (!menu || !root) return;
      const box = root.getBoundingClientRect();
      const overflow = box.left + menu.offsetWidth - (document.documentElement.clientWidth - EDGE);
      setShift(overflow > 0 ? -Math.min(overflow, box.left - EDGE) : 0);
      const header = document.querySelector('[data-testid="site-header"]')?.getBoundingClientRect().bottom ?? 0;
      const below = window.innerHeight - box.bottom - GAP - EDGE;
      const above = box.top - Math.max(header, 0) - GAP - EDGE;
      const height = menu.scrollHeight;
      const up = height > below && above > below;
      const room = Math.max(up ? above : below, 0);
      setVertical({ up, maxHeight: height > room ? room : null });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  // Focus on open: keyboard opens land on an item, a pointer open parks on the popup so no row looks hovered.
  useEffect(() => {
    if (!open) return;
    const list = items();
    if (initialFocus === 'menu') menuRef.current?.focus({ preventScroll: true });
    else if (initialFocus === 'custom') customRef.current?.focus({ preventScroll: true });
    else if (initialFocus === 'last') list.at(-1)?.focus({ preventScroll: true });
    else (list.find((el) => el.getAttribute('aria-checked') === 'true') ?? list[0])?.focus({ preventScroll: true });
  }, [open, initialFocus]);

  // Light dismiss: a press outside closes; so does another menu opening.
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    const onOtherOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener(OPEN_EVENT, onOtherOpen);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener(OPEN_EVENT, onOtherOpen);
    };
  }, [open, id, close]);

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(event.key === 'ArrowUp' ? 'last' : 'checked');
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus({ preventScroll: true });
    const field = customRef.current;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        // With a custom field, the arrows run through it between the last row and the first.
        if (field && at === list.length - 1) field.focus();
        else focusAt(at + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (field && at === 0) field.focus();
        else focusAt(at < 0 ? -1 : at - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(-1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = at >= 0 ? options[at] : undefined;
        if (option) pick(option.value);
        break;
      }
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        // Forward Tab reaches the custom field first; otherwise Tab leaves from the trigger, so focus moves on to the next control.
        if (field && !event.shiftKey) {
          event.preventDefault();
          field.focus();
          break;
        }
        triggerRef.current?.focus();
        setOpen(false);
        break;
    }
  };

  /** Non-empty text the field cannot read; the value stays the last one that parsed. */
  const customInvalid = !!custom && customText.trim() !== '' && custom.parse(customText) === null;

  const onCustomKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const list = items();
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        // Text that is not a value keeps the menu open on the field (marked invalid), so the old value never sticks silently.
        if (customInvalid) break;
        close(true);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'ArrowUp':
        event.preventDefault();
        list.at(-1)?.focus({ preventScroll: true });
        break;
      case 'ArrowDown':
        event.preventDefault();
        list[0]?.focus({ preventScroll: true });
        break;
      case 'Tab':
        if (event.shiftKey) {
          event.preventDefault();
          list.at(-1)?.focus({ preventScroll: true });
          break;
        }
        triggerRef.current?.focus();
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label}: ${selected?.label ?? ''}`}
        data-open={open || undefined}
        data-testid={testId}
        onClick={(event) => (open ? close(false) : openMenu(event.detail === 0 ? 'checked' : 'menu'))}
        onKeyDown={onTriggerKeyDown}
        className={TRIGGER}
      >
        {selected?.icon && (
          <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-5">
            {selected.icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate px-1 text-left">{selected?.label}</span>
        <span
          aria-hidden="true"
          className={`flex shrink-0 items-center text-pk-gray-400 transition-transform duration-150 ease-out motion-reduce:transition-none [&_svg]:size-5 ${open ? 'rotate-180' : ''}`}
        >
          <ChevronIcon />
        </span>
      </button>

      {open && (
        <div
          ref={popupRef}
          style={{ left: shift || undefined, maxHeight: vertical.maxHeight ?? undefined }}
          data-side={vertical.up ? 'top' : 'bottom'}
          className={`absolute left-0 z-30 flex w-max min-w-[max(100%,12.5rem)] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto overscroll-contain rounded-xl bg-pk-surface p-2 shadow-pk-middle transition-[opacity,scale] duration-150 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none ${
            vertical.up ? 'bottom-full mb-2 origin-bottom-left' : 'top-full mt-2 origin-top-left'
          }`}
        >
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label={label}
          data-testid={testId ? `${testId}-menu` : undefined}
          onKeyDown={onMenuKeyDown}
          className="flex flex-col rounded-md outline-none focus-visible:ring-2 focus-visible:ring-pk-content-secondary"
        >
          {options.map((o) => {
            const checked = o.value === value;
            return (
              <div
                key={String(o.value)}
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                data-value={o.value}
                onClick={() => pick(o.value)}
                onPointerMove={(event) => {
                  if (document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
                }}
                className="flex h-10 w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-3 text-left text-pk-content-primary outline-none hover:bg-pk-gray-100 focus:bg-pk-gray-100 focus-visible:bg-pk-gray-100"
              >
                {o.icon && (
                  <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center [&_svg]:size-5">
                    {o.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-body-base font-semibold">{o.label}</span>
                <span aria-hidden="true" className="flex size-5 shrink-0 items-center [&_svg]:size-5">
                  {checked && <CheckIcon />}
                </span>
              </div>
            );
          })}
        </div>
        {custom && (
          // Outside the role="menu" list (a menu holds only menu items), under a hairline: the same search-field anatomy as the board's search.
          <div className="mt-1 border-t border-pk-border pt-2">
            <label
              className={`flex h-10 cursor-text items-center gap-1 rounded-md border px-3 transition-colors duration-150 motion-reduce:transition-none focus-within:bg-pk-surface focus-within:ring-2 ${
                customInvalid
                  ? 'border-pk-red-500 bg-pk-surface focus-within:border-pk-red-500 focus-within:ring-pk-red-500/30'
                  : 'border-transparent bg-pk-gray-100 focus-within:border-pk-gray-300 focus-within:ring-pk-content-secondary/40'
              }`}
            >
              {custom.prefix && (
                <span aria-hidden="true" className="text-body-base font-semibold text-pk-content-secondary">
                  {custom.prefix}
                </span>
              )}
              <input
                ref={customRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                aria-label={custom.label}
                aria-invalid={customInvalid}
                placeholder={custom.placeholder}
                value={customText}
                data-testid={testId ? `${testId}-custom` : undefined}
                onChange={(event) => typeCustom(event.target.value)}
                onKeyDown={onCustomKeyDown}
                className="min-w-0 flex-1 bg-transparent text-body-base font-semibold text-pk-content-primary outline-none focus-visible:outline-none placeholder:font-medium placeholder:text-pk-content-tertiary max-md:text-[16px]"
              />
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center [&_svg]:size-5">
                {isCustom && <CheckIcon />}
              </span>
            </label>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
