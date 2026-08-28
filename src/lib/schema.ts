import { initializeMode } from 'monaco-graphql/initializeMode';
import type { MonacoGraphQLInitializeConfig } from 'monaco-graphql';
import { buildClientSchema, parse, Kind, getNamedType, isObjectType, isInterfaceType } from 'graphql';
import type { IntrospectionQuery, GraphQLSchema, SelectionSetNode, ASTNode } from 'graphql';
import { getAutocompleteSuggestions, Position as GQLPosition } from 'graphql-language-service';
import type { CompletionItemKind as GraphQLCompletionItemKind } from 'graphql-language-service';
import type * as Monaco from 'monaco-editor';
import { fetchIntrospection, getGraphQLErrorDetails } from './graphql';
import { useStore } from '../store';

type GraphQLMode = ReturnType<typeof initializeMode>;

let mode: GraphQLMode | null = null;
// Built schema stored in the main thread for in-process completions.
let builtSchema: GraphQLSchema | null = null;

type IndexedFieldInfo = {
  description: string;
  returnTypeName: string;
};

// Built alongside the schema so completions do not scan every schema type per suggestion.
let fieldInfoIndex = new Map<string, IndexedFieldInfo[]>();

export function getBuiltSchema(): GraphQLSchema | null {
  return builtSchema;
}
// Monaco instance, set once the editor first mounts.
let monaco: typeof Monaco | null = null;
// Dispose handle for our custom completion provider.
let completionDisposable: Monaco.IDisposable | null = null;

export function initGraphQLMode(): GraphQLMode {
  if (!mode) {
    // Disable worker-based completions; we use our own in-process provider instead
    // to avoid worker serialization/deserialization issues.
    const config: MonacoGraphQLInitializeConfig = { modeConfiguration: { completionItems: false } };
    mode = initializeMode(config);
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

function resolveDocString(doc: string | null | undefined): string | null {
  return doc || null;
}

function toMonacoCompletionKind(kind: GraphQLCompletionItemKind): Monaco.languages.CompletionItemKind {
  const kindMap: Record<GraphQLCompletionItemKind, Monaco.languages.CompletionItemKind> = {
    1: Monaco.languages.CompletionItemKind.Text,
    2: Monaco.languages.CompletionItemKind.Method,
    3: Monaco.languages.CompletionItemKind.Function,
    4: Monaco.languages.CompletionItemKind.Constructor,
    5: Monaco.languages.CompletionItemKind.Field,
    6: Monaco.languages.CompletionItemKind.Variable,
    7: Monaco.languages.CompletionItemKind.Class,
    8: Monaco.languages.CompletionItemKind.Interface,
    9: Monaco.languages.CompletionItemKind.Module,
    10: Monaco.languages.CompletionItemKind.Property,
    11: Monaco.languages.CompletionItemKind.Unit,
    12: Monaco.languages.CompletionItemKind.Value,
    13: Monaco.languages.CompletionItemKind.Enum,
    14: Monaco.languages.CompletionItemKind.Keyword,
    15: Monaco.languages.CompletionItemKind.Snippet,
    16: Monaco.languages.CompletionItemKind.Color,
    17: Monaco.languages.CompletionItemKind.File,
    18: Monaco.languages.CompletionItemKind.Reference,
    19: Monaco.languages.CompletionItemKind.Folder,
    20: Monaco.languages.CompletionItemKind.EnumMember,
    21: Monaco.languages.CompletionItemKind.Constant,
    22: Monaco.languages.CompletionItemKind.Struct,
    23: Monaco.languages.CompletionItemKind.Event,
    24: Monaco.languages.CompletionItemKind.Operator,
    25: Monaco.languages.CompletionItemKind.TypeParameter,
  };
  return kindMap[kind];
}

function buildFieldInfoIndex(schema: GraphQLSchema): Map<string, IndexedFieldInfo[]> {
  const index = new Map<string, IndexedFieldInfo[]>();
  for (const type of Object.values(schema.getTypeMap())) {
    if (!isObjectType(type) && !isInterfaceType(type)) continue;
    for (const [fieldName, field] of Object.entries(type.getFields())) {
      if (!field.description) continue;
      const fields = index.get(fieldName) ?? [];
      fields.push({ description: field.description, returnTypeName: getNamedType(field.type).name });
      index.set(fieldName, fields);
    }
  }
  return index;
}

// Look up a field's description and snippet from the schema directly, since
// graphql-language-service often leaves documentation empty for field completions.
function getFieldInfo(
  schema: GraphQLSchema,
  fieldIndex: ReadonlyMap<string, IndexedFieldInfo[]>,
  label: string,
  detail: string | undefined,
): { snippet: string | null; description: string | null } {
  // Extract base return type name from detail (e.g. "[EventConnection!]!" → "EventConnection")
  const typeStr = detail?.includes(':') ? detail.split(':').slice(1).join(':') : (detail ?? '');
  const baseTypeName = typeStr.replace(/[^a-zA-Z0-9_]/g, '');

  // Prefer a field whose return type matches the completion detail, falling back to
  // the first field with this name. The index preserves schema type traversal order.
  const fieldInfos = fieldIndex.get(label) ?? [];
  const matchingField = !baseTypeName
    ? fieldInfos[0]
    : fieldInfos.find((field) => field.returnTypeName === baseTypeName) ?? fieldInfos[0];
  const description = matchingField?.description ?? null;

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
            const { snippet, description } = getFieldInfo(
              schema,
              fieldInfoIndex,
              entry.label,
              entry.detail ?? undefined,
            );
            const docString = description ?? resolveDocString(entry.documentation);
            const word = model.getWordUntilPosition(position);
            return {
              label: docString
                ? { label: entry.label, description: docString.split('\n')[0].slice(0, 120) }
                : entry.label,
              kind: toMonacoCompletionKind(entry.kind),
              detail: entry.detail ?? '',
              documentation: docString ? { value: docString } : undefined,
              insertText: snippet ?? entry.insertText ?? entry.label,
              insertTextRules: snippet
                ? m.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              sortText: entry.sortText,
              filterText: entry.filterText ?? entry.label,
              range: new m.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            };
          }),
        };
      } catch {
        return { suggestions: [] };
      }
    },
  });
}

export function applyIntrospection(
  uri: string,
  introspectionJSON: IntrospectionQuery,
): void {
  if (!mode) {
    console.warn('[hex] applyIntrospection: mode not initialized, skipping');
    return;
  }
  // Update hover, diagnostics, and formatting (worker-based).
  mode.setSchemaConfig([{ uri, introspectionJSON, fileMatch: ['**'] }]);
}

export async function refreshSchema(): Promise<void> {
  const { endpoint, headers, cookies, setSchemaStatus } = useStore.getState();
  if (!endpoint) return;
  setSchemaStatus('loading');
  try {
    const headersMap = Object.fromEntries(headers);
    const cookiesMap = Object.fromEntries(cookies);
    const introspection = await fetchIntrospection(endpoint, headersMap, cookiesMap);

    builtSchema = buildClientSchema(introspection);
    fieldInfoIndex = buildFieldInfoIndex(builtSchema);

    // Update hover/diagnostics/formatting worker with the schema.
    applyIntrospection(endpoint, introspection);
    // Register our in-process completion provider.
    registerCompletionProvider(builtSchema);

    setSchemaStatus('loaded');
  } catch (err) {
    console.error('[hex] refreshSchema: FAILED', err);
    const { detail, responseBody } = getGraphQLErrorDetails(err);
    setSchemaStatus('error', detail);
    useStore.getState().setErrorModal({ title: 'Schema Error', detail, responseBody });
  }
}
