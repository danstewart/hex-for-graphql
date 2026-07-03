import {
  isObjectType, isInputObjectType, isEnumType, isInterfaceType,
} from 'graphql';
import type { GraphQLSchema, GraphQLArgument, GraphQLField } from 'graphql';

const BUILTIN = new Set([
  'String', 'Boolean', 'Int', 'Float', 'ID',
  '__Schema', '__Type', '__TypeKind', '__Field', '__InputValue',
  '__EnumValue', '__Directive', '__DirectiveLocation',
]);

export function skipType(name: string) {
  return name.startsWith('__') || BUILTIN.has(name);
}

export function fuzzyScore(query: string, text: string): number {
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

export interface SchemaSearchResult {
  key: string;
  typeName: string;
  fieldName?: string;
  typeStr?: string;
  description?: string | null;
  args?: readonly GraphQLArgument[];
  score: number;
}

// Fuzzy-searches every type, field, and enum value in the schema. Shared by the Docs
// panel's search box and the command palette so both stay in sync.
export function buildSchemaSearchResults(
  schema: GraphQLSchema,
  query: string,
  limit = 100,
): SchemaSearchResult[] {
  const results: SchemaSearchResult[] = [];

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

  return results.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
