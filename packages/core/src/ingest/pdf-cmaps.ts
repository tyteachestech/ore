// The CMaps pdf.js reads a PDF's CJK text with, when a font names its encoding instead of carrying it
// (many Korean, Japanese and Chinese PDFs): carried in the compiled `ore`, so they work in the app too.
// Written by scripts/gen-pdf-cmaps.ts from pdfjs-dist/cmaps; test/pdf-cmaps.test.ts keeps the list whole.
import c0 from "pdfjs-dist/cmaps/78-EUC-H.bcmap" with { type: "file" };
import c1 from "pdfjs-dist/cmaps/78-EUC-V.bcmap" with { type: "file" };
import c2 from "pdfjs-dist/cmaps/78-H.bcmap" with { type: "file" };
import c3 from "pdfjs-dist/cmaps/78-RKSJ-H.bcmap" with { type: "file" };
import c4 from "pdfjs-dist/cmaps/78-RKSJ-V.bcmap" with { type: "file" };
import c5 from "pdfjs-dist/cmaps/78-V.bcmap" with { type: "file" };
import c6 from "pdfjs-dist/cmaps/78ms-RKSJ-H.bcmap" with { type: "file" };
import c7 from "pdfjs-dist/cmaps/78ms-RKSJ-V.bcmap" with { type: "file" };
import c8 from "pdfjs-dist/cmaps/83pv-RKSJ-H.bcmap" with { type: "file" };
import c9 from "pdfjs-dist/cmaps/90ms-RKSJ-H.bcmap" with { type: "file" };
import c10 from "pdfjs-dist/cmaps/90ms-RKSJ-V.bcmap" with { type: "file" };
import c11 from "pdfjs-dist/cmaps/90msp-RKSJ-H.bcmap" with { type: "file" };
import c12 from "pdfjs-dist/cmaps/90msp-RKSJ-V.bcmap" with { type: "file" };
import c13 from "pdfjs-dist/cmaps/90pv-RKSJ-H.bcmap" with { type: "file" };
import c14 from "pdfjs-dist/cmaps/90pv-RKSJ-V.bcmap" with { type: "file" };
import c15 from "pdfjs-dist/cmaps/Add-H.bcmap" with { type: "file" };
import c16 from "pdfjs-dist/cmaps/Add-RKSJ-H.bcmap" with { type: "file" };
import c17 from "pdfjs-dist/cmaps/Add-RKSJ-V.bcmap" with { type: "file" };
import c18 from "pdfjs-dist/cmaps/Add-V.bcmap" with { type: "file" };
import c19 from "pdfjs-dist/cmaps/Adobe-CNS1-0.bcmap" with { type: "file" };
import c20 from "pdfjs-dist/cmaps/Adobe-CNS1-1.bcmap" with { type: "file" };
import c21 from "pdfjs-dist/cmaps/Adobe-CNS1-2.bcmap" with { type: "file" };
import c22 from "pdfjs-dist/cmaps/Adobe-CNS1-3.bcmap" with { type: "file" };
import c23 from "pdfjs-dist/cmaps/Adobe-CNS1-4.bcmap" with { type: "file" };
import c24 from "pdfjs-dist/cmaps/Adobe-CNS1-5.bcmap" with { type: "file" };
import c25 from "pdfjs-dist/cmaps/Adobe-CNS1-6.bcmap" with { type: "file" };
import c26 from "pdfjs-dist/cmaps/Adobe-CNS1-UCS2.bcmap" with { type: "file" };
import c27 from "pdfjs-dist/cmaps/Adobe-GB1-0.bcmap" with { type: "file" };
import c28 from "pdfjs-dist/cmaps/Adobe-GB1-1.bcmap" with { type: "file" };
import c29 from "pdfjs-dist/cmaps/Adobe-GB1-2.bcmap" with { type: "file" };
import c30 from "pdfjs-dist/cmaps/Adobe-GB1-3.bcmap" with { type: "file" };
import c31 from "pdfjs-dist/cmaps/Adobe-GB1-4.bcmap" with { type: "file" };
import c32 from "pdfjs-dist/cmaps/Adobe-GB1-5.bcmap" with { type: "file" };
import c33 from "pdfjs-dist/cmaps/Adobe-GB1-UCS2.bcmap" with { type: "file" };
import c34 from "pdfjs-dist/cmaps/Adobe-Japan1-0.bcmap" with { type: "file" };
import c35 from "pdfjs-dist/cmaps/Adobe-Japan1-1.bcmap" with { type: "file" };
import c36 from "pdfjs-dist/cmaps/Adobe-Japan1-2.bcmap" with { type: "file" };
import c37 from "pdfjs-dist/cmaps/Adobe-Japan1-3.bcmap" with { type: "file" };
import c38 from "pdfjs-dist/cmaps/Adobe-Japan1-4.bcmap" with { type: "file" };
import c39 from "pdfjs-dist/cmaps/Adobe-Japan1-5.bcmap" with { type: "file" };
import c40 from "pdfjs-dist/cmaps/Adobe-Japan1-6.bcmap" with { type: "file" };
import c41 from "pdfjs-dist/cmaps/Adobe-Japan1-UCS2.bcmap" with { type: "file" };
import c42 from "pdfjs-dist/cmaps/Adobe-Korea1-0.bcmap" with { type: "file" };
import c43 from "pdfjs-dist/cmaps/Adobe-Korea1-1.bcmap" with { type: "file" };
import c44 from "pdfjs-dist/cmaps/Adobe-Korea1-2.bcmap" with { type: "file" };
import c45 from "pdfjs-dist/cmaps/Adobe-Korea1-UCS2.bcmap" with { type: "file" };
import c46 from "pdfjs-dist/cmaps/B5-H.bcmap" with { type: "file" };
import c47 from "pdfjs-dist/cmaps/B5-V.bcmap" with { type: "file" };
import c48 from "pdfjs-dist/cmaps/B5pc-H.bcmap" with { type: "file" };
import c49 from "pdfjs-dist/cmaps/B5pc-V.bcmap" with { type: "file" };
import c50 from "pdfjs-dist/cmaps/CNS-EUC-H.bcmap" with { type: "file" };
import c51 from "pdfjs-dist/cmaps/CNS-EUC-V.bcmap" with { type: "file" };
import c52 from "pdfjs-dist/cmaps/CNS1-H.bcmap" with { type: "file" };
import c53 from "pdfjs-dist/cmaps/CNS1-V.bcmap" with { type: "file" };
import c54 from "pdfjs-dist/cmaps/CNS2-H.bcmap" with { type: "file" };
import c55 from "pdfjs-dist/cmaps/CNS2-V.bcmap" with { type: "file" };
import c56 from "pdfjs-dist/cmaps/ETHK-B5-H.bcmap" with { type: "file" };
import c57 from "pdfjs-dist/cmaps/ETHK-B5-V.bcmap" with { type: "file" };
import c58 from "pdfjs-dist/cmaps/ETen-B5-H.bcmap" with { type: "file" };
import c59 from "pdfjs-dist/cmaps/ETen-B5-V.bcmap" with { type: "file" };
import c60 from "pdfjs-dist/cmaps/ETenms-B5-H.bcmap" with { type: "file" };
import c61 from "pdfjs-dist/cmaps/ETenms-B5-V.bcmap" with { type: "file" };
import c62 from "pdfjs-dist/cmaps/EUC-H.bcmap" with { type: "file" };
import c63 from "pdfjs-dist/cmaps/EUC-V.bcmap" with { type: "file" };
import c64 from "pdfjs-dist/cmaps/Ext-H.bcmap" with { type: "file" };
import c65 from "pdfjs-dist/cmaps/Ext-RKSJ-H.bcmap" with { type: "file" };
import c66 from "pdfjs-dist/cmaps/Ext-RKSJ-V.bcmap" with { type: "file" };
import c67 from "pdfjs-dist/cmaps/Ext-V.bcmap" with { type: "file" };
import c68 from "pdfjs-dist/cmaps/GB-EUC-H.bcmap" with { type: "file" };
import c69 from "pdfjs-dist/cmaps/GB-EUC-V.bcmap" with { type: "file" };
import c70 from "pdfjs-dist/cmaps/GB-H.bcmap" with { type: "file" };
import c71 from "pdfjs-dist/cmaps/GB-V.bcmap" with { type: "file" };
import c72 from "pdfjs-dist/cmaps/GBK-EUC-H.bcmap" with { type: "file" };
import c73 from "pdfjs-dist/cmaps/GBK-EUC-V.bcmap" with { type: "file" };
import c74 from "pdfjs-dist/cmaps/GBK2K-H.bcmap" with { type: "file" };
import c75 from "pdfjs-dist/cmaps/GBK2K-V.bcmap" with { type: "file" };
import c76 from "pdfjs-dist/cmaps/GBKp-EUC-H.bcmap" with { type: "file" };
import c77 from "pdfjs-dist/cmaps/GBKp-EUC-V.bcmap" with { type: "file" };
import c78 from "pdfjs-dist/cmaps/GBT-EUC-H.bcmap" with { type: "file" };
import c79 from "pdfjs-dist/cmaps/GBT-EUC-V.bcmap" with { type: "file" };
import c80 from "pdfjs-dist/cmaps/GBT-H.bcmap" with { type: "file" };
import c81 from "pdfjs-dist/cmaps/GBT-V.bcmap" with { type: "file" };
import c82 from "pdfjs-dist/cmaps/GBTpc-EUC-H.bcmap" with { type: "file" };
import c83 from "pdfjs-dist/cmaps/GBTpc-EUC-V.bcmap" with { type: "file" };
import c84 from "pdfjs-dist/cmaps/GBpc-EUC-H.bcmap" with { type: "file" };
import c85 from "pdfjs-dist/cmaps/GBpc-EUC-V.bcmap" with { type: "file" };
import c86 from "pdfjs-dist/cmaps/H.bcmap" with { type: "file" };
import c87 from "pdfjs-dist/cmaps/HKdla-B5-H.bcmap" with { type: "file" };
import c88 from "pdfjs-dist/cmaps/HKdla-B5-V.bcmap" with { type: "file" };
import c89 from "pdfjs-dist/cmaps/HKdlb-B5-H.bcmap" with { type: "file" };
import c90 from "pdfjs-dist/cmaps/HKdlb-B5-V.bcmap" with { type: "file" };
import c91 from "pdfjs-dist/cmaps/HKgccs-B5-H.bcmap" with { type: "file" };
import c92 from "pdfjs-dist/cmaps/HKgccs-B5-V.bcmap" with { type: "file" };
import c93 from "pdfjs-dist/cmaps/HKm314-B5-H.bcmap" with { type: "file" };
import c94 from "pdfjs-dist/cmaps/HKm314-B5-V.bcmap" with { type: "file" };
import c95 from "pdfjs-dist/cmaps/HKm471-B5-H.bcmap" with { type: "file" };
import c96 from "pdfjs-dist/cmaps/HKm471-B5-V.bcmap" with { type: "file" };
import c97 from "pdfjs-dist/cmaps/HKscs-B5-H.bcmap" with { type: "file" };
import c98 from "pdfjs-dist/cmaps/HKscs-B5-V.bcmap" with { type: "file" };
import c99 from "pdfjs-dist/cmaps/Hankaku.bcmap" with { type: "file" };
import c100 from "pdfjs-dist/cmaps/Hiragana.bcmap" with { type: "file" };
import c101 from "pdfjs-dist/cmaps/KSC-EUC-H.bcmap" with { type: "file" };
import c102 from "pdfjs-dist/cmaps/KSC-EUC-V.bcmap" with { type: "file" };
import c103 from "pdfjs-dist/cmaps/KSC-H.bcmap" with { type: "file" };
import c104 from "pdfjs-dist/cmaps/KSC-Johab-H.bcmap" with { type: "file" };
import c105 from "pdfjs-dist/cmaps/KSC-Johab-V.bcmap" with { type: "file" };
import c106 from "pdfjs-dist/cmaps/KSC-V.bcmap" with { type: "file" };
import c107 from "pdfjs-dist/cmaps/KSCms-UHC-H.bcmap" with { type: "file" };
import c108 from "pdfjs-dist/cmaps/KSCms-UHC-HW-H.bcmap" with { type: "file" };
import c109 from "pdfjs-dist/cmaps/KSCms-UHC-HW-V.bcmap" with { type: "file" };
import c110 from "pdfjs-dist/cmaps/KSCms-UHC-V.bcmap" with { type: "file" };
import c111 from "pdfjs-dist/cmaps/KSCpc-EUC-H.bcmap" with { type: "file" };
import c112 from "pdfjs-dist/cmaps/KSCpc-EUC-V.bcmap" with { type: "file" };
import c113 from "pdfjs-dist/cmaps/Katakana.bcmap" with { type: "file" };
import c114 from "pdfjs-dist/cmaps/NWP-H.bcmap" with { type: "file" };
import c115 from "pdfjs-dist/cmaps/NWP-V.bcmap" with { type: "file" };
import c116 from "pdfjs-dist/cmaps/RKSJ-H.bcmap" with { type: "file" };
import c117 from "pdfjs-dist/cmaps/RKSJ-V.bcmap" with { type: "file" };
import c118 from "pdfjs-dist/cmaps/Roman.bcmap" with { type: "file" };
import c119 from "pdfjs-dist/cmaps/UniCNS-UCS2-H.bcmap" with { type: "file" };
import c120 from "pdfjs-dist/cmaps/UniCNS-UCS2-V.bcmap" with { type: "file" };
import c121 from "pdfjs-dist/cmaps/UniCNS-UTF16-H.bcmap" with { type: "file" };
import c122 from "pdfjs-dist/cmaps/UniCNS-UTF16-V.bcmap" with { type: "file" };
import c123 from "pdfjs-dist/cmaps/UniCNS-UTF32-H.bcmap" with { type: "file" };
import c124 from "pdfjs-dist/cmaps/UniCNS-UTF32-V.bcmap" with { type: "file" };
import c125 from "pdfjs-dist/cmaps/UniCNS-UTF8-H.bcmap" with { type: "file" };
import c126 from "pdfjs-dist/cmaps/UniCNS-UTF8-V.bcmap" with { type: "file" };
import c127 from "pdfjs-dist/cmaps/UniGB-UCS2-H.bcmap" with { type: "file" };
import c128 from "pdfjs-dist/cmaps/UniGB-UCS2-V.bcmap" with { type: "file" };
import c129 from "pdfjs-dist/cmaps/UniGB-UTF16-H.bcmap" with { type: "file" };
import c130 from "pdfjs-dist/cmaps/UniGB-UTF16-V.bcmap" with { type: "file" };
import c131 from "pdfjs-dist/cmaps/UniGB-UTF32-H.bcmap" with { type: "file" };
import c132 from "pdfjs-dist/cmaps/UniGB-UTF32-V.bcmap" with { type: "file" };
import c133 from "pdfjs-dist/cmaps/UniGB-UTF8-H.bcmap" with { type: "file" };
import c134 from "pdfjs-dist/cmaps/UniGB-UTF8-V.bcmap" with { type: "file" };
import c135 from "pdfjs-dist/cmaps/UniJIS-UCS2-H.bcmap" with { type: "file" };
import c136 from "pdfjs-dist/cmaps/UniJIS-UCS2-HW-H.bcmap" with { type: "file" };
import c137 from "pdfjs-dist/cmaps/UniJIS-UCS2-HW-V.bcmap" with { type: "file" };
import c138 from "pdfjs-dist/cmaps/UniJIS-UCS2-V.bcmap" with { type: "file" };
import c139 from "pdfjs-dist/cmaps/UniJIS-UTF16-H.bcmap" with { type: "file" };
import c140 from "pdfjs-dist/cmaps/UniJIS-UTF16-V.bcmap" with { type: "file" };
import c141 from "pdfjs-dist/cmaps/UniJIS-UTF32-H.bcmap" with { type: "file" };
import c142 from "pdfjs-dist/cmaps/UniJIS-UTF32-V.bcmap" with { type: "file" };
import c143 from "pdfjs-dist/cmaps/UniJIS-UTF8-H.bcmap" with { type: "file" };
import c144 from "pdfjs-dist/cmaps/UniJIS-UTF8-V.bcmap" with { type: "file" };
import c145 from "pdfjs-dist/cmaps/UniJIS2004-UTF16-H.bcmap" with { type: "file" };
import c146 from "pdfjs-dist/cmaps/UniJIS2004-UTF16-V.bcmap" with { type: "file" };
import c147 from "pdfjs-dist/cmaps/UniJIS2004-UTF32-H.bcmap" with { type: "file" };
import c148 from "pdfjs-dist/cmaps/UniJIS2004-UTF32-V.bcmap" with { type: "file" };
import c149 from "pdfjs-dist/cmaps/UniJIS2004-UTF8-H.bcmap" with { type: "file" };
import c150 from "pdfjs-dist/cmaps/UniJIS2004-UTF8-V.bcmap" with { type: "file" };
import c151 from "pdfjs-dist/cmaps/UniJISPro-UCS2-HW-V.bcmap" with { type: "file" };
import c152 from "pdfjs-dist/cmaps/UniJISPro-UCS2-V.bcmap" with { type: "file" };
import c153 from "pdfjs-dist/cmaps/UniJISPro-UTF8-V.bcmap" with { type: "file" };
import c154 from "pdfjs-dist/cmaps/UniJISX0213-UTF32-H.bcmap" with { type: "file" };
import c155 from "pdfjs-dist/cmaps/UniJISX0213-UTF32-V.bcmap" with { type: "file" };
import c156 from "pdfjs-dist/cmaps/UniJISX02132004-UTF32-H.bcmap" with { type: "file" };
import c157 from "pdfjs-dist/cmaps/UniJISX02132004-UTF32-V.bcmap" with { type: "file" };
import c158 from "pdfjs-dist/cmaps/UniKS-UCS2-H.bcmap" with { type: "file" };
import c159 from "pdfjs-dist/cmaps/UniKS-UCS2-V.bcmap" with { type: "file" };
import c160 from "pdfjs-dist/cmaps/UniKS-UTF16-H.bcmap" with { type: "file" };
import c161 from "pdfjs-dist/cmaps/UniKS-UTF16-V.bcmap" with { type: "file" };
import c162 from "pdfjs-dist/cmaps/UniKS-UTF32-H.bcmap" with { type: "file" };
import c163 from "pdfjs-dist/cmaps/UniKS-UTF32-V.bcmap" with { type: "file" };
import c164 from "pdfjs-dist/cmaps/UniKS-UTF8-H.bcmap" with { type: "file" };
import c165 from "pdfjs-dist/cmaps/UniKS-UTF8-V.bcmap" with { type: "file" };
import c166 from "pdfjs-dist/cmaps/V.bcmap" with { type: "file" };
import c167 from "pdfjs-dist/cmaps/WP-Symbol.bcmap" with { type: "file" };

