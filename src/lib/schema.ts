import { initializeMode } from 'monaco-graphql/initializeMode';
import type { MonacoGraphQLInitializeConfig } from 'monaco-graphql';
import { buildClientSchema, parse, Kind } from 'graphql';
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
    console.log('[gql-ed] initGraphQLMode: initializing monaco-graphql mode');
    // Disable worker-based completions; we use our own in-process provider instead
    // to avoid worker serialization/deserialization issues.
    const config: MonacoGraphQLInitializeConfig = { modeConfiguration: { completionItems: false } };
    mode = initializeMode(config);
    console.log('[gql-ed] initGraphQLMode: mode initialized', mode);
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
        const filtered = used.size > 0 ? items.filter((e) => !used.has(e.label)) : items;
        return {
          incomplete: true,
          suggestions: filtered.map((entry) => ({
            label: entry.label,
            kind: entry.kind as unknown as Monaco.languages.CompletionItemKind,
            detail: entry.detail ?? '',
            documentation: entry.documentation
              ? { value: entry.documentation as string }
              : undefined,
            insertText: entry.insertText ?? entry.label,
            sortText: entry.sortText,
            filterText: entry.filterText ?? entry.label,
            // Monaco fills in the replacement range from the word at cursor when undefined.
            range: undefined as unknown as Monaco.IRange,
          })),
        };
      } catch {
        return { suggestions: [] };
      }
    },
  });
  console.log('[gql-ed] Completion provider registered for graphql language');
}

export function applyIntrospection(
  uri: string,
  introspectionJSON: IntrospectionQuery,
): void {
  if (!mode) {
    console.warn('[gql-ed] applyIntrospection: mode not initialized, skipping');
    return;
  }
  console.log('[gql-ed] applyIntrospection: applying schema for', uri);
  // Update hover, diagnostics, and formatting (worker-based).
  mode.setSchemaConfig([{ uri, introspectionJSON, fileMatch: ['**'] }]);
  console.log('[gql-ed] applyIntrospection: schema config set, schemas:', mode.schemas);
}

export async function refreshSchema(): Promise<void> {
  const { endpoint, headers, setSchemaStatus } = useStore.getState();
  console.log('[gql-ed] refreshSchema: endpoint =', endpoint);
  if (!endpoint) {
    console.log('[gql-ed] refreshSchema: no endpoint, skipping');
    return;
  }
  setSchemaStatus('loading');
  try {
    const headersMap = Object.fromEntries(headers);
    console.log('[gql-ed] refreshSchema: fetching introspection from', endpoint);
    const introspection = await fetchIntrospection(endpoint, headersMap);
    console.log('[gql-ed] refreshSchema: introspection fetched, keys =', Object.keys(introspection));

    builtSchema = buildClientSchema(introspection);
    console.log('[gql-ed] refreshSchema: schema built, types =', Object.keys(builtSchema.getTypeMap()).length);

    // Update hover/diagnostics/formatting worker with the schema.
    applyIntrospection(endpoint, introspection);
    // Register our in-process completion provider.
    registerCompletionProvider(builtSchema);

    setSchemaStatus('loaded');
    console.log('[gql-ed] refreshSchema: schema applied');
  } catch (err) {
    console.error('[gql-ed] refreshSchema: FAILED', err);
    setSchemaStatus('error', String(err));
  }
}
