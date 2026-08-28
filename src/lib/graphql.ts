import { parse, print, visit, visitWithTypeInfo, TypeInfo, Kind, getIntrospectionQuery } from 'graphql';
import type { DocumentNode, OperationDefinitionNode, FragmentDefinitionNode, IntrospectionQuery, GraphQLSchema } from 'graphql';
import { collectVariables, getVariablesJSONSchema } from 'graphql-language-service';
import { invoke } from '@tauri-apps/api/core';
import type { Operation } from '../store';

export interface DocTarget {
  typeName: string;
  fieldName?: string;
}

const documentCache = new Map<string, DocumentNode>();
const MAX_CACHED_DOCUMENTS = 100;

function parseDocument(source: string): DocumentNode {
  const cached = documentCache.get(source);
  if (cached) {
    // Refresh recency so actively edited documents are retained.
    documentCache.delete(source);
    documentCache.set(source, cached);
    return cached;
  }

  const document = parse(source, { noLocation: false });
  documentCache.set(source, document);
  if (documentCache.size > MAX_CACHED_DOCUMENTS) {
    documentCache.delete(documentCache.keys().next().value!);
  }
  return document;
}

// Resolves the schema type/field under a character offset in a GraphQL document, so a
// ctrl/cmd+click in the editor can jump straight to that entry in the docs panel.
// Field names resolve to their *parent* type (the type the field is defined on, not its
// return type) — clicking `title` on a Film jumps to Film.title, not to String.
export function resolveDocTarget(
  schema: GraphQLSchema,
  source: string,
  offset: number,
): DocTarget | null {
  let ast;
  try {
    ast = parseDocument(source);
  } catch {
    return null;
  }

  const typeInfo = new TypeInfo(schema);
  let result: DocTarget | null = null;

  const visitor = visitWithTypeInfo(typeInfo, {
    Field: {
      enter(node) {
        const loc = node.name.loc;
        if (loc && offset >= loc.start && offset <= loc.end) {
          const parentType = typeInfo.getParentType();
          if (parentType) result = { typeName: parentType.name, fieldName: node.name.value };
        }
      },
    },
    NamedType: {
      enter(node) {
        const loc = node.name.loc;
        if (loc && offset >= loc.start && offset <= loc.end) {
          result = { typeName: node.name.value };
        }
      },
    },
  });

  try {
    visit(ast, visitor);
  } catch {
    return null;
  }
  return result;
}

