import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const adminRoot = fileURLToPath(new URL('../', import.meta.url));
const env = Object.fromEntries(readFileSync(resolve(adminRoot, '.env'), 'utf8')
  .split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const split = line.indexOf('=');
    return [line.slice(0, split), line.slice(split + 1).trim().replace(/^['"]|['"]$/g, '')];
  }));
export const origin = new URL(env.VITE_SUPABASE_URL).origin;
if (origin !== 'https://xpvzhnjvpgeghppcjauk.supabase.co') {
  throw new Error('Unexpected project: refusing database operation.');
}
const key = env.VITE_SUPABASE_ANON_KEY;
if (!key) throw new Error('Missing local Supabase client configuration.');

export async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(key.startsWith('ey') ? { Authorization: `Bearer ${key}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const error = new Error(`Supabase request failed: HTTP ${response.status}, code ${data?.code ?? 'unknown'}`);
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return { data, headers: response.headers };
}

export async function readTable(table, filters = {}, order = 'id') {
  if (!/^[a-z][a-z0-9_]*$/.test(table)) throw new Error('Invalid table name.');
  const rows = [];
  let expectedCount;
  while (true) {
    const params = new URLSearchParams({ select: '*', ...filters, order, offset: String(rows.length), limit: '250' });
    const { data, headers } = await request(`/rest/v1/${table}?${params}`, { headers: { Prefer: 'count=exact' } });
    if (!Array.isArray(data)) throw new Error(`${table}: response is not a row array.`);
    const range = headers.get('content-range');
    const total = range?.split('/')[1];
    if (!total || !/^\d+$/.test(total)) throw new Error(`${table}: exact row count unavailable.`);
    const count = Number(total);
    if (expectedCount !== undefined && count !== expectedCount) throw new Error(`${table}: row count changed while exporting; retry.`);
    expectedCount = count;
    rows.push(...data);
    if (rows.length === count) break;
    if (!data.length || rows.length > count) throw new Error(`${table}: incomplete pagination.`);
  }
  const keys = order.split(',').map(column => column.split('.')[0]);
  const identities = rows.map(row => JSON.stringify(keys.map(key => row[key])));
  if (new Set(identities).size !== rows.length) throw new Error(`${table}: unstable or duplicate pagination keys.`);
  return rows;
}

export const tableOrders = {
  courses: 'id', lessons: 'id', cards: 'id', tags: 'id', card_tags: 'card_id,tag_id', homework: 'id',
  achievements: 'id', cosmetics: 'id', subscription_plans: 'id', promo_codes: 'id', marketing_sources: 'id',
  referrals: 'id', user_subscriptions: 'id', user_achievements: 'user_id,achievement_id',
  user_inventory: 'user_id,cosmetic_id', user_learning_stats: 'user_id', ai_usage: 'id', attribution_events: 'id',
  user_course_purchases: 'id', homework_submissions: 'id', promo_redemptions: 'id', wallet_transactions: 'id',
};

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
