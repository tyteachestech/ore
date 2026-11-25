import { log } from './harness';
import { passage } from '../../apps/desktop/src/original-match';
const repeated = 'Test yourself often.';
for (const n of [1, 2, 3, 4]) {
 const runs = Array.from({ length: n }, () => repeated);
 log('repeated-' + n, { fullMatches: Math.max(0, n - 1), result: passage(runs, repeated + ' ' + repeated) });
}
log('absent', passage(['Nothing related here.'], repeated));
log('scan', passage([], repeated));
