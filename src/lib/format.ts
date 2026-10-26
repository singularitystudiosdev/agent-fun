// The footer's "$3M Vol.", transcribed from polymarket.com's formatAbbreviated(v, { decimals: 0, currency: true }).
import type { GammaEvent } from './gamma';

const compactUsd = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  compactDisplay: 'short',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  style: 'currency',
  currency: 'USD',
});

/** 2,923,146 -> "$3M", 999,500 -> "$1M", 999 -> "$999". */
export function formatCardVolume(volume: number | null | undefined): string {
  if (volume == null || !Number.isFinite(volume)) return '$0';
  return compactUsd.format(volume).toUpperCase();
}

/** Which number the footer formats: the series' 24h volume, a lone market's own volume, else the event's. */
export function cardVolumeSource(event: GammaEvent): number {
  if (event.seriesVolume24hr) return event.seriesVolume24hr;
  if (event.markets.length === 1 && !event.series) {
    const market = event.markets[0] as GammaEvent['markets'][number] & { volumeNum?: number; volume?: string };
    return market.volumeNum || Number.parseFloat(market.volume ?? '') || Number(event.volume) || 0;
  }
  return Number(event.volume) || 0;
}
