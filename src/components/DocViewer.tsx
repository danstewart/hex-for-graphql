import { useState, useMemo } from 'react';
import {
  isObjectType, isInputObjectType, isEnumType, isScalarType,
  isInterfaceType, isUnionType,
} from 'graphql';
import type {
  GraphQLSchema, GraphQLField, GraphQLArgument, GraphQLObjectType,
} from 'graphql';
import { useStore } from '../store';
import { getBuiltSchema } from '../lib/schema';

const BUILTIN = new Set([
  'String', 'Boolean', 'Int', 'Float', 'ID',
  '__Schema', '__Type', '__TypeKind', '__Field', '__InputValue',
  '__EnumValue', '__Directive', '__DirectiveLocation',
]);

function skipType(name: string) {
  return name.startsWith('__') || BUILTIN.has(name);
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800;
  if (t.includes(q)) return 600;
  let s = 0, qi = 0, prev = -2;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      s += i === prev + 1 ? 10 : 2;
      prev = i; qi++;
    }
  }
  return qi === q.length ? s : -1;
}

function TypeRef({ t }: { t: string }) {
  return <span className="text-blue-400 font-mono text-[11px]">{t}</span>;
}

function ArgList({ args }: { args: readonly GraphQLArgument[] }) {
  if (!args.length) return null;
  return (
    <div className="mt-1 pl-2 border-l border-gray-700">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Arguments</div>
      {args.map(arg => (
        <div key={arg.name} className="mb-0.5">
          <span className="text-yellow-300 font-mono text-[11px]">{arg.name}</span>
          <span className="text-gray-600 text-[11px]">: </span>
          <TypeRef t={arg.type.toString()} />
          {arg.defaultValue !== undefined && (
            <span className="text-gray-500 text-[11px]"> = {JSON.stringify(arg.defaultValue)}</span>
          )}
          {arg.description && (
            <div className="text-gray-500 text-[11px] leading-relaxed">{arg.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

interface FieldRowProps {
  name: string;
  typeStr: string;
  description?: string | null;
  args?: readonly GraphQLArgument[];
  indent: number;
  expanded: boolean;
  onToggle: () => void;
}

function FieldRow({ name, typeStr, description, args, indent, expanded, onToggle }: FieldRowProps) {
  const hasDetail = !!(description || (args && args.length > 0));
  return (
    <>
      <button
        onClick={hasDetail ? onToggle : undefined}
        className="w-full text-left flex items-center gap-1 py-[3px] hover:bg-gray-700/40 transition-colors text-[11px]"
        style={{ paddingLeft: 8 + indent * 12 }}
      >
        <span className="text-gray-600 w-2.5 shrink-0 text-[9px] text-center">
          {hasDetail ? (expanded ? '▼' : '▶') : '·'}
        </span>
        <span className="text-gray-200 font-mono">{name}</span>
        <span className="text-gray-600 mx-0.5">:</span>
        <TypeRef t={typeStr} />
      </button>
      {expanded && hasDetail && (
        <div className="pb-2 text-[11px]" style={{ paddingLeft: 8 + indent * 12 + 12 }}>
          {description && <p className="text-gray-400 leading-relaxed mb-1.5">{description}</p>}
          {args && <ArgList args={args} />}
        </div>
      )}
    </>
  );
}

interface SectionProps {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ label, count, expanded, onToggle, children }: SectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-300 transition-colors"
      >
        <span className="text-[9px]">{expanded ? '▼' : '▶'}</span>
        <span>{label}</span>
        <span className="text-gray-600 font-normal normal-case tracking-normal ml-0.5">({count})</span>
      </button>
      {expanded && <div>{children}</div>}
    </div>
  );
}

interface SearchResult {
  key: string;
  typeName: string;
  fieldName?: string;
  typeStr?: string;
  description?: string | null;
  args?: readonly GraphQLArgument[];
  score: number;
}

function buildSearchResults(schema: GraphQLSchema, query: string): SearchResult[] {
  const results: SearchResult[] = [];

  for (const [name, type] of Object.entries(schema.getTypeMap())) {
    if (skipType(name)) continue;
    const ts = fuzzyScore(query, name);
    if (ts > 0) {
      results.push({ key: `t:${name}`, typeName: name, description: type.description, score: ts + 50 });
    }
    if (isObjectType(type) || isInterfaceType(type)) {
      for (const [fname, field] of Object.entries(type.getFields())) {
        const fs = fuzzyScore(query, fname);
        const ds = field.description ? fuzzyScore(query, field.description) : -1;
        const best = Math.max(fs, ds > 0 ? Math.floor(ds / 4) : -1);
        if (best > 0) {
          results.push({
            key: `f:${name}.${fname}`,
            typeName: name,
            fieldName: fname,
            typeStr: field.type.toString(),
            description: field.description,
            args: (field as GraphQLField<unknown, unknown>).args,
            score: best,
          });
        }
      }
    } else if (isInputObjectType(type)) {
      for (const [fname, field] of Object.entries(type.getFields())) {
        const fs = fuzzyScore(query, fname);
        if (fs > 0) {
          results.push({
            key: `if:${name}.${fname}`,
            typeName: name,
            fieldName: fname,
            typeStr: field.type.toString(),
            description: field.description,
            score: fs,
          });
        }
      }
    } else if (isEnumType(type)) {
      for (const val of type.getValues()) {
        const vs = fuzzyScore(query, val.name);
        if (vs > 0) {
          results.push({
            key: `ev:${name}.${val.name}`,
            typeName: name,
            fieldName: val.name,
            description: val.description,
            score: vs,
          });
        }
      }
    }
  }

  return results.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 100);
}

export function DocViewer() {
  const schemaStatus = useStore((s) => s.schemaStatus);
  const setDocOpen = useStore((s) => s.setDocOpen);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['s:Query', 's:Mutation']));

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const schema = schemaStatus === 'loaded' ? getBuiltSchema() : null;
  const trimmedSearch = search.trim();

  const searchResults = useMemo(() => {
    if (!schema || !trimmedSearch) return [];
    return buildSearchResults(schema, trimmedSearch);
  }, [schema, trimmedSearch]);

  const categories = useMemo(() => {
    if (!schema) return null;
    const queryType = schema.getQueryType() ?? null;
    const mutationType = schema.getMutationType() ?? null;
    const subType = schema.getSubscriptionType() ?? null;
    const rootNames = new Set(
      [queryType?.name, mutationType?.name, subType?.name].filter(Boolean) as string[]
    );
    const objects: string[] = [], inputs: string[] = [], enums: string[] = [];
    const scalars: string[] = [], interfaces: string[] = [], unions: string[] = [];
    for (const [name, type] of Object.entries(schema.getTypeMap())) {
      if (skipType(name) || rootNames.has(name)) continue;
      if (isObjectType(type)) objects.push(name);
      else if (isInputObjectType(type)) inputs.push(name);
      else if (isEnumType(type)) enums.push(name);
      else if (isScalarType(type)) scalars.push(name);
      else if (isInterfaceType(type)) interfaces.push(name);
      else if (isUnionType(type)) unions.push(name);
    }
    return {
      queryType, mutationType, subType,
      objects: objects.sort(), inputs: inputs.sort(), enums: enums.sort(),
      scalars: scalars.sort(), interfaces: interfaces.sort(), unions: unions.sort(),
    };
  }, [schema]);

  function renderRootFields(type: GraphQLObjectType) {
    return Object.entries(type.getFields()).map(([fname, field]) => {
      const key = `f:${type.name}.${fname}`;
      return (
        <FieldRow
          key={key}
          name={fname}
          typeStr={field.type.toString()}
          description={field.description}
          args={field.args}
          indent={1}
          expanded={expanded.has(key)}
          onToggle={() => toggle(key)}
        />
      );
    });
  }

  function renderObjectType(typeName: string) {
    if (!schema) return null;
    const type = schema.getType(typeName);
    if (!type || (!isObjectType(type) && !isInterfaceType(type))) return null;
    const typeKey = `t:${typeName}`;
    const open = expanded.has(typeKey);
    return (
      <div key={typeName}>
        <button
          onClick={() => toggle(typeKey)}
          className="w-full text-left flex items-center gap-1 py-[3px] hover:bg-gray-700/40 transition-colors text-[11px]"
          style={{ paddingLeft: 20 }}
        >
          <span className="text-[9px] text-gray-600 w-2.5 text-center">{open ? '▼' : '▶'}</span>
          <span className="text-green-300 font-mono">{typeName}</span>
          {type.description && <span className="text-gray-600 truncate ml-1">{type.description}</span>}
        </button>
        {open && Object.entries(type.getFields()).map(([fname, field]) => {
          const key = `f:${typeName}.${fname}`;
          return (
            <FieldRow
              key={key}
              name={fname}
              typeStr={field.type.toString()}
              description={field.description}
              args={(field as GraphQLField<unknown, unknown>).args}
              indent={2}
              expanded={expanded.has(key)}
              onToggle={() => toggle(key)}
            />
          );
        })}
      </div>
    );
  }

  function renderInputType(typeName: string) {
    if (!schema) return null;
    const type = schema.getType(typeName);
    if (!type || !isInputObjectType(type)) return null;
    const typeKey = `it:${typeName}`;
    const open = expanded.has(typeKey);
    return (
      <div key={typeName}>
        <button
          onClick={() => toggle(typeKey)}
          className="w-full text-left flex items-center gap-1 py-[3px] hover:bg-gray-700/40 transition-colors text-[11px]"
          style={{ paddingLeft: 20 }}
        >
          <span className="text-[9px] text-gray-600 w-2.5 text-center">{open ? '▼' : '▶'}</span>
          <span className="text-orange-300 font-mono">{typeName}</span>
          {type.description && <span className="text-gray-600 truncate ml-1">{type.description}</span>}
        </button>
        {open && Object.entries(type.getFields()).map(([fname, field]) => {
          const key = `if:${typeName}.${fname}`;
          return (
            <FieldRow
              key={key}
              name={fname}
              typeStr={field.type.toString()}
              description={field.description}
              indent={2}
              expanded={expanded.has(key)}
              onToggle={() => toggle(key)}
            />
          );
        })}
      </div>
    );
  }

  function renderEnum(typeName: string) {
    if (!schema) return null;
    const type = schema.getType(typeName);
    if (!type || !isEnumType(type)) return null;
    const typeKey = `en:${typeName}`;
    const open = expanded.has(typeKey);
    return (
      <div key={typeName}>
        <button
          onClick={() => toggle(typeKey)}
          className="w-full text-left flex items-center gap-1 py-[3px] hover:bg-gray-700/40 transition-colors text-[11px]"
          style={{ paddingLeft: 20 }}
        >
          <span className="text-[9px] text-gray-600 w-2.5 text-center">{open ? '▼' : '▶'}</span>
          <span className="text-purple-300 font-mono">{typeName}</span>
          {type.description && <span className="text-gray-600 truncate ml-1">{type.description}</span>}
        </button>
        {open && type.getValues().map(val => (
          <div
            key={val.name}
            className="flex items-center gap-1 py-[3px] text-[11px]"
            style={{ paddingLeft: 32 }}
          >
            <span className="text-gray-600 text-[9px] w-2.5 text-center">·</span>
            <span className="text-gray-300 font-mono">{val.name}</span>
            {val.description && <span className="text-gray-600 truncate">{val.description}</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-800 flex flex-col overflow-hidden text-sm select-none">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-10 bg-gray-800 border-b border-gray-700 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex-1">Docs</span>
        <button
          onClick={() => setDocOpen(false)}
          title="Close documentation"
          className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search types & fields…"
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-[12px] text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {schemaStatus === 'none' && (
          <p className="p-4 text-gray-500 text-xs leading-relaxed">
            Load a schema to browse documentation.
          </p>
        )}
        {schemaStatus === 'loading' && (
          <p className="p-4 text-yellow-400 text-xs">Loading schema…</p>
        )}
        {schemaStatus === 'error' && (
          <p className="p-4 text-red-400 text-xs">Schema failed to load.</p>
        )}

        {/* Search results */}
        {schema && trimmedSearch && (
          searchResults.length === 0 ? (
            <p className="p-4 text-gray-500 text-xs">No results for "{trimmedSearch}"</p>
          ) : (
            <div>
              {searchResults.map(result => (
                <div key={result.key}>
                  <button
                    onClick={() => toggle(result.key)}
                    className="w-full text-left flex items-start gap-1.5 px-2 py-1.5 hover:bg-gray-700/40 transition-colors text-[11px]"
                  >
                    <span className="text-[9px] text-gray-600 mt-0.5 shrink-0 w-2.5 text-center">
                      {expanded.has(result.key) ? '▼' : '▶'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1 flex-wrap">
                        {result.fieldName ? (
                          <>
                            <span className="text-gray-500">{result.typeName}.</span>
                            <span className="text-gray-200 font-mono font-medium">{result.fieldName}</span>
                          </>
                        ) : (
                          <span className="text-green-300 font-mono font-medium">{result.typeName}</span>
                        )}
                        {result.typeStr && (
                          <>
                            <span className="text-gray-600">:</span>
                            <TypeRef t={result.typeStr} />
                          </>
                        )}
                      </div>
                      {expanded.has(result.key) && (
                        <div className="mt-1.5">
                          {result.description && (
                            <p className="text-gray-400 leading-relaxed mb-1.5">{result.description}</p>
                          )}
                          {result.args && result.args.length > 0 && <ArgList args={result.args} />}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* Browse mode */}
        {schema && !trimmedSearch && categories && (
          <div>
            {categories.queryType && (
              <Section
                label="Query"
                count={Object.keys(categories.queryType.getFields()).length}
                expanded={expanded.has('s:Query')}
                onToggle={() => toggle('s:Query')}
              >
                {renderRootFields(categories.queryType)}
              </Section>
            )}
            {categories.mutationType && (
              <Section
                label="Mutation"
                count={Object.keys(categories.mutationType.getFields()).length}
                expanded={expanded.has('s:Mutation')}
                onToggle={() => toggle('s:Mutation')}
              >
                {renderRootFields(categories.mutationType)}
              </Section>
            )}
            {categories.subType && (
              <Section
                label="Subscription"
                count={Object.keys(categories.subType.getFields()).length}
                expanded={expanded.has('s:Subscription')}
                onToggle={() => toggle('s:Subscription')}
              >
                {renderRootFields(categories.subType)}
              </Section>
            )}
            {categories.objects.length > 0 && (
              <Section
                label="Types"
                count={categories.objects.length}
                expanded={expanded.has('s:Types')}
                onToggle={() => toggle('s:Types')}
              >
                {categories.objects.map(n => renderObjectType(n))}
              </Section>
            )}
            {categories.interfaces.length > 0 && (
              <Section
                label="Interfaces"
                count={categories.interfaces.length}
                expanded={expanded.has('s:Interfaces')}
                onToggle={() => toggle('s:Interfaces')}
              >
                {categories.interfaces.map(n => renderObjectType(n))}
              </Section>
            )}
            {categories.unions.length > 0 && (
              <Section
                label="Unions"
                count={categories.unions.length}
                expanded={expanded.has('s:Unions')}
                onToggle={() => toggle('s:Unions')}
              >
                {categories.unions.map(n => {
                  if (!schema) return null;
                  const type = schema.getType(n);
                  if (!type || !isUnionType(type)) return null;
                  const typeKey = `u:${n}`;
                  const open = expanded.has(typeKey);
                  return (
                    <div key={n}>
                      <button
                        onClick={() => toggle(typeKey)}
                        className="w-full text-left flex items-center gap-1 py-[3px] hover:bg-gray-700/40 transition-colors text-[11px]"
                        style={{ paddingLeft: 20 }}
                      >
                        <span className="text-[9px] text-gray-600 w-2.5 text-center">{open ? '▼' : '▶'}</span>
                        <span className="text-pink-300 font-mono">{n}</span>
                        {type.description && <span className="text-gray-600 truncate ml-1">{type.description}</span>}
                      </button>
                      {open && type.getTypes().map(m => (
                        <div key={m.name} className="flex items-center gap-1 py-[3px] text-[11px]" style={{ paddingLeft: 32 }}>
                          <span className="text-gray-600 text-[9px] w-2.5 text-center">·</span>
                          <span className="text-green-300 font-mono">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </Section>
            )}
            {categories.inputs.length > 0 && (
              <Section
                label="Input Types"
                count={categories.inputs.length}
                expanded={expanded.has('s:Inputs')}
                onToggle={() => toggle('s:Inputs')}
              >
                {categories.inputs.map(n => renderInputType(n))}
              </Section>
            )}
            {categories.enums.length > 0 && (
              <Section
                label="Enums"
                count={categories.enums.length}
                expanded={expanded.has('s:Enums')}
                onToggle={() => toggle('s:Enums')}
              >
                {categories.enums.map(n => renderEnum(n))}
              </Section>
            )}
            {categories.scalars.length > 0 && (
              <Section
                label="Scalars"
                count={categories.scalars.length}
                expanded={expanded.has('s:Scalars')}
                onToggle={() => toggle('s:Scalars')}
              >
                {categories.scalars.map(n => {
                  const type = schema.getType(n);
                  return (
                    <div key={n} className="flex items-center gap-1 py-[3px] text-[11px]" style={{ paddingLeft: 20 }}>
                      <span className="text-gray-600 text-[9px] w-2.5 text-center">·</span>
                      <span className="text-cyan-300 font-mono">{n}</span>
                      {type?.description && <span className="text-gray-600 truncate">{type.description}</span>}
                    </div>
                  );
                })}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
