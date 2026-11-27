import { unzipSync, type UnzipFileFilter, type Unzipped } from "fflate";

/** More than any book, document, deck or workbook unpacks to: past it, a zip is a zip bomb (F753),
 *  which unpacked a 1.5 MB Word file into 6.6 GB of memory. Reopen if a real source is refused by it. */
export const MAX_UNZIPPED = 1024 ** 3;

/** fflate's `unzipSync`, refusing before anything is unpacked when the parts it keeps declare more than
 *  `max` bytes. fflate unpacks each part into a buffer of its declared size and stops there, so a part that
 *  lies about its size can't unpack past it either. */
export function unzip(data: Uint8Array, filter?: UnzipFileFilter, max = MAX_UNZIPPED): Unzipped {
  let total = 0;
  return unzipSync(data, {
    filter: (f) => {
      if (filter && !filter(f)) return false;
      total += f.originalSize;
      if (total > max) throw new Error(`That file unpacks to more than ${Math.round(max / 1024 ** 3)} GB, far more than a book or document holds, so Ore won’t open it. Export the part you want as a PDF and add that.`);
      return true;
    },
  });
}
