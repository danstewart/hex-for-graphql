import { describe, expect, it } from 'vitest';
import {
  findActiveOperationIdentity,
  resolveActiveOperationTransition,
} from './operationIdentity';

describe('operation identity', () => {
  it('detects a renamed operation with the same structure', () => {
    const original = 'query Before { viewer { id } }';
    const previous = findActiveOperationIdentity(
      original,
      original.indexOf('Before'),
    );
    const renamed = 'query After { viewer { id } }';

    expect(
      resolveActiveOperationTransition(
        previous,
        renamed,
        renamed.indexOf('After'),
      ),
    ).toMatchObject({
      active: { name: 'After' },
      renamedFrom: 'Before',
    });
  });

  it('retains the prior name while the editor has an anonymous intermediate operation', () => {
    const original = 'query Before { viewer { id } }';
    const previous = findActiveOperationIdentity(
      original,
      original.indexOf('Before'),
    );
    const intermediate = 'query { viewer { id } }';

    expect(
      resolveActiveOperationTransition(previous, intermediate, 0),
    ).toMatchObject({
      active: { name: 'Before' },
      renamedFrom: null,
    });
  });

  it('does not mistake moving to an equivalent second operation for a rename', () => {
    const source =
      'query First { viewer { id } }\nquery Second { viewer { id } }';
    const previous = findActiveOperationIdentity(
      source,
      source.indexOf('First'),
    );

    expect(
      resolveActiveOperationTransition(
        previous,
        source,
        source.indexOf('Second'),
      ),
    ).toMatchObject({
      active: { name: 'Second' },
      renamedFrom: null,
    });
  });

  it('returns null for malformed documents and cursors outside an operation', () => {
    expect(findActiveOperationIdentity('query Broken {', 0)).toBeNull();
    expect(
      findActiveOperationIdentity('query Named { viewer { id } }', 100),
    ).toBeNull();
  });
});
