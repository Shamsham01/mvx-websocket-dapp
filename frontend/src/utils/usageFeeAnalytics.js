import BigNumber from 'bignumber.js';
import { MAKEX_USAGE_FEE_ADDRESS, REWARD_DECIMALS, REWARD_TOKEN_ID } from '../constants/mvx';

const DAY_MS = 86_400_000;

export function rawToRewardAmount(rawString) {
  return new BigNumber(rawString || 0).shiftedBy(-REWARD_DECIMALS).toNumber();
}

/**
 * @param {object} tx - transfer item from API
 * @returns {{ id: string, timestamp: number, rewardRaw: string, reward: number } | null}
 */
export function parseUsageFeeTransfer(tx) {
  if (!tx || tx.receiver !== MAKEX_USAGE_FEE_ADDRESS) return null;

  const transfers = tx.action?.arguments?.transfers;
  if (!transfers?.length) return null;

  const line = transfers.find((t) => t.token === REWARD_TOKEN_ID || t.identifier === REWARD_TOKEN_ID);
  if (!line?.value) return null;

  const rewardRaw = String(line.value);
  return {
    id: tx.txHash,
    timestamp: typeof tx.timestamp === 'number' ? tx.timestamp : Math.floor(Number(tx.timestampMs || 0) / 1000),
    rewardRaw,
    reward: rawToRewardAmount(rewardRaw),
  };
}

export function normalizeUsageTransfers(transfers) {
  const out = [];
  for (const tx of transfers) {
    const row = parseUsageFeeTransfer(tx);
    if (row) out.push(row);
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

function startOfUtcDay(tsSec) {
  const d = new Date(tsSec * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
}

export function dayKeyUtc(tsSec) {
  return new Date(startOfUtcDay(tsSec) * 1000).toISOString().slice(0, 10);
}

/**
 * @param {Array<{ timestamp: number, reward: number }>} rows
 * @param {number} priceUsd - REWARD price in USD
 */
export function aggregateByDay(rows, priceUsd) {
  const map = new Map();
  for (const r of rows) {
    const key = dayKeyUtc(r.timestamp);
    const prev = map.get(key) || { day: key, reward: 0, usd: 0, count: 0 };
    prev.reward += r.reward;
    prev.usd += r.reward * priceUsd;
    prev.count += 1;
    map.set(key, prev);
  }
  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * @param {ReturnType<aggregateByDay>} daily
 * @param {'daily'|'cumulative'} mode
 */
export function buildChartRows(daily, mode) {
  if (!daily.length) return [];
  let cumR = 0;
  let cumU = 0;
  return daily.map((d) => {
    cumR += d.reward;
    cumU += d.usd;
    const rewardVal = mode === 'cumulative' ? cumR : d.reward;
    const usdVal = mode === 'cumulative' ? cumU : d.usd;
    return {
      day: d.day,
      label: formatDayLabel(d.day),
      reward: rewardVal,
      usd: usdVal,
      calls: d.count,
    };
  });
}

export function formatDayLabel(isoDay) {
  return new Date(`${isoDay}T12:00:00.000Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function cutoffSec(period) {
  const now = Date.now();
  switch (period) {
    case 'week':
      return Math.floor((now - 7 * DAY_MS) / 1000);
    case 'month':
      return Math.floor((now - 30 * DAY_MS) / 1000);
    case 'quarter':
      return Math.floor((now - 90 * DAY_MS) / 1000);
    case 'year':
      return Math.floor((now - 365 * DAY_MS) / 1000);
    case 'all':
    default:
      return 0;
  }
}

/**
 * @param {Array<{ timestamp: number, reward: number }>} rows sorted by time
 * @param {'all'|'week'|'month'|'quarter'|'year'} period
 * @param {number} priceUsd
 */
export function summarizePeriod(rows, period, priceUsd) {
  const cut = cutoffSec(period);
  const slice = period === 'all' ? rows : rows.filter((r) => r.timestamp >= cut);
  const count = slice.length;
  const totalReward = slice.reduce((s, r) => s + r.reward, 0);
  const totalUsd = totalReward * priceUsd;
  const avgReward = count ? totalReward / count : 0;
  const avgUsd = count ? totalUsd / count : 0;
  return { count, totalReward, totalUsd, avgReward, avgUsd };
}

export function buildPeriodSnapshot(rows, priceUsd) {
  return {
    all: summarizePeriod(rows, 'all', priceUsd),
    week: summarizePeriod(rows, 'week', priceUsd),
    month: summarizePeriod(rows, 'month', priceUsd),
    quarter: summarizePeriod(rows, 'quarter', priceUsd),
    year: summarizePeriod(rows, 'year', priceUsd),
  };
}

/** @param {Array<{ day: string, reward: number, usd: number, count: number }>} daily */
export function filterDailyByChartWindow(daily, windowKey) {
  if (windowKey === 'all' || !daily.length) return daily;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (windowKey === '30d') start.setUTCDate(start.getUTCDate() - 30);
  else if (windowKey === '90d') start.setUTCDate(start.getUTCDate() - 90);
  else if (windowKey === '365d') start.setUTCDate(start.getUTCDate() - 365);
  const startIso = start.toISOString().slice(0, 10);
  return daily.filter((d) => d.day >= startIso);
}

/**
 * Fill missing UTC days with zeros so the line chart is continuous.
 * @param {Array<{ day: string, reward: number, usd: number, count: number }>} daily
 */
export function fillDailyGaps(daily, startIso, endIso) {
  const map = new Map(daily.map((d) => [d.day, d]));
  const out = [];
  const cursor = new Date(`${startIso}T12:00:00.000Z`);
  const end = new Date(`${endIso}T12:00:00.000Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    out.push(map.get(key) || { day: key, reward: 0, usd: 0, count: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
