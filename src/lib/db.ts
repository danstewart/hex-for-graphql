import Database from '@tauri-apps/plugin-sql';
import type { Operation } from '../store';
import { type FontSizePreset, isFontSizePreset, fontSizeFromLegacyPx } from './uiScale';
import type { ThemeId } from './themes';

let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:gqled.db')
      .then(async (conn) => {
        await migrate(conn);
        await seedDefaultTestData(conn);
        return conn;
      })
      .catch((error) => {
        // Allow a later call to retry if opening or migrating the database failed.
        dbPromise = null;
        throw error;
      });
  }
  return dbPromise;
}

const DEFAULT_TEST_ENDPOINT = 'https://graphql.org/graphql';

const DEFAULT_TEST_OPERATIONS: Pick<Operation, 'name' | 'type' | 'body'>[] = [
  {
    name: 'SampleFilms',
    type: 'query',
    body: `query SampleFilms {
  allFilms {
    edges {
      node {
        id
        title
        releaseDate
      }
    }
  }
}`,
  },
  {
    name: 'SampleCharacters',
    type: 'query',
    body: `query SampleCharacters {
  allPeople(first: 5) {
    edges {
      node {
        id
        name
        birthYear
        homeworld {
          name
        }
      }
    }
  }
}`,
  },
  {
    name: 'SampleFilm',
    type: 'query',
    body: `query SampleFilm($id: ID!) {
  film(id: $id) {
    id
    title
    director
    releaseDate
  }
}`,
  },
];

interface Migration {
  version: number;
  run: (conn: Database) => Promise<void>;
}

// SQLite's user_version persists with the database without adding an application table.
// Add future schema changes with the next version; never modify a migration already released.
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    run: async (conn) => {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS operations (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT    NOT NULL UNIQUE,
          type        TEXT    NOT NULL,
          body        TEXT    NOT NULL,
          last_run_at TEXT
        )
      `);
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS editor_state (
          id      INTEGER PRIMARY KEY CHECK (id = 1),
          content TEXT    NOT NULL DEFAULT ''
        )
      `);
      await conn.execute(
        `INSERT OR IGNORE INTO editor_state (id, content) VALUES (1, '')`,
      );
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS operation_variables (
          name      TEXT PRIMARY KEY,
          variables TEXT NOT NULL DEFAULT '{}'
        )
      `);
    },
  },
];

async function migrate(conn: Database): Promise<void> {
  const [row] = await conn.select<{ user_version: number }[]>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  const latestVersion = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

  if (currentVersion > latestVersion) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than supported version ${latestVersion}`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await migration.run(conn);
    await conn.execute(`PRAGMA user_version = ${migration.version}`);
  }
}