// Builds a JSON Schema describing the variable shape a named operation expects, so the
// Variables editor can validate input and offer autocomplete against it. Returns null if
// the operation can't be found or declares no variables.
export function getOperationVariablesSchema(
  schema: GraphQLSchema,
  documentSource: string,
  operationName: string | null,
): Record<string, unknown> | null {
  let ast;
  try {
    ast = parseDocument(documentSource);
  } catch {
    return null;
  }

  const opDef = ast.definitions.find(
    (d): d is OperationDefinitionNode =>
      d.kind === Kind.OPERATION_DEFINITION &&
      (operationName ? d.name?.value === operationName : true),
  );
  if (!opDef || !opDef.variableDefinitions?.length) return null;

  // collectVariables walks every operation in a document, so isolate this one (plus any
  // fragments it might reference) to avoid pulling in variables from unrelated operations.
  const fragmentDefs = ast.definitions.filter(
    (d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION,
  );
  const variableToType = collectVariables(schema, {
    kind: Kind.DOCUMENT,
    definitions: [opDef, ...fragmentDefs],
  });

  return getVariablesJSONSchema(variableToType) as unknown as Record<string, unknown>;
}

export function parseDocumentOperations(
  doc: string,
): Pick<Operation, 'name' | 'type' | 'body'>[] {
  try {
    const ast = parseDocument(doc);
    return ast.definitions
      .filter(
        (d): d is OperationDefinitionNode =>
          d.kind === Kind.OPERATION_DEFINITION && !!d.name,
      )
      .map((d) => ({
        name: d.name!.value,
        type: d.operation as Operation['type'],
        body: print(d),
      }));
  } catch {
    return [];
  }
}

// Returns the name of the operation whose body contains the given 1-based line number.
export function findOperationAtLine(
  doc: string,
  line: number,
): string | null {
  try {
    const ast = parseDocument(doc);
    for (const d of ast.definitions) {
      if (d.kind !== Kind.OPERATION_DEFINITION || !d.name || !d.loc) continue;
      const start = d.loc.startToken.line;
      const end = d.loc.endToken.line;
      if (line >= start && line <= end) return d.name.value;
    }
  } catch {}
  return null;
}

// Returns the formatted text and 1-based line range for the operation at the given cursor line.
// Uses graphql's print() for formatting. Returns null if the cursor is not inside an operation.
export function formatOperationAtLine(
  doc: string,
  line: number,
): { startLine: number; endLine: number; formatted: string } | null {
  try {
    const ast = parseDocument(doc);
    for (const d of ast.definitions) {
      if (d.kind !== Kind.OPERATION_DEFINITION || !d.loc) continue;
      const start = d.loc.startToken.line;
      const end = d.loc.endToken.line;
      if (line >= start && line <= end) {
        return { startLine: start, endLine: end, formatted: print(d) };
      }
    }
  } catch {}
  return null;
}

// Returns the 1-based lines containing the opening braces for each top-level query or
// mutation selection set. Monaco can use these lines to fold just the operation bodies,
// leaving nested selection sets and fragment definitions alone.
export function getOperationFoldLines(doc: string): number[] {
  try {
    const ast = parseDocument(doc);
    return ast.definitions
      .filter(
        (d): d is OperationDefinitionNode =>
          d.kind === Kind.OPERATION_DEFINITION &&
          (d.operation === 'query' || d.operation === 'mutation'),
      )
      .flatMap((d) => d.selectionSet.loc ? [d.selectionSet.loc.startToken.line] : []);
  } catch {
    return [];
  }
}

// Returns the 1-based start line of a named operation, or null if not found.
export function findOperationLine(doc: string, name: string): number | null {
  try {
    const ast = parseDocument(doc);
    for (const d of ast.definitions) {
      if (
        d.kind === Kind.OPERATION_DEFINITION &&
        d.name?.value === name &&
        d.loc
      ) {
        return d.loc.startToken.line;
      }
    }
    return null;
  } catch {
    // Document has syntax errors — fall back to scanning for the operation header.
    const re = new RegExp(`^\\s*(?:query|mutation|subscription)\\s+${name}[\\s({]`);
    const lines = doc.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) return i + 1;
    }
    return null;
  }
}

export async function executeGraphQL(
  url: string,
  headers: Record<string, string>,
  cookies: Record<string, string>,
  query: string,
  variables: unknown,
  operationName: string | null,
): Promise<unknown> {
  return invoke('execute_graphql', {
    url,
    headers,
    cookies,
    query,
    variables: variables ?? null,
    operationName: operationName ?? null,
  });
}

export async function fetchIntrospection(
  url: string,
  headers: Record<string, string>,
  cookies: Record<string, string>,
): Promise<IntrospectionQuery> {
  const result = await invoke<{ data?: IntrospectionQuery; errors?: unknown[] }>(
    'execute_graphql',
    {
      url,
      headers,
      cookies,
      query: getIntrospectionQuery(),
      variables: null,
      operationName: 'IntrospectionQuery',
    },
  );
  if (result.errors?.length) {
    throw new Error(`Introspection errors\n\nRESPONSE_BODY\n${JSON.stringify(result.errors, null, 2)}`);
  }
  if (!result.data) {
    throw new Error(`Introspection returned no data\n\nRESPONSE_BODY\n${JSON.stringify(result, null, 2)}`);
  }
  return result.data;
}
