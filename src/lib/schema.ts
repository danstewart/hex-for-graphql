import { initializeMode } from 'monaco-graphql/initializeMode';
import type { MonacoGraphQLInitializeConfig } from 'monaco-graphql';
import { buildClientSchema, parse, Kind, getNamedType, isObjectType, isInterfaceType } from 'graphql';
import type { IntrospectionQuery, GraphQLSchema, SelectionSetNode, ASTNode } from 'graphql';
import { getAutocompleteSuggestions, Position as GQLPosition } from 'graphql-language-service';
import type * as Monaco from 'monaco-editor';
import { fetchIntrospection } from './graphql';
import { useStore } from '../store';

type GraphQLMode = ReturnType<typeof initializeMode>;

let mode: GraphQLMode | null = null;
// Built schema stored in the main thread for in-process completions.
let builtSchema: GraphQLSchema | null = null;

export function getBuiltSchema(): GraphQLSchema | null {
  return builtSchema;
}
// Monaco instance, set once the editor first mounts.
let monaco: typeof Monaco | null = null;
// Dispose handle for our custom completion provider.
let completionDisposable: Monaco.IDisposable | null = null;

export function initGraphQLMode(): GraphQLMode {
  if (!mode) {
    console.log('[hex] initGraphQLMode: initializing monaco-graphql mode');
    // Disable worker-based completions; we use our own in-process provider instead
    // to avoid worker serialization/deserialization issues.
    const config: MonacoGraphQLInitializeConfig = { modeConfiguration: { completionItems: false } };
    mode = initializeMode(config);
    console.log('[hex] initGraphQLMode: mode initialized', mode);
  }
  return mode;
}

// Called once from EditorPane.onMount to give us the Monaco instance.
export function setMonacoInstance(instance: typeof Monaco): void {
  monaco = instance;
  // If the schema was already loaded before Monaco was ready, register the provider now.
  if (builtSchema) {
    registerCompletionProvider(builtSchema);
  }
}

// Register (or re-register) our in-process completion provider using the given schema.
// Running completions on the main thread avoids all web worker complexity.
// Returns the set of field names already selected in the selection set that contains
// the given 0-based (line, column) cursor. Returns an empty set if parsing fails or
// the cursor isn't inside a selection set.
function usedFieldsAtCursor(document: string, line: number, column: number): Set<string> {
  try {
    const ast = parse(document, { noLocation: false });
    // Walk every node, collect all SelectionSets, find the innermost one that
    // contains the cursor, then return its field names.
    let best: SelectionSetNode | null = null;
    let bestSize = Infinity;

    function walk(node: ASTNode) {
      if (node.kind === Kind.SELECTION_SET && node.loc) {
        const { startToken, endToken } = node.loc;
        const inRange =
          (line > startToken.line - 1 ||
            (line === startToken.line - 1 && column >= startToken.column - 1)) &&
          (line < endToken.line - 1 ||
            (line === endToken.line - 1 && column <= endToken.column - 1));
        if (inRange) {
          const size = endToken.line - startToken.line;
          if (size < bestSize) {
            bestSize = size;
            best = node;
          }
        }
      }
      for (const key of Object.keys(node) as (keyof ASTNode)[]) {
        const val = node[key];
        if (Array.isArray(val)) {
          for (const child of val) {
            if (child && typeof child === 'object' && 'kind' in child) walk(child as ASTNode);
          }
        } else if (val && typeof val === 'object' && 'kind' in val) {
          walk(val as ASTNode);
        }
      }
    }

    walk(ast);
    if (!best) return new Set();
    const used = new Set<string>();
    for (const sel of (best as SelectionSetNode).selections) {
      if (sel.kind === Kind.FIELD) used.add(sel.name.value);
    }
    return used;
  } catch {
    return new Set();
  }
}

function resolveDocString(doc: unknown): string | null {
  if (!doc) return null;
  if (typeof doc === 'string') return doc || null;
  if (typeof doc === 'object' && 'value' in (doc as object)) {
    return (doc as { value: string }).value || null;
  }
  return null;
}

// Look up a field's description and snippet from the schema directly, since
// graphql-language-service often leaves documentation empty for field completions.
function getFieldInfo(
  schema: GraphQLSchema,
  label: string,
  detail: string | undefined,
): { snippet: string | null; description: string | null } {
  // Extract base return type name from detail (e.g. "[EventConnection!]!" → "EventConnection")
  const typeStr = detail?.includes(':') ? detail.split(':').slice(1).join(':') : (detail ?? '');
  const baseTypeName = typeStr.replace(/[^a-zA-Z0-9_]/g, '');

  // Search all object/interface types for a field named `label` to get its description.
  // Prefer a hit where the field's return type matches the detail.
  let description: string | null = null;
  for (const type of Object.values(schema.getTypeMap())) {
    if (!isObjectType(type) && !isInterfaceType(type)) continue;
    const fields = type.getFields();
    if (!(label in fields)) continue;
    const field = fields[label];
    if (!field.description) continue;
    const fieldBase = getNamedType(field.type).name;
    if (!baseTypeName || fieldBase === baseTypeName) {
      description = field.description;
      break;
    }
    if (!description) description = field.description;
  }

  // Build a selection-set snippet based on the return type.
  if (!baseTypeName) return { snippet: null, description };
  const returnType = schema.getType(baseTypeName);
  if (!returnType || (!isObjectType(returnType) && !isInterfaceType(returnType))) {
    return { snippet: null, description };
  }

  const fields = returnType.getFields();
  if ('edges' in fields) {
    const edgesNamed = getNamedType(fields.edges.type);
    if (edgesNamed && (isObjectType(edgesNamed) || isInterfaceType(edgesNamed))) {
      if ('node' in edgesNamed.getFields()) {
        return { snippet: `${label} {\n\tedges {\n\t\tnode {\n\t\t\t$0\n\t\t}\n\t}\n}`, description };
      }
    }
  }

  return { snippet: `${label} {\n\t$0\n}`, description };
}

