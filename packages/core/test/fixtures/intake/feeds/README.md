# Feed fixtures

Written for Ore for deep scan 5. These synthetic examples are dedicated to the public domain (CC0-1.0); no publisher text was copied.

- `xml-base.xml`: inherited, entry and element bases for post/site/image addresses.
- `latin1.xml`: actual ISO-8859-1 bytes; the tests also derive HTTP-only and Unicode variants.
- `guids.xml`: opaque IDs, legacy lowercase attributes, default/explicit permalinks and link precedence.
- `text-titles.xml`: plain text, HTML and XHTML Atom title constructs.
- `prefixed-atom.xml`: namespace prefixes, an unrelated extension title and complete metadata.

These are Follow metadata, not source documents: no headings, body text, tables or source goldens are generated. Opening the linked article still uses the unchanged source importer.