export const CMAPS: Record<string, string> = {
  "78-EUC-H": c0,
  "78-EUC-V": c1,
  "78-H": c2,
  "78-RKSJ-H": c3,
  "78-RKSJ-V": c4,
  "78-V": c5,
  "78ms-RKSJ-H": c6,
  "78ms-RKSJ-V": c7,
  "83pv-RKSJ-H": c8,
  "90ms-RKSJ-H": c9,
  "90ms-RKSJ-V": c10,
  "90msp-RKSJ-H": c11,
  "90msp-RKSJ-V": c12,
  "90pv-RKSJ-H": c13,
  "90pv-RKSJ-V": c14,
  "Add-H": c15,
  "Add-RKSJ-H": c16,
  "Add-RKSJ-V": c17,
  "Add-V": c18,
  "Adobe-CNS1-0": c19,
  "Adobe-CNS1-1": c20,
  "Adobe-CNS1-2": c21,
  "Adobe-CNS1-3": c22,
  "Adobe-CNS1-4": c23,
  "Adobe-CNS1-5": c24,
  "Adobe-CNS1-6": c25,
  "Adobe-CNS1-UCS2": c26,
  "Adobe-GB1-0": c27,
  "Adobe-GB1-1": c28,
  "Adobe-GB1-2": c29,
  "Adobe-GB1-3": c30,
  "Adobe-GB1-4": c31,
  "Adobe-GB1-5": c32,
  "Adobe-GB1-UCS2": c33,
  "Adobe-Japan1-0": c34,
  "Adobe-Japan1-1": c35,
  "Adobe-Japan1-2": c36,
  "Adobe-Japan1-3": c37,
  "Adobe-Japan1-4": c38,
  "Adobe-Japan1-5": c39,
  "Adobe-Japan1-6": c40,
  "Adobe-Japan1-UCS2": c41,
  "Adobe-Korea1-0": c42,
  "Adobe-Korea1-1": c43,
  "Adobe-Korea1-2": c44,
  "Adobe-Korea1-UCS2": c45,
  "B5-H": c46,
  "B5-V": c47,
  "B5pc-H": c48,
  "B5pc-V": c49,
  "CNS-EUC-H": c50,
  "CNS-EUC-V": c51,
  "CNS1-H": c52,
  "CNS1-V": c53,
  "CNS2-H": c54,
  "CNS2-V": c55,
  "ETHK-B5-H": c56,
  "ETHK-B5-V": c57,
  "ETen-B5-H": c58,
  "ETen-B5-V": c59,
  "ETenms-B5-H": c60,
  "ETenms-B5-V": c61,
  "EUC-H": c62,
  "EUC-V": c63,
  "Ext-H": c64,
  "Ext-RKSJ-H": c65,
  "Ext-RKSJ-V": c66,
  "Ext-V": c67,
  "GB-EUC-H": c68,
  "GB-EUC-V": c69,
  "GB-H": c70,
  "GB-V": c71,
  "GBK-EUC-H": c72,
  "GBK-EUC-V": c73,
  "GBK2K-H": c74,
  "GBK2K-V": c75,
  "GBKp-EUC-H": c76,
  "GBKp-EUC-V": c77,
  "GBT-EUC-H": c78,
  "GBT-EUC-V": c79,
  "GBT-H": c80,
  "GBT-V": c81,
  "GBTpc-EUC-H": c82,
  "GBTpc-EUC-V": c83,
  "GBpc-EUC-H": c84,
  "GBpc-EUC-V": c85,
  "H": c86,
  "HKdla-B5-H": c87,
  "HKdla-B5-V": c88,
  "HKdlb-B5-H": c89,
  "HKdlb-B5-V": c90,
  "HKgccs-B5-H": c91,
  "HKgccs-B5-V": c92,
  "HKm314-B5-H": c93,
  "HKm314-B5-V": c94,
  "HKm471-B5-H": c95,
  "HKm471-B5-V": c96,
  "HKscs-B5-H": c97,
  "HKscs-B5-V": c98,
  "Hankaku": c99,
  "Hiragana": c100,
  "KSC-EUC-H": c101,
  "KSC-EUC-V": c102,
  "KSC-H": c103,
  "KSC-Johab-H": c104,
  "KSC-Johab-V": c105,
  "KSC-V": c106,
  "KSCms-UHC-H": c107,
  "KSCms-UHC-HW-H": c108,
  "KSCms-UHC-HW-V": c109,
  "KSCms-UHC-V": c110,
  "KSCpc-EUC-H": c111,
  "KSCpc-EUC-V": c112,
  "Katakana": c113,
  "NWP-H": c114,
  "NWP-V": c115,
  "RKSJ-H": c116,
  "RKSJ-V": c117,
  "Roman": c118,
  "UniCNS-UCS2-H": c119,
  "UniCNS-UCS2-V": c120,
  "UniCNS-UTF16-H": c121,
  "UniCNS-UTF16-V": c122,
  "UniCNS-UTF32-H": c123,
  "UniCNS-UTF32-V": c124,
  "UniCNS-UTF8-H": c125,
  "UniCNS-UTF8-V": c126,
  "UniGB-UCS2-H": c127,
  "UniGB-UCS2-V": c128,
  "UniGB-UTF16-H": c129,
  "UniGB-UTF16-V": c130,
  "UniGB-UTF32-H": c131,
  "UniGB-UTF32-V": c132,
  "UniGB-UTF8-H": c133,
  "UniGB-UTF8-V": c134,
  "UniJIS-UCS2-H": c135,
  "UniJIS-UCS2-HW-H": c136,
  "UniJIS-UCS2-HW-V": c137,
  "UniJIS-UCS2-V": c138,
  "UniJIS-UTF16-H": c139,
  "UniJIS-UTF16-V": c140,
  "UniJIS-UTF32-H": c141,
  "UniJIS-UTF32-V": c142,
  "UniJIS-UTF8-H": c143,
  "UniJIS-UTF8-V": c144,
  "UniJIS2004-UTF16-H": c145,
  "UniJIS2004-UTF16-V": c146,
  "UniJIS2004-UTF32-H": c147,
  "UniJIS2004-UTF32-V": c148,
  "UniJIS2004-UTF8-H": c149,
  "UniJIS2004-UTF8-V": c150,
  "UniJISPro-UCS2-HW-V": c151,
  "UniJISPro-UCS2-V": c152,
  "UniJISPro-UTF8-V": c153,
  "UniJISX0213-UTF32-H": c154,
  "UniJISX0213-UTF32-V": c155,
  "UniJISX02132004-UTF32-H": c156,
  "UniJISX02132004-UTF32-V": c157,
  "UniKS-UCS2-H": c158,
  "UniKS-UCS2-V": c159,
  "UniKS-UTF16-H": c160,
  "UniKS-UTF16-V": c161,
  "UniKS-UTF32-H": c162,
  "UniKS-UTF32-V": c163,
  "UniKS-UTF8-H": c164,
  "UniKS-UTF8-V": c165,
  "V": c166,
  "WP-Symbol": c167,
};
