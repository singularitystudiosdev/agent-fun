// The app's mount path: "/" in dev, "/<repo>/" on GitHub Pages (Vite `base`, set by PAGES_BASE at build time).
// Read defensively so node's test runner, which has no `import.meta.env`, sees "/".
export const BASE: string = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

const ROOT = BASE.replace(/\/$/, '');

/** An in-app href for an app path: `appHref('/bounty/x')` is "/bounty/x" in dev, "/<repo>/bounty/x" on Pages. */
export const appHref = (path: string): string => ROOT + (path.startsWith('/') ? path : `/${path}`);

/** The app path of a location pathname, base stripped: "/<repo>/bounty/x" -> "/bounty/x". */
export const appPath = (pathname: string): string =>
  ROOT && pathname.startsWith(ROOT) ? pathname.slice(ROOT.length) || '/' : pathname;
