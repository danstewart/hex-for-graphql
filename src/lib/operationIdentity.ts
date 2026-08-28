import { Kind, parse, print, type OperationDefinitionNode } from 'graphql';

export interface ActiveOperationIdentity {
  name: string | null;
  operationIndex: number;
  startOffset: number;
  endOffset: number;
  structuralKey: string;
}

export interface ActiveOperationTransition {
  active: ActiveOperationIdentity | null;
  renamedFrom: string | null;
}

function lineStartOffset(source: string, offset: number): number {
  return source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
}

function lineEndOffset(source: string, offset: number): number {
  const newline = source.indexOf('\n', offset);
  return newline === -1 ? source.length : newline;
}

function structuralKey(definition: OperationDefinitionNode): string {
  return print({
    ...definition,
    name: {
      kind: Kind.NAME,
      value: '__HEX_OPERATION__',
    },
  });
}

/** Returns the named operation at the cursor with stable, source-based identity metadata. */
export function findActiveOperationIdentity(
  source: string,
  cursorOffset: number,
): ActiveOperationIdentity | null {
  try {
    const document = parse(source, { noLocation: false });
    let operationIndex = 0;
    for (const definition of document.definitions) {
      if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
      const currentIndex = operationIndex++;
      if (!definition.loc) continue;

      // Include indentation and trailing whitespace on the operation's boundary lines,
      // matching the editor's existing line-oriented cursor behavior.
      const cursorStart = lineStartOffset(source, definition.loc.start);
      const cursorEnd = lineEndOffset(source, definition.loc.end);
      if (cursorOffset < cursorStart || cursorOffset > cursorEnd) continue;

      return {
        name: definition.name?.value ?? null,
        operationIndex: currentIndex,
        startOffset: definition.loc.start,
        endOffset: definition.loc.end,
        structuralKey: structuralKey(definition),
      };
    }
  } catch {
    // An incomplete edit is not an active parseable operation.
  }
  return null;
}

/**
 * Resolves the active operation and recognizes a name-only change to the same definition.
 * Canonical AST structure prevents cursor movement between operations from looking like a
 * rename, while source-range overlap and definition order disambiguate duplicate bodies.
 */
export function resolveActiveOperationTransition(
  previous: ActiveOperationIdentity | null,
  source: string,
  cursorOffset: number,
): ActiveOperationTransition {
  const active = findActiveOperationIdentity(source, cursorOffset);
  if (!previous || !active) return { active, renamedFrom: null };

  const rangesOverlap = previous.startOffset <= active.endOffset
    && active.startOffset <= previous.endOffset;
  const isSameDefinition = previous.operationIndex === active.operationIndex
    && previous.structuralKey === active.structuralKey
    && rangesOverlap;

  if (!isSameDefinition) return { active, renamedFrom: null };
  if (!active.name && previous.name) {
    // Keep the old identity through the valid intermediate `query { ... }` state that
    // Monaco produces while a selected name is being replaced.
    return { active: { ...active, name: previous.name }, renamedFrom: null };
  }
  if (!previous.name || !active.name || previous.name === active.name) {
    return { active, renamedFrom: null };
  }
  return { active, renamedFrom: previous.name };
}
