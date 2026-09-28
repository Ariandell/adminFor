import { mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { adminRoot, origin, request, readTable, tableOrders } from './supabase-local.mjs';

const output = process.argv[2];
if (!output || !isAbsolute(output)) throw new Error('Pass a new absolute backup directory outside the admin repository.');
const destination = resolve(output);
if (destination.toLowerCase().startsWith(adminRoot.toLowerCase())) throw new Error('Do not export private data into the admin repository.');
mkdirSync(destination, { recursive: false });
mkdirSync(join(destination, 'tables'));
const manifest = {
  formatVersion: 1, kind: 'postgrest-visible-data-export', completeDatabaseBackup: false,
  project: origin, startedAt: new Date().toISOString(), finishedAt: null, tables: {},
  limitations: [
    'Only tables known from the application/migrations and rows visible to its API role are exported. Empty tables may be filtered by RLS.',
    'This is NOT a PostgreSQL dump: auth users, private schemas, roles, RLS policies, functions, triggers and sequences are not backed up.',
    'Reads are paginated with exact counts, but are not a single transactional snapshot. Avoid editing during export.',
    'Media URLs are preserved; Supabase Storage/R2/video binaries are not downloaded.',
    'SQL migrations included here are repository sources, not an export of the live database schema.',
  ],
};
try {
  const { data } = await request('/rest/v1/');
  writeFileSync(join(destination, 'api-schema.json'), JSON.stringify(data, null, 2), { flag: 'wx' });
  manifest.apiSchema = 'exported';
} catch (error) { manifest.apiSchema = `unavailable: ${error.message}`; }

for (const [table, order] of Object.entries(tableOrders)) {
  try {
    const rows = await readTable(table, {}, order);
    const serialized = JSON.stringify(rows, null, 2) + '\n';
    const file = join(destination, 'tables', `${table}.json`);
    writeFileSync(file, serialized, { flag: 'wx' });
    const sha256 = createHash('sha256').update(serialized).digest('hex');
    if (createHash('sha256').update(readFileSync(file)).digest('hex') !== sha256) throw new Error('Local checksum mismatch.');
    manifest.tables[table] = { status: 'exported', rows: rows.length, bytes: Buffer.byteLength(serialized), sha256 };
    console.log(`${table}: ${rows.length} rows saved and verified`);
  } catch (error) {
    manifest.tables[table] = { status: 'unavailable', error: error.message };
    console.log(`${table}: unavailable (${error.status ?? 'export error'})`);
  }
}
mkdirSync(join(destination, 'schema-source'));
for (const file of readdirSync(join(adminRoot, 'supabase', 'migrations')).filter(file => file.endsWith('.sql'))) {
  copyFileSync(join(adminRoot, 'supabase', 'migrations', file), join(destination, 'schema-source', file));
}
manifest.finishedAt = new Date().toISOString();
writeFileSync(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
writeFileSync(join(destination, 'README.txt'), [
  'Локальна копія доступних даних Supabase',
  `Проєкт: ${origin}`, `Дата: ${manifest.finishedAt}`, '',
  'JSON-файли таблиць — у папці tables. Кількість записів і SHA-256 — у manifest.json.',
  'Це експорт доступних через API даних, НЕ повний серверний бекап PostgreSQL.',
  'Схема, права доступу, auth-користувачі та медіафайли не входять до цієї копії.',
  'Для повного відновлення потрібен окремий серверний бекап; SQL-файли тут — лише наявні міграції.',
  'Зберігайте цю папку приватно. Не додавайте її до Git і не публікуйте.',
].join('\n') + '\n', { flag: 'wx' });
console.log(`Backup directory: ${destination}`);
if (Object.values(manifest.tables).some(table => table.status !== 'exported')) process.exitCode = 2;
