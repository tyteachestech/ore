import {openLibrary} from '../../packages/core/src/library';
import {today} from '../../packages/core/src/today';
const lib=openLibrary();
if(!lib.root.includes('/codex-out/'))throw Error('Scratch libraries only');
console.log(JSON.stringify(today(lib,new Date(process.argv[2]!))));
