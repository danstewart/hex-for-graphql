import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { buildSchemaSearchResults, fuzzyScore, skipType } from './schemaSearch';

const schema = buildSchema(`
  type Query { searchUsers(term: String): [User!]! }
  type User { id: ID!, displayName: String, email: String }
  input SearchInput { displayName: String }
  enum AccountStatus { ACTIVE DISABLED }
`);

describe('schema search', () => {
  it('scores exact, prefix, substring, and fuzzy matches in priority order', () => {
    expect(fuzzyScore('user', 'User')).toBe(1000);
    expect(fuzzyScore('user', 'UserProfile')).toBe(800);
    expect(fuzzyScore('user', 'CurrentUser')).toBe(600);
    expect(fuzzyScore('usr', 'User')).toBeGreaterThan(0);
    expect(fuzzyScore('xyz', 'User')).toBe(-1);
  });

  it('excludes built-in and introspection types', () => {
    expect(skipType('String')).toBe(true);
    expect(skipType('__Type')).toBe(true);
    expect(skipType('User')).toBe(false);
  });

  it('returns ranked type, field, input-field, and enum-value matches', () => {
    const names = buildSchemaSearchResults(schema, 'display').map(
      (result) => result.key,
    );

    expect(names).toContain('f:User.displayName');
    expect(names).toContain('if:SearchInput.displayName');
    expect(buildSchemaSearchResults(schema, 'active')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'ev:AccountStatus.ACTIVE' }),
      ]),
    );
    expect(buildSchemaSearchResults(schema, 'user', 1)).toEqual([
      expect.objectContaining({ key: 't:User', score: 1050 }),
    ]);
  });
});