async function seedDefaultTestData(conn: Database): Promise<void> {
  const operationRows = await conn.select<{ name: string }[]>(
    'SELECT name FROM operations',
  );
  const [endpointSetting] = await conn.select<{ value: string }[]>(
    `SELECT value FROM settings WHERE key = 'endpoint'`,
  );
  const [seedSetting] = await conn.select<{ value: string }[]>(
    `SELECT value FROM settings WHERE key = 'starter_data_seeded'`,
  );

  if (seedSetting?.value === '1') return;

  const sampleNames = new Set(DEFAULT_TEST_OPERATIONS.map((operation) => operation.name));
  const containsUserOperations = operationRows.some((operation) => !sampleNames.has(operation.name));
  const endpoint = endpointSetting?.value.trim() ?? '';

  // Seed only an unconfigured database (or finish an interrupted partial seed). Existing
  // endpoints and user-created operations always win.
  if (containsUserOperations || (endpoint && endpoint !== DEFAULT_TEST_ENDPOINT)) return;

  await conn.execute(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('endpoint', ?)`,
    [DEFAULT_TEST_ENDPOINT],
  );
  await conn.execute(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('headers', '[]')`,
  );

  for (const operation of DEFAULT_TEST_OPERATIONS) {
    await conn.execute(
      `INSERT OR IGNORE INTO operations (name, type, body, last_run_at)
       VALUES (?, ?, ?, NULL)`,
      [operation.name, operation.type, operation.body],
    );
  }

  await conn.execute(
    `INSERT OR REPLACE INTO operation_variables (name, variables)
     VALUES ('SampleFilm', '{"id":"ZmlsbXM6MQ=="}')`,
  );

  const starterDocument = DEFAULT_TEST_OPERATIONS.map((operation) => operation.body).join('\n\n');
  await conn.execute(
    `UPDATE editor_state SET content = ? WHERE id = 1 AND TRIM(content) = ''`,
    [starterDocument],
  );
  // Write the marker last. If an earlier statement fails, the next launch can safely finish
  // inserting the idempotent starter rows.
  await conn.execute(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('starter_data_seeded', '1')`,
  );
}

export async function loadSettings(): Promise<{
  endpoint: string;
  headers: [string, string][];
  cookies: [string, string][];
  editorFont: string;
  fontSize: FontSizePreset;
  theme: string;
}> {
  const conn = await getDb();
  const rows = await conn.select<{ key: string; value: string }[]>(
    'SELECT key, value FROM settings',
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const parseJsonSetting = <T>(key: string, fallback: T): T => {
    const value = map[key];
    if (value === undefined) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn(`Invalid JSON in database setting "${key}"; using fallback.`, error);
      return fallback;
    }
  };
  const headers = parseJsonSetting<[string, string][]>('headers', []);
  const cookies = parseJsonSetting<[string, string][]>('cookies', []);
  // `font_size` supersedes the legacy numeric `editor_font_size` px setting;
  // fall back to mapping the old value so existing installs keep a sensible size.
  const rawFontSize = map['font_size'];
  const fontSize = rawFontSize && isFontSizePreset(rawFontSize)
    ? rawFontSize
    : fontSizeFromLegacyPx(parseInt(map['editor_font_size'] ?? '14', 10));
  return {
    endpoint: map['endpoint'] ?? '',
    headers,
    cookies,
    editorFont: map['editor_font'] ?? 'Geist Mono, monospace',
    fontSize,
    theme: map['theme'] ?? 'noir',
  };
}

export async function saveSettings(
  endpoint: string,
  headers: [string, string][],
  cookies: [string, string][],
  editorFont: string,
  fontSize: FontSizePreset,
  theme: ThemeId,
): Promise<void> {
  const conn = await getDb();
  const pairs: [string, string][] = [
    ['endpoint', endpoint],
    ['headers', JSON.stringify(headers)],
    ['cookies', JSON.stringify(cookies)],
    ['editor_font', editorFont],
    ['font_size', fontSize],
    ['theme', theme],
  ];
  await saveSettingPairs(conn, pairs);
}

export async function loadOperations(): Promise<Operation[]> {
  const conn = await getDb();
  return conn.select<Operation[]>(
    'SELECT id, name, type, body, last_run_at FROM operations ORDER BY name',
  );
}

export async function upsertOperation(
  op: Pick<Operation, 'name' | 'type' | 'body'>,
): Promise<void> {
  const conn = await getDb();
  await conn.execute(
    `INSERT INTO operations (name, type, body, last_run_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(name) DO UPDATE SET
       type        = excluded.type,
       body        = excluded.body,
       last_run_at = excluded.last_run_at`,
    [op.name, op.type, op.body],
  );
}

export async function deleteOperation(id: number): Promise<void> {
  const conn = await getDb();
  await conn.execute('DELETE FROM operations WHERE id = ?', [id]);
}

export async function loadEditorContent(): Promise<string> {
  const conn = await getDb();
  const rows = await conn.select<{ content: string }[]>(
    'SELECT content FROM editor_state WHERE id = 1',
  );
  return rows[0]?.content ?? '';
}

export async function saveEditorContent(content: string): Promise<void> {
  const conn = await getDb();
  await conn.execute(
    `INSERT OR REPLACE INTO editor_state (id, content) VALUES (1, ?)`,
    [content],
  );
}

export async function loadAllOperationVariables(): Promise<Record<string, string>> {
  const conn = await getDb();
  const rows = await conn.select<{ name: string; variables: string }[]>(
    'SELECT name, variables FROM operation_variables',
  );
  return Object.fromEntries(rows.map((r) => [r.name, r.variables]));
}

export async function saveOperationVariables(name: string, variables: string): Promise<void> {
  const conn = await getDb();
  await conn.execute(
    `INSERT OR REPLACE INTO operation_variables (name, variables) VALUES (?, ?)`,
    [name, variables],
  );
}

export interface LayoutState {
  sidebarWidth: number;
  bottomHeight: number;
  docWidth: number;
  responseFraction: number;
  docOpen: boolean;
  sidebarCollapsed: boolean;
  variablesCollapsed: boolean;
}

export const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: 192,
  bottomHeight: 180,
  docWidth: 300,
  responseFraction: 0.45,
  docOpen: false,
  sidebarCollapsed: false,
  variablesCollapsed: false,
};

export async function loadLayout(): Promise<LayoutState> {
  const conn = await getDb();
  const rows = await conn.select<{ key: string; value: string }[]>(
    `SELECT key, value FROM settings WHERE key LIKE 'layout_%'`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const num = (key: string, fallback: number) => {
    const parsed = parseFloat(map[key] ?? '');
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    sidebarWidth: num('layout_sidebar_width', DEFAULT_LAYOUT.sidebarWidth),
    bottomHeight: num('layout_bottom_height', DEFAULT_LAYOUT.bottomHeight),
    docWidth: num('layout_doc_width', DEFAULT_LAYOUT.docWidth),
    responseFraction: num('layout_response_fraction', DEFAULT_LAYOUT.responseFraction),
    docOpen: map['layout_doc_open'] === '1',
    sidebarCollapsed: map['layout_sidebar_collapsed'] === '1',
    variablesCollapsed: map['layout_variables_collapsed'] === '1',
  };
}

async function saveSettingPairs(conn: Database, pairs: [string, string][]): Promise<void> {
  // The plugin exposes execute/select but no transaction object. One multi-row SQLite
  // statement gives these related settings the required all-or-nothing behavior.
  const placeholders = pairs.map(() => '(?, ?)').join(', ');
  await conn.execute(
    `INSERT INTO settings (key, value) VALUES ${placeholders}
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    pairs.flat(),
  );
}

export async function saveLayout(layout: LayoutState): Promise<void> {
  const conn = await getDb();
  const pairs: [string, string][] = [
    ['layout_sidebar_width', String(layout.sidebarWidth)],
    ['layout_bottom_height', String(layout.bottomHeight)],
    ['layout_doc_width', String(layout.docWidth)],
    ['layout_response_fraction', String(layout.responseFraction)],
    ['layout_doc_open', layout.docOpen ? '1' : '0'],
    ['layout_sidebar_collapsed', layout.sidebarCollapsed ? '1' : '0'],
    ['layout_variables_collapsed', layout.variablesCollapsed ? '1' : '0'],
  ];
  await saveSettingPairs(conn, pairs);
}

export async function renameOperationVariables(oldName: string, newName: string): Promise<void> {
  const conn = await getDb();
  // A single statement is atomic and OR REPLACE preserves the previous behavior when
  // variables already exist under the new operation name.
  await conn.execute(
    'UPDATE OR REPLACE operation_variables SET name = ? WHERE name = ?',
    [newName, oldName],
  );
}
