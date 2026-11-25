import { log } from './harness';
import assert from 'node:assert/strict';
import { passage } from '../../apps/desktop/src/original-match';
const runs = ['Test yourself often. ', 'Test yourself often. ', 'Test yourself often.'];
const text = 'Test yourself often. Test yourself often.';
const result = passage(runs, text);
log('ambiguous-passage', { runs, text, result, marked: result && runs.slice(result[0], result[1] + 1).join('') });
assert.equal(result, null, 'A passage occurring in two overlapping places must not mark both as one (D315)');
