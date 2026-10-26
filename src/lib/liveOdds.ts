// Opt-in live odds: streams Polymarket's public market channel and patches bestBid / bestAsk /
// lastTradePrice / spread onto the event's markets, mirroring polymarket.com's own `useLiveOdds`
// (Yes token only; at most one state update per second). `outcomePrices` (the row sort key) is left alone.
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseList, type GammaEvent, type GammaMarket } from './gamma';

export const LIVE_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const PING_MS = 10_000;
const FLUSH_MS = 1_000;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

/** What the stream knows about one Yes token. Absent fields keep the Gamma value. */
export interface TokenPatch {
  bestBid?: number;
  bestAsk?: number;
  lastTradePrice?: number;
  spread?: number;
}
export type PatchState = Readonly<Record<string, TokenPatch>>;

export const yesTokenId = (m: GammaMarket): string | undefined => parseList(m.clobTokenIds)[0];

/** Yes token ids of every market that can still trade (row ranking may change, so not just the shown two). */
export function liveYesTokens(event: GammaEvent | null): string[] {
  if (!event) return [];
  const ids: string[] = [];
  for (const m of event.markets) {
    if (!m?.active || m.closed) continue;
    const id = yesTokenId(m);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** "" / garbage => 0 (an empty book side); undefined => no information. */
const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const levels = (v: unknown): number[] =>
  Array.isArray(v) ? v.map((l) => (isRecord(l) ? Number.parseFloat(String(l.price)) : NaN)).filter(Number.isFinite) : [];

function setPatch(next: Record<string, TokenPatch>, prev: PatchState, id: string, change: TokenPatch): void {
  const base = next[id] ?? prev[id] ?? {};
  const merged: TokenPatch = { ...base, ...change };
  if (merged.bestBid !== undefined && merged.bestAsk !== undefined) merged.spread = merged.bestAsk - merged.bestBid; // site: zeroSpread = ask - bid
  next[id] = merged;
}

/**
 * Pure frame -> patch reducer. `frame` is one parsed message or an array of them. Returns `state`
 * itself when nothing changed, otherwise a new object (never mutates `state`). Never throws.
 */
export function applyFrame(state: PatchState, frame: unknown, yesTokens: ReadonlySet<string> | readonly string[]): PatchState {
  const yes = yesTokens instanceof Set ? yesTokens : new Set(yesTokens as readonly string[]);
  const next: Record<string, TokenPatch> = {};
  let changed = false;
  const mark = (id: string, change: TokenPatch) => {
    setPatch(next, state, id, change);
    changed = true;
  };
  try {
    for (const msg of Array.isArray(frame) ? frame : [frame]) {
      if (!isRecord(msg)) continue;
      switch (msg.event_type) {
        case 'price_change':
          if (Array.isArray(msg.price_changes))
            for (const c of msg.price_changes) {
              if (!isRecord(c) || typeof c.asset_id !== 'string' || !yes.has(c.asset_id)) continue;
              const bestBid = num(c.best_bid);
              const bestAsk = num(c.best_ask);
              if (bestBid === undefined && bestAsk === undefined) continue;
              mark(c.asset_id, { ...(bestBid !== undefined && { bestBid }), ...(bestAsk !== undefined && { bestAsk }) });
            }
          break;
        case 'book': {
          const id = msg.asset_id;
          if (typeof id !== 'string' || !yes.has(id)) break;
          const bids = levels(msg.bids);
          const asks = levels(msg.asks);
          const last = num(msg.last_trade_price);
          mark(id, {
            bestBid: bids.length ? Math.max(...bids) : 0,
            bestAsk: asks.length ? Math.min(...asks) : 0,
            ...(last !== undefined && { lastTradePrice: last }),
          });
          break;
        }
        case 'last_trade_price': {
          const id = msg.asset_id;
          const price = num(msg.price);
          if (typeof id === 'string' && yes.has(id) && price !== undefined) mark(id, { lastTradePrice: price });
          break;
        }
        case 'best_bid_ask': {
          const id = msg.asset_id;
          if (typeof id !== 'string' || !yes.has(id)) break;
          const bestBid = num(msg.best_bid);
          const bestAsk = num(msg.best_ask);
          if (bestBid !== undefined || bestAsk !== undefined)
            mark(id, { ...(bestBid !== undefined && { bestBid }), ...(bestAsk !== undefined && { bestAsk }) });
          break;
        }
      }
    }
  } catch {
    /* malformed frame: keep whatever was applied before it */
  }
  return changed ? { ...state, ...next } : state;
}

/** Overlay patches on the event; identity-stable when there are none. */
export function patchEvent(event: GammaEvent, patches: PatchState): GammaEvent {
  if (!Object.keys(patches).length) return event;
  return {
    ...event,
    markets: event.markets.map((m) => {
      const id = yesTokenId(m);
      const p = id ? patches[id] : undefined;
      return p ? { ...m, ...p } : m;
    }),
  };
}

/**
 * `event` unchanged when disabled; otherwise a copy whose markets carry live bestBid/bestAsk/
 * lastTradePrice/spread. Frames are batched and flushed to React at most once per second.
 */
export function useLiveOdds(event: GammaEvent | null, enabled: boolean): GammaEvent | null {
  const [patches, setPatches] = useState<PatchState>({});
  const tokens = useMemo(() => liveYesTokens(event), [event]);
  const tokenKey = tokens.join(',');
  const live = enabled && tokenKey !== '';

  useEffect(() => {
    setPatches({});
    if (!live || typeof WebSocket === 'undefined') return;
    const yes = new Set(tokenKey.split(','));
    let pending: PatchState = {};
    let dirty = false;
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | undefined;
    let flush: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = BACKOFF_MIN_MS;
    let disposed = false;

    const stopSocket = () => {
      clearInterval(ping);
      ping = undefined;
      if (ws) {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        try {
          ws.close();
        } catch {
          /* already closed */
        }
        ws = null;
      }
    };
    const scheduleRetry = () => {
      if (disposed || retry) return;
      retry = setTimeout(() => {
        retry = undefined;
        connect();
      }, backoff);
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
    };
    const connect = () => {
      if (disposed) return;
      stopSocket();
      try {
        ws = new WebSocket(LIVE_WS_URL);
      } catch {
        scheduleRetry();
        return;
      }
      const socket = ws;
      socket.onopen = () => {
        backoff = BACKOFF_MIN_MS;
        socket.send(JSON.stringify({ assets_ids: [...yes], type: 'market' }));
        ping = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('PING'), PING_MS);
      };
      socket.onmessage = (e) => {
        if (typeof e.data !== 'string' || e.data === 'PONG') return;
        let frame: unknown;
        try {
          frame = JSON.parse(e.data);
        } catch {
          return;
        }
        const after = applyFrame(pending, frame, yes);
        if (after === pending) return;
        pending = after;
        dirty = true;
        flush ??= setTimeout(() => {
          flush = undefined;
          if (disposed || !dirty) return;
          dirty = false;
          setPatches(pending);
        }, FLUSH_MS);
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (socket !== ws) return;
        stopSocket();
        scheduleRetry();
      };
    };
    connect();

    return () => {
      disposed = true;
      clearTimeout(flush);
      clearTimeout(retry);
      stopSocket();
    };
  }, [live, tokenKey]);

  return useMemo(() => (event && live ? patchEvent(event, patches) : event), [event, live, patches]);
}
