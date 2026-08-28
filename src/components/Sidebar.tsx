import { useState } from 'react';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
import { parse, Kind } from 'graphql';
import { useStore } from '../store';
import type { Operation } from '../store';
import { deleteOperation, loadOperations } from '../lib/db';
import { FONT_SIZE_PRESETS } from '../lib/uiScale';

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
  const fontSize = useStore((s) => s.fontSize);

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
    <div
      className="w-full h-full bg-navy-900 flex flex-col overflow-y-auto text-[13px] font-mono select-none"
      style={{ zoom: FONT_SIZE_PRESETS[fontSize].uiZoom }}
    >
      {!hasAny && (
        <p className="p-4 text-slate-600 text-xs leading-relaxed">
          Run a named operation to save it here.
        </p>
      )}

      {ORDER.map((type) => {
        const entityMap = grouped[type];
        if (entityMap.size === 0) return null;
        return (
          <div key={type} className="mt-1">
            <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              {LABELS[type]}
            </div>
            {[...entityMap.entries()].map(([entity, ops]) => {
              const key = `${type}:${entity}`;
              const isCollapsed = collapsed.has(key);
              return (
              <div key={entity} className="mt-2 first:mt-0">
                <button
                  onClick={() => toggleEntity(key)}
                  className="w-full flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold text-slate-300 hover:text-slate-100 transition-colors"
                >
                  <span className="opacity-60">
                    {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  </span>
                  {entity}
                </button>
                {!isCollapsed && (
                  <div className="ml-4 border-l border-navy-800">
                    {ops.map((op) => (
                      <div
                        key={op.id}
                        className="group flex items-center hover:bg-navy-800 transition-colors"
                      >
                        <button
                          onClick={() => onNavigate(op.name)}
                          className="flex-1 text-left pl-3 pr-2 py-1 text-[12px] font-normal text-slate-500 group-hover:text-slate-200 truncate min-w-0 transition-colors"
                          title={op.name}
                        >
                          {op.name}
                        </button>
                        <button
                          onClick={(e) => void handleDelete(e, op.id)}
                          className="shrink-0 w-6 h-6 mr-1 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 text-slate-500 hover:text-danger hover:bg-navy-700 transition-all"
                          title={`Delete ${op.name}`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