function registerCompletionProvider(schema: GraphQLSchema): void {
  if (!monaco) return;
  completionDisposable?.dispose();
  const m = monaco;
  completionDisposable = m.languages.registerCompletionItemProvider('graphql', {
    triggerCharacters: [':', '$', '(', '@'],
    provideCompletionItems(model, position) {
      const document = model.getValue();
      if (!document.trim()) return { suggestions: [] };
      const pos = new GQLPosition(position.lineNumber - 1, position.column - 1);
      try {
        const items = getAutocompleteSuggestions(schema, document, pos);
        const used = usedFieldsAtCursor(document, position.lineNumber - 1, position.column - 1);
        const currentWord = model.getWordUntilPosition(position).word;
        // The parser treats the word being typed as an already-selected field. Keep an
        // exact match so Monaco can rank it ahead of longer fuzzy matches.
        const filtered = used.size > 0
          ? items.filter((entry) => !used.has(entry.label) || entry.label === currentWord)
          : items;
        return {
          incomplete: true,
          suggestions: filtered.map((entry) => {
            const { snippet, description } = getFieldInfo(schema, entry.label, entry.detail ?? undefined);
            const docString = description ?? resolveDocString(entry.documentation);
            return {
              label: docString
                ? { label: entry.label, description: docString.split('\n')[0].slice(0, 120) }
                : entry.label,
              kind: entry.kind as unknown as Monaco.languages.CompletionItemKind,
              detail: entry.detail ?? '',
              documentation: docString ? { value: docString } : undefined,
              insertText: snippet ?? entry.insertText ?? entry.label,
              insertTextRules: snippet
                ? m.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              sortText: entry.sortText,
              filterText: entry.filterText ?? entry.label,
              // Monaco fills in the replacement range from the word at cursor when undefined.
              range: undefined as unknown as Monaco.IRange,
            };
          }),
        };
      } catch {
        return { suggestions: [] };
      }
    },
  });
  console.log('[hex] Completion provider registered for graphql language');
}

export function applyIntrospection(
  uri: string,
  introspectionJSON: IntrospectionQuery,
): void {
  if (!mode) {
    console.warn('[hex] applyIntrospection: mode not initialized, skipping');
    return;
  }
  console.log('[hex] applyIntrospection: applying schema for', uri);
  // Update hover, diagnostics, and formatting (worker-based).
  mode.setSchemaConfig([{ uri, introspectionJSON, fileMatch: ['**'] }]);
  console.log('[hex] applyIntrospection: schema config set, schemas:', mode.schemas);
}

function tryPrettyJson(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}

export async function refreshSchema(): Promise<void> {
  const { endpoint, headers, cookies, setSchemaStatus } = useStore.getState();
  console.log('[hex] refreshSchema: endpoint =', endpoint);
  if (!endpoint) {
    console.log('[hex] refreshSchema: no endpoint, skipping');
    return;
  }
  setSchemaStatus('loading');
  try {
    const headersMap = Object.fromEntries(headers);
    const cookiesMap = Object.fromEntries(cookies);
    console.log('[hex] refreshSchema: fetching introspection from', endpoint);
    const introspection = await fetchIntrospection(endpoint, headersMap, cookiesMap);
    console.log('[hex] refreshSchema: introspection fetched, keys =', Object.keys(introspection));

    builtSchema = buildClientSchema(introspection);
    console.log('[hex] refreshSchema: schema built, types =', Object.keys(builtSchema.getTypeMap()).length);

    // Update hover/diagnostics/formatting worker with the schema.
    applyIntrospection(endpoint, introspection);
    // Register our in-process completion provider.
    registerCompletionProvider(builtSchema);

    setSchemaStatus('loaded');
    console.log('[hex] refreshSchema: schema applied');
  } catch (err) {
    console.error('[hex] refreshSchema: FAILED', err);
    const errStr = String(err);
    const MARKER = '\n\nRESPONSE_BODY\n';
    const markerIdx = errStr.indexOf(MARKER);
    const detail = markerIdx >= 0 ? errStr.slice(0, markerIdx) : errStr;
    const rawBody = markerIdx >= 0 ? errStr.slice(markerIdx + MARKER.length) : undefined;
    const responseBody = rawBody !== undefined ? tryPrettyJson(rawBody) : undefined;
    setSchemaStatus('error', detail);
    useStore.getState().setErrorModal({ title: 'Schema Error', detail, responseBody });
  }
}
