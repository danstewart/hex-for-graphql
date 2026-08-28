import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  findOperationAtLine,
  findOperationLine,
  formatOperationAtLine,
  getOperationFoldLines,
  parseDocumentOperations,
  resolveDocTarget,
} from './graphql';

const schema = buildSchema(`
  type Query { viewer(id: ID!): User }
  type User { id: ID!, name: String }
`);

const document = `query Viewer($id: ID!) {
  viewer(id: $id) { id name }
}

mutation Update { updateName }
`;

describe('GraphQL helpers', () => {
  it('parses named operations and ignores malformed documents', () => {
    expect(parseDocumentOperations(document)).toEqual([
      {
        name: 'Viewer',
        type: 'query',
        body: 'query Viewer($id: ID!) {\n  viewer(id: $id) {\n    id\n    name\n  }\n}',
      },
      {
        name: 'Update',
        type: 'mutation',
        body: 'mutation Update {\n  updateName\n}',
      },
    ]);
    expect(parseDocumentOperations('query {')).toEqual([]);
  });

  it('locates, formats, and folds operations by source line', () => {
    expect(findOperationAtLine(document, 2)).toBe('Viewer');
    expect(findOperationAtLine(document, 4)).toBeNull();
    expect(findOperationLine(document, 'Update')).toBe(5);
    expect(findOperationLine('query Recover {\n', 'Recover')).toBe(1);
    expect(formatOperationAtLine(document, 2)).toEqual({
      startLine: 1,
      endLine: 3,
      formatted:
        'query Viewer($id: ID!) {\n  viewer(id: $id) {\n    id\n    name\n  }\n}',
    });
    expect(getOperationFoldLines(document)).toEqual([1, 5]);
  });

  it('resolves fields to their parent type and named types directly', () => {
    const source = 'query Viewer { viewer(id: "1") { name } }';
    expect(resolveDocTarget(schema, source, source.indexOf('name'))).toEqual({
      typeName: 'User',
      fieldName: 'name',
    });
    expect(
      resolveDocTarget(
        schema,
        'query Viewer($id: ID!) { viewer(id: $id) { id } }',
        19,
      ),
    ).toEqual({
      typeName: 'ID',
    });
  });
});
