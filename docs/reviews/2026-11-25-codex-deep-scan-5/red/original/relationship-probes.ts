import {log} from './harness';
import {readFileSync} from 'node:fs';
import {posix} from 'node:path';
import {unzipSync} from '../../packages/core/node_modules/fflate';
import {uriToZipEntryName} from '../../packages/core/node_modules/mammoth/lib/docx/uris';
const files=unzipSync(readFileSync('packages/core/test/fixtures/intake/files/deck.pptx'));
for(const target of ['../notesSlides/notesSlide1.xml','/ppt/notesSlides/notesSlide1.xml']){
 const actual=posix.normalize(posix.join('ppt/slides',target));
 const expected=posix.normalize(uriToZipEntryName('ppt/slides',target));
 log('relationship',{target,coreLookup:actual,coreEntryExists:!!files[actual],packageLookup:expected,packageEntryExists:!!files[expected]});
}
