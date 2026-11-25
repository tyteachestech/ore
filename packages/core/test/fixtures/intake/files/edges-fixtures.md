# Interrupted and malformed imports

`unresolved-spine.epub` was written for Ore's EDGES-09 regression. Its two chapters contain original short sentences about memory. Both chapter files exist, but `book.opf` deliberately omits the second chapter's manifest entry while retaining its spine reference. Expected result: refuse the whole import and suggest downloading/exporting a fresh copy. No golden document exists because no source is saved.

EDGES-10: `empty.html` is deliberately zero bytes. `not-word.docx` is a valid ZIP with only `unrelated.txt` (original text: "This is not a Word document."). Both were written for Ore and must be refused with a next step; neither has a golden document.
