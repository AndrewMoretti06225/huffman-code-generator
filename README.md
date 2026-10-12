# huffman-code-generator

Builds an optimal prefix-free binary code from a frequency table.

## Usage

```js
import { buildHuffmanCode, buildCodeTable } from 'huffman-code-generator';

const frequencies = new Map([
  ['a', 5],
  ['b', 9],
  ['c', 12],
  ['d', 13],
  ['e', 16],
  ['f', 45],
]);

const { tree } = buildHuffmanCode(frequencies);
const table = buildCodeTable(tree);

// table is a Map<symbol, string> where each string is a sequence of '0' and '1'
for (const [symbol, code] of table) {
  console.log(symbol, code);
}
```

## Why

Huffman coding is the standard way to turn a frequency distribution into a
variable-length, prefix-free binary code that minimises the expected code
length. This library exists to provide that one operation with no dependencies
and no surprises: pass in a `Map` of symbol-to-frequency, get back a code
`Map` of symbol-to-bitstring.

The trade-off: the output is a plain `Map` of strings, not a compact bit
buffer. If you need the actual packed bytes, walk the table and pack the bits
yourself. Keeping that step out of the library means the core stays focused on
tree construction and code assignment, and you control the packing format.

## Edge cases

- **Single-symbol alphabets** get the code `"0"`. A one-symbol code is
  technically trivial, but encoding needs to produce a non-empty bitstream,
  so a fixed one-bit code is assigned rather than the empty string.
- **All-zero frequencies** are accepted. The symbols still receive codes (all
  length 1), since the library treats the frequency table as authoritative
  about which symbols exist, not about how often they appear.
- **Negative, NaN, or non-finite frequencies** throw a `RangeError`.
- **Non-Map input** throws a `TypeError`.

The tree-merge step uses a (weight, height) tie-breaker so that when two
subtrees have equal weight, the shallower one is preferred. This keeps code
lengths close to the theoretical minimum without a separate length-limiting
pass.
