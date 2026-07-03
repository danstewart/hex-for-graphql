import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../store';
import { getBuiltSchema } from '../lib/schema';
import { buildSchemaSearchResults } from '../lib/schemaSearch';

interface Props {
  onNavigateOperation: (name: string) => void;
}

interface PaletteItem {
  key: string;
  label: string;
  sublabel: string;
  onSelect: () => void;
}

export function CommandPalette({ onNavigateOperation }: Props) {
  const open = useStore((s) => s.commandPaletteOpen);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const operations = useStore((s) => s.operations);
  const schemaStatus = useStore((s) => s.schemaStatus);
  const setDocOpen = useStore((s) => s.setDocOpen);
  const setDocTarget = useStore((s) => s.setDocTarget);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim();
    const qLower = q.toLowerCase();

    const opItems: PaletteItem[] = operations
      .filter((op) => !q || op.name.toLowerCase().includes(qLower))
      .map((op) => ({
        key: `op:${op.id}`,
        label: op.name,
        sublabel: op.type,
        onSelect: () => {
          onNavigateOperation(op.name);
          setOpen(false);
        },
      }));

    if (!q) return opItems;

    const schema = schemaStatus === 'loaded' ? getBuiltSchema() : null;
    const schemaItems: PaletteItem[] = schema
      ? buildSchemaSearchResults(schema, q, 30).map((r) => ({
          key: `schema:${r.key}`,
          label: r.fieldName ? `${r.typeName}.${r.fieldName}` : r.typeName,
          sublabel: r.typeStr ?? 'type',
          onSelect: () => {
            setDocOpen(true);
            setDocTarget({ typeName: r.typeName, fieldName: r.fieldName });
            setOpen(false);
          },
        }))
      : [];

    return [...opItems, ...schemaItems];
  }, [query, operations, schemaStatus, onNavigateOperation, setOpen, setDocOpen, setDocTarget]);

  useEffect(() => {
    setSelected(0);
  }, [query, items.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[selected]?.onSelect();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [items, selected, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[15vh] z-50"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-navy-900 rounded-xl w-[520px] max-h-[60vh] shadow-2xl border border-navy-700 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 h-11 border-b border-navy-700 shrink-0">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to an operation, type, or field…"
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-slate-600 text-xs">
              {query ? 'No matches' : 'Start typing to search'}
            </p>
          )}
          {items.map((item, i) => (
            <button
              key={item.key}
              onClick={item.onSelect}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[13px] font-mono transition-colors ${
                i === selected ? 'bg-navy-800 text-slate-100' : 'text-slate-400'
              }`}
            >
              <span className="truncate">{item.label}</span>
              <span className="text-[11px] text-slate-600 shrink-0 font-sans">{item.sublabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
