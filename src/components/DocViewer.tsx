import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
import {
  isObjectType, isInputObjectType, isEnumType, isScalarType,
  isInterfaceType, isUnionType, getNamedType,
} from 'graphql';
import type {
  GraphQLField, GraphQLArgument, GraphQLObjectType, GraphQLInputField,
} from 'graphql';
import { useStore } from '../store';
import { getBuiltSchema } from '../lib/schema';
import { skipType, buildSchemaSearchResults as buildSearchResults } from '../lib/schemaSearch';
import { FONT_SIZE_PRESETS } from '../lib/uiScale';

/** Disclosure indicator shared by every collapsible row. `open === null` means "not collapsible". */
function ToggleIcon({ open }: { open: boolean | null }) {
  if (open === null) {
    return (
      <span className="w-2.5 shrink-0 flex justify-center">
        <span className="w-1 h-1 rounded-full bg-slate-600" />
      </span>
    );
  }
  return (
    <span className="text-slate-600 w-2.5 shrink-0 flex justify-center">
      {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
    </span>
  );
}

function TypeRef({ t, onNavigate }: { t: string; onNavigate?: (name: string) => void }) {
  const baseName = t.replace(/\[|\]|!/g, '');
  return (
    <span
      className={`text-syntax-type font-mono text-[11px] ${onNavigate ? 'cursor-pointer hover:text-syntax-type-hover hover:underline' : ''}`}
      onClick={onNavigate ? (e) => { e.stopPropagation(); onNavigate(baseName); } : undefined}
    >
      {t}
    </span>
  );
}

function ArgList({ args, onNavigate }: { args: readonly GraphQLArgument[]; onNavigate?: (name: string) => void }) {
  if (!args.length) return null;
  return (
    <div className="mt-1 pl-2 border-l border-navy-700">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Arguments</div>
      {args.map(arg => (
        <div key={arg.name} className="mb-0.5">
          <span className="text-syntax-argument font-mono text-[11px]">{arg.name}</span>
          <span className="text-slate-600 text-[11px]">: </span>
          <TypeRef t={arg.type.toString()} onNavigate={onNavigate} />
          {arg.defaultValue !== undefined && (
            <span className="text-slate-500 text-[11px]"> = {JSON.stringify(arg.defaultValue)}</span>
          )}
          {arg.description && (
            <div className="text-slate-500 text-[11px] leading-relaxed">{arg.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

interface FieldRowProps {
  id?: string;
  name: string;
  typeStr: string;
  description?: string | null;
  args?: readonly GraphQLArgument[];
  hasChildren?: boolean;
  children?: React.ReactNode;
  indent: number;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: (name: string) => void;
}

function FieldRow({ id, name, typeStr, description, args, hasChildren = false, children, indent, expanded, onToggle, onNavigate }: FieldRowProps) {
  const hasArgs = !!(args && args.length > 0);
  const isCollapsible = hasArgs || hasChildren;
  return (
    <>
      <button
        id={id}
        onClick={isCollapsible ? onToggle : undefined}
        className="w-full text-left flex items-center gap-1 py-[3px] hover:bg-navy-800/40 transition-colors text-[11px]"
        style={{ paddingLeft: 8 + indent * 12 }}
      >
        <ToggleIcon open={isCollapsible ? expanded : null} />
        <span className="text-slate-200 font-mono">{name}</span>
        <span className="text-slate-600 mx-0.5">:</span>
        <TypeRef t={typeStr} onNavigate={onNavigate} />
      </button>
      {description && (
        <p className="text-slate-500 text-[10px] leading-relaxed pb-1" style={{ paddingLeft: 8 + indent * 12 + 12 }}>{description}</p>
      )}
      {expanded && hasArgs && (
        <div className="pb-2 text-[11px]" style={{ paddingLeft: 8 + indent * 12 + 12 }}>
          <ArgList args={args!} onNavigate={onNavigate} />
        </div>
      )}
      {expanded && hasChildren && children}
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
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-300 transition-colors"
      >
        <ToggleIcon open={expanded} />
        <span>{label}</span>
        <span className="text-slate-600 font-normal normal-case tracking-normal ml-0.5">({count})</span>
      </button>
      {expanded && <div>{children}</div>}
    </div>
  );
}

export function DocViewer() {
  const schemaStatus = useStore((s) => s.schemaStatus);
  const setDocOpen = useStore((s) => s.setDocOpen);
  const docTarget = useStore((s) => s.docTarget);
  const setDocTarget = useStore((s) => s.setDocTarget);
  const fontSize = useStore((s) => s.fontSize);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['s:Query', 's:Mutation']));

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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

  // Navigates to a type, or to a specific field within a type (including the Query/
  // Mutation/Subscription root types, which aren't rendered under "Types" like everything
  // else). Used both by in-panel links (TypeRef, etc. — typeName only) and by ctrl/cmd+click
  // in the editor (typeName + fieldName), which arrives via the docTarget store field below.
  const navigateToTarget = useCallback((typeName: string, fieldName?: string) => {
    if (!schema) return;

    const keys: string[] = [];
    const rootSectionKey =
      schema.getQueryType()?.name === typeName ? 's:Query'
      : schema.getMutationType()?.name === typeName ? 's:Mutation'
      : schema.getSubscriptionType()?.name === typeName ? 's:Subscription'
      : null;

    let scrollId: string;
    if (rootSectionKey) {
      keys.push(rootSectionKey);
      scrollId = fieldName ? `doc-f:${typeName}.${fieldName}` : rootSectionKey;
    } else {
      const type = schema.getType(typeName);
      if (!type) return;
      if (isObjectType(type) || isInterfaceType(type)) {
        keys.push(isInterfaceType(type) ? 's:Interfaces' : 's:Types', `t:${typeName}`);
      } else if (isInputObjectType(type)) {
        keys.push('s:Inputs', `it:${typeName}`);
      } else if (isEnumType(type)) {
        keys.push('s:Enums', `en:${typeName}`);
      } else if (isUnionType(type)) {
        keys.push('s:Unions', `u:${typeName}`);
      } else if (isScalarType(type)) {
        keys.push('s:Scalars');
      } else {
        return;
      }
      scrollId = fieldName ? `doc-f:${typeName}.${fieldName}` : `doc-type-${typeName}`;
    }
    if (fieldName) keys.push(`f:${typeName}.${fieldName}`);

    setSearch('');
    setExpanded(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.add(k));
      return next;
    });

    setTimeout(() => {
      document.getElementById(scrollId)?.scrollIntoView({ block: 'start' });
    }, 30);
  }, [schema]);

  // Consume a pending ctrl/cmd+click navigation request from the editor.
  useEffect(() => {
    if (!docTarget || !schema) return;
    navigateToTarget(docTarget.typeName, docTarget.fieldName);
    setDocTarget(null);
  }, [docTarget, schema, navigateToTarget, setDocTarget]);

  function renderRootFields(type: GraphQLObjectType) {
    return Object.entries(type.getFields()).map(([fname, field]) => {
      const key = `f:${type.name}.${fname}`;
      const open = expanded.has(key);
      const path = `${type.name}.${fname}`;
      const visited = new Set([type.name]);
      const hasChildren = hasOutputFields(field, visited);
      return (
        <FieldRow
          key={key}
          id={`doc-${key}`}
          name={fname}
          typeStr={field.type.toString()}
          description={field.description}
          args={field.args}
          hasChildren={hasChildren}
          indent={1}
          expanded={open}
          onToggle={() => toggle(key)}
          onNavigate={navigateToTarget}
        >
          {open && hasChildren ? renderOutputFields(field, path, 2, visited) : null}
        </FieldRow>
      );
    });
  }

  function hasOutputFields(
    field: GraphQLField<unknown, unknown>,
    visited: ReadonlySet<string>,
  ) {
    const namedType = getNamedType(field.type);
    return (isObjectType(namedType) || isInterfaceType(namedType))
      && !visited.has(namedType.name)
      && Object.keys(namedType.getFields()).length > 0;
  }

  function renderOutputFields(
    field: GraphQLField<unknown, unknown>,
    path: string,
    indent: number,
    visited: ReadonlySet<string>,
  ): React.ReactNode {
    const namedType = getNamedType(field.type);
    if ((!isObjectType(namedType) && !isInterfaceType(namedType)) || visited.has(namedType.name)) {
      return null;
    }

    const nextVisited = new Set(visited).add(namedType.name);
    return Object.entries(namedType.getFields()).map(([fname, childField]) => {
      const childPath = `${path}.${fname}`;
      const key = `nf:${childPath}`;
      const open = expanded.has(key);
      const hasChildren = hasOutputFields(childField, nextVisited);
      return (
        <FieldRow
          key={key}
          name={fname}
          typeStr={childField.type.toString()}
          description={childField.description}
          args={childField.args}
          hasChildren={hasChildren}
          indent={indent}
          expanded={open}
          onToggle={() => toggle(key)}
          onNavigate={navigateToTarget}
        >
          {open && hasChildren
            ? renderOutputFields(childField, childPath, indent + 1, nextVisited)
            : null}
        </FieldRow>
      );
    });
  }

  function hasInputFields(field: GraphQLInputField, visited: ReadonlySet<string>) {
    const namedType = getNamedType(field.type);
    return isInputObjectType(namedType)
      && !visited.has(namedType.name)
      && Object.keys(namedType.getFields()).length > 0;
  }

  function renderNestedInputFields(
    field: GraphQLInputField,
    path: string,
    indent: number,
    visited: ReadonlySet<string>,
  ): React.ReactNode {
    const namedType = getNamedType(field.type);
    if (!isInputObjectType(namedType) || visited.has(namedType.name)) return null;

    const nextVisited = new Set(visited).add(namedType.name);
    return Object.entries(namedType.getFields()).map(([fname, childField]) => {
      const childPath = `${path}.${fname}`;
      const key = `nif:${childPath}`;
      const open = expanded.has(key);
      const hasChildren = hasInputFields(childField, nextVisited);
      return (
        <FieldRow
          key={key}
          name={fname}
          typeStr={childField.type.toString()}
          description={childField.description}
          hasChildren={hasChildren}
          indent={indent}
          expanded={open}
          onToggle={() => toggle(key)}
          onNavigate={navigateToTarget}
        >
          {open && hasChildren
            ? renderNestedInputFields(childField, childPath, indent + 1, nextVisited)
            : null}
        </FieldRow>
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
      <div key={typeName} id={`doc-type-${typeName}`}>
        <button
          onClick={() => toggle(typeKey)}
          className="w-full text-left flex items-start gap-1 py-[3px] hover:bg-navy-800/40 transition-colors text-[11px]"
          style={{ paddingLeft: 20 }}
        >
          <span className="mt-0.5"><ToggleIcon open={open} /></span>
          <div className="min-w-0">
            <div className="text-syntax-object font-mono">{typeName}</div>
            {type.description && <div className="text-slate-500 text-[10px] truncate leading-relaxed">{type.description}</div>}
          </div>
        </button>
        {open && Object.entries(type.getFields()).map(([fname, field]) => {
          const key = `f:${typeName}.${fname}`;
          return (
            <FieldRow
              key={key}
              id={`doc-${key}`}
              name={fname}
              typeStr={field.type.toString()}
              description={field.description}
              args={(field as GraphQLField<unknown, unknown>).args}
              indent={2}
              expanded={expanded.has(key)}
              onToggle={() => toggle(key)}
              onNavigate={navigateToTarget}
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
      <div key={typeName} id={`doc-type-${typeName}`}>
        <button
          onClick={() => toggle(typeKey)}
          className="w-full text-left flex items-start gap-1 py-[3px] hover:bg-navy-800/40 transition-colors text-[11px]"
          style={{ paddingLeft: 20 }}
        >
          <span className="mt-0.5"><ToggleIcon open={open} /></span>
          <div className="min-w-0">
            <div className="text-syntax-interface font-mono">{typeName}</div>
            {type.description && <div className="text-slate-500 text-[10px] truncate leading-relaxed">{type.description}</div>}
          </div>
        </button>
        {open && Object.entries(type.getFields()).map(([fname, field]) => {
          const key = `if:${typeName}.${fname}`;
          const fieldOpen = expanded.has(key);
          const path = `${typeName}.${fname}`;
          const visited = new Set([typeName]);
          const hasChildren = hasInputFields(field, visited);
          return (
            <FieldRow
              key={key}
              name={fname}
              typeStr={field.type.toString()}
              description={field.description}
              hasChildren={hasChildren}
              indent={2}
              expanded={fieldOpen}
              onToggle={() => toggle(key)}
              onNavigate={navigateToTarget}
            >
              {fieldOpen && hasChildren
                ? renderNestedInputFields(field, path, 3, visited)
                : null}
            </FieldRow>
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
      <div key={typeName} id={`doc-type-${typeName}`}>
        <button
          onClick={() => toggle(typeKey)}
          className="w-full text-left flex items-start gap-1 py-[3px] hover:bg-navy-800/40 transition-colors text-[11px]"
          style={{ paddingLeft: 20 }}
        >
          <span className="mt-0.5"><ToggleIcon open={open} /></span>
          <div className="min-w-0">
            <div className="text-syntax-enum font-mono">{typeName}</div>
            {type.description && <div className="text-slate-500 text-[10px] truncate leading-relaxed">{type.description}</div>}
          </div>
        </button>
        {open && type.getValues().map(val => (
          <div
            key={val.name}
            className="flex items-center gap-1 py-[3px] text-[11px]"
            style={{ paddingLeft: 32 }}
          >
            <ToggleIcon open={null} />
            <span className="text-slate-300 font-mono">{val.name}</span>
            {val.description && <span className="text-slate-600 truncate">{val.description}</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="w-full h-full bg-navy-900 flex flex-col overflow-hidden text-sm select-none"
      style={{ zoom: FONT_SIZE_PRESETS[fontSize].docsZoom }}
    >
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center px-4 bg-navy-900 border-b border-navy-700">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 flex-1">Docs</span>
        <button
          onClick={() => setDocOpen(false)}
          title="Close documentation"
          className="w-5 h-5 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-navy-800 transition-colors -mr-1"
        >
          <X size={13} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-navy-700 shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search types & fields…"
          className="w-full bg-navy-800 border border-navy-700 rounded-md px-2 py-1 text-[12px] text-slate-200 placeholder-slate-500 outline-none focus:border-accent transition-colors"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {schemaStatus === 'none' && (
          <p className="p-4 text-slate-500 text-xs leading-relaxed">
            Load a schema to browse documentation.
          </p>
        )}
        {schemaStatus === 'loading' && (
          <p className="p-4 text-warning text-xs">Loading schema…</p>
        )}
        {schemaStatus === 'error' && (
          <p className="p-4 text-danger text-xs">Schema failed to load.</p>
        )}

        {/* Search results */}
        {schema && trimmedSearch && (
          searchResults.length === 0 ? (
            <p className="p-4 text-slate-500 text-xs">No results for "{trimmedSearch}"</p>
          ) : (
            <div>
              {searchResults.map(result => (
                <div key={result.key}>
                  <button
                    onClick={() => toggle(result.key)}
                    className="w-full text-left flex items-start gap-1.5 px-2 py-1.5 hover:bg-navy-800/40 transition-colors text-[11px]"
                  >
                    <span className="mt-0.5"><ToggleIcon open={expanded.has(result.key)} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1 flex-wrap">
                        {result.fieldName ? (
                          <>
                            <span className="text-slate-500">{result.typeName}.</span>
                            <span className="text-slate-200 font-mono font-medium">{result.fieldName}</span>
                          </>
                        ) : (
                          <span className="text-syntax-object font-mono font-medium">{result.typeName}</span>
                        )}
                        {result.typeStr && (
                          <>
                            <span className="text-slate-600">:</span>
                            <TypeRef t={result.typeStr} onNavigate={navigateToTarget} />
                          </>
                        )}
                      </div>
                      {expanded.has(result.key) && (
                        <div className="mt-1.5">
                          {result.description && (
                            <p className="text-slate-400 leading-relaxed mb-1.5">{result.description}</p>
                          )}
                          {result.args && result.args.length > 0 && <ArgList args={result.args} onNavigate={navigateToTarget} />}
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
                    <div key={n} id={`doc-type-${n}`}>
                      <button
                        onClick={() => toggle(typeKey)}
                        className="w-full text-left flex items-start gap-1 py-[3px] hover:bg-navy-800/40 transition-colors text-[11px]"
                        style={{ paddingLeft: 20 }}
                      >
                        <span className="mt-0.5"><ToggleIcon open={open} /></span>
                        <div className="min-w-0">
                          <div className="text-syntax-input font-mono">{n}</div>
                          {type.description && <div className="text-slate-500 text-[10px] truncate leading-relaxed">{type.description}</div>}
                        </div>
                      </button>
                      {open && type.getTypes().map(m => (
                        <div key={m.name} className="flex items-center gap-1 py-[3px] text-[11px]" style={{ paddingLeft: 32 }}>
                          <ToggleIcon open={null} />
                          <span
                            className="text-syntax-object font-mono cursor-pointer hover:text-success-hover hover:underline"
                            onClick={() => navigateToTarget(m.name)}
                          >{m.name}</span>
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
                    <div key={n} id={`doc-type-${n}`} className="flex items-center gap-1 py-[3px] text-[11px]" style={{ paddingLeft: 20 }}>
                      <ToggleIcon open={null} />
                      <span className="text-syntax-scalar font-mono">{n}</span>
                      {type?.description && <span className="text-slate-500 truncate ml-1">{type.description}</span>}
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
