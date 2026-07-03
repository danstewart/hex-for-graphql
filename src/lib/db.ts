import Database from '@tauri-apps/plugin-sql';
import type { Operation } from '../store';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:gqled.db');
    await migrate(db);
  }
  return db;
}

async function migrate(conn: Database): Promise<void> {
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
}

export async function loadSettings(): Promise<{
  endpoint: string;
  headers: [string, string][];
  editorFont: string;
  editorFontSize: number;
  theme: string;
}> {
  const conn = await getDb();
  const rows = await conn.select<{ key: string; value: string }[]>(
    'SELECT key, value FROM settings',
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  let headers: [string, string][] = [];
  try {
    headers = JSON.parse(map['headers'] ?? '[]');
  } catch {}
  return {
    endpoint: map['endpoint'] ?? '',
    headers,
    editorFont: map['editor_font'] ?? 'Geist Mono, monospace',
    editorFontSize: parseInt(map['editor_font_size'] ?? '14', 10),
    theme: map['theme'] ?? 'noir',
  };
}

export async function saveSettings(
  endpoint: string,
  headers: [string, string][],
  editorFont: string,
  editorFontSize: number,
): Promise<void> {
  const conn = await getDb();
  const pairs: [string, string][] = [
    ['endpoint', endpoint],
    ['headers', JSON.stringify(headers)],
    ['editor_font', editorFont],
    ['editor_font_size', String(editorFontSize)],
  ];
  for (const [key, value] of pairs) {
    await conn.execute(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, value],
    );
  }
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

export async function saveTheme(theme: string): Promise<void> {
  const conn = await getDb();
  await conn.execute(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)`,
    [theme],
  );
}

export async function renameOperationVariables(oldName: string, newName: string): Promise<void> {
  const conn = await getDb();
  await conn.execute(
    `INSERT OR REPLACE INTO operation_variables (name, variables)
     SELECT ?, variables FROM operation_variables WHERE name = ?`,
    [newName, oldName],
  );
  await conn.execute('DELETE FROM operation_variables WHERE name = ?', [oldName]);
}
