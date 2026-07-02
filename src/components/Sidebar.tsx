import { useState } from 'react';
import { parse, Kind } from 'graphql';
import { useStore } from '../store';
import type { Operation } from '../store';
import { deleteOperation, loadOperations } from '../lib/db';

const LABELS: Record<Operation['type'], string> = {
  query: 'Query',
  mutation: 'Mutation',
  subscription: 'Subscription',
};

const ORDER: Operation['type'][] = ['query', 'mutation', 'subscription'];

function getEntityName(body: string): string {
  try {
    const ast = parse(body);
    const def = ast.definitions[0];
    if (def.kind !== Kind.OPERATION_DEFINITION) return '(unknown)';
    const first = def.selectionSet.selections[0];
    if (first.kind !== Kind.FIELD) return '(unknown)';
    return first.name.value;
  } catch {
    return '(unknown)';
  }
}

interface Props {
  onNavigate: (name: string) => void;
}

export function Sidebar({ onNavigate }: Props) {
  const operations = useStore((s) => s.operations);
  const setOperations = useStore((s) => s.setOperations);

  // Build: type → entity → operations[]
  const grouped: Record<Operation['type'], Map<string, Operation[]>> = {
    query: new Map(),
    mutation: new Map(),
    subscription: new Map(),
  };
  for (const op of operations) {
    const entity = getEntityName(op.body);
    const map = grouped[op.type];
    if (!map.has(entity)) map.set(entity, []);
    map.get(entity)!.push(op);
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await deleteOperation(id);
    setOperations(await loadOperations());
  }

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleEntity(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const hasAny = operations.length > 0;

  return (
    <div className="w-full h-full bg-gray-800 flex flex-col overflow-y-auto text-sm select-none">
      {!hasAny && (
        <p className="p-4 text-gray-500 text-xs leading-relaxed">
          Named operations appear here after you run them.
        </p>
      )}

      {ORDER.map((type) => {
        const entityMap = grouped[type];
        if (entityMap.size === 0) return null;
        return (
          <div key={type} className="mt-1">
            <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {LABELS[type]}
            </div>
            {[...entityMap.entries()].map(([entity, ops]) => {
              const key = `${type}:${entity}`;
              const isCollapsed = collapsed.has(key);
              return (
              <div key={entity}>
                <button
                  onClick={() => toggleEntity(key)}
                  className="w-full flex items-center gap-1 px-4 py-0.5 text-[11px] font-medium text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <span className="text-[9px] opacity-60">{isCollapsed ? '▶' : '▼'}</span>
                  {entity}
                </button>
                {!isCollapsed && ops.map((op) => (
                  <div
                    key={op.id}
                    className="group flex items-center hover:bg-gray-700 transition-colors"
                  >
                    <button
                      onClick={() => onNavigate(op.name)}
                      className="flex-1 text-left pl-7 pr-2 py-1 text-gray-300 group-hover:text-gray-100 truncate min-w-0"
                      title={op.name}
                    >
                      {op.name}
                    </button>
                    <button
                      onClick={(e) => void handleDelete(e, op.id)}
                      className="shrink-0 w-6 h-6 mr-1 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 hover:bg-gray-600 transition-all"
                      title={`Delete ${op.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
