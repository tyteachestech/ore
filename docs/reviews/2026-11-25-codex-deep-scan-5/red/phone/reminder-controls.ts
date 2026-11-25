import assert from 'node:assert/strict';
import {reminderTimes} from '../../apps/desktop/src/phone/reminder';
const input={reminder:'09:30',weekdays_only:false,counts:true,met:false,due:12};
for(const [label,now,delta] of [
 ['spring',new Date(2026,2,7,8),23], ['fall',new Date(2026,9,31,8),25]
] as const) {
 const times=reminderTimes(input,now,3);
 assert.ok(times.every(d=>d.getHours()===9 && d.getMinutes()===30));
 assert.equal((+times[1]! - +times[0]!)/3600000,delta);
 console.log('[DEEP]',JSON.stringify({label,hours:times.map(d=>d.toString()),gapHours:delta}));
}
const now=new Date(2026,10,24,8);
for(const patch of [{due:0},{met:true},{counts:false}]) {
 const times=reminderTimes({...input,...patch},now,2);
 assert.equal(times.length,1);assert.equal(times[0]!.getDate(),25);
}
assert.deepEqual(reminderTimes({...input,reminder:''},now),[]);
console.log('[DEEP] no-due, met, non-counting-day and off controls passed');
