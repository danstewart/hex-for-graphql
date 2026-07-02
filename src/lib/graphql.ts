import { parse, print, Kind, getIntrospectionQuery } from 'graphql';
import type { OperationDefinitionNode, IntrospectionQuery } from 'graphql';
import { invoke } from '@tauri-apps/api/core';
import type { Operation } from '../store';

export function parseDocumentOperations(
  doc: string,
): Pick<Operation, 'name' | 'type' | 'body'>[] {
  try {
    const ast = parse(doc, { noLocation: false });
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
    const ast = parse(doc, { noLocation: false });
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
    const ast = parse(doc, { noLocation: false });
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

// Returns the 1-based start line of a named operation, or null if not found.
export function findOperationLine(doc: string, name: string): number | null {
  try {
    const ast = parse(doc, { noLocation: false });
    for (const d of ast.definitions) {
      if (
        d.kind === Kind.OPERATION_DEFINITION &&
        d.name?.value === name &&
        d.loc
      ) {
        return d.loc.startToken.line;
      }
    }
  } catch {}
  return null;
}

export async function executeGraphQL(
  url: string,
  headers: Record<string, string>,
  query: string,
  variables: unknown,
  operationName: string | null,
): Promise<unknown> {
  return invoke('execute_graphql', {
    url,
    headers,
    query,
    variables: variables ?? null,
    operationName: operationName ?? null,
  });
}

export async function fetchIntrospection(
  url: string,
  headers: Record<string, string>,
): Promise<IntrospectionQuery> {
  const result = await invoke<{ data?: IntrospectionQuery; errors?: unknown[] }>(
    'execute_graphql',
    {
      url,
      headers,
      query: getIntrospectionQuery(),
      variables: null,
      operationName: 'IntrospectionQuery',
    },
  );
  if (result.errors?.length) {
    throw new Error(`Introspection errors: ${JSON.stringify(result.errors)}`);
  }
  if (!result.data) {
    throw new Error('Introspection returned no data');
  }
  return result.data;
}
