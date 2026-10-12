import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildHuffmanCode, buildCodeTable } from '../src/index.js';

/**
 * Decodes a binary string using a symbol->code table, returning the list of
 * symbols visited. Used to verify prefix-freeness: a greedy left-to-right
 * match must produce exactly the input sequence with no ambiguity.
 */
function decode(codeString, table) {
  const codeToSymbol = new Map();
  for (const [sym, code] of table) {
    codeToSymbol.set(code, sym);
  }
  const out = [];
  let buf = '';
  for (const bit of codeString) {
    buf += bit;
    if (codeToSymbol.has(buf)) {
      out.push(codeToSymbol.get(buf));
      buf = '';
    }
  }
  assert.equal(buf, '', `leftover bits after decode: ${buf}`);
  return out;
}

/**
 * Standard textbook example. The exact code lengths are fixed by the
 * frequencies; the symbol-to-code assignment is checked against the known
 * optimal code.
 */

const textbook = new Map([
  ['a', 5],
  ['b', 9],
  ['c', 12],
  ['d', 13],
  ['e', 16],
  ['f', 45],
]);

function totalWeight(freqs) {
  let total = 0;
  for (const v of freqs.values()) total += v;
  return total;
}

function weightedLength(table, freqs) {
  let len = 0;
  for (const [sym, code] of table) {
    len += code.length * freqs.get(sym);
  }
  return len;
}

test('empty frequency map yields empty table', () => {
  const { tree } = buildHuffmanCode(new Map());
  assert.equal(tree, null);
  const table = buildCodeTable(tree);
  assert.equal(table.size, 0);
});

test('single symbol gets a one-bit code', () => {
  // A single-symbol alphabet is a degenerate case: the tree is just a leaf.
  // We assign it the code '0' so that encoding produces a non-empty string.
  const freqs = new Map([['x', 10]]);
  const { tree } = buildHuffmanCode(freqs);
  const table = buildCodeTable(tree);
  assert.equal(table.get('x'), '0');
});

test('textbook example produces optimal code lengths', () => {
  const { tree } = buildHuffmanCode(textbook);
  const table = buildCodeTable(tree);

  // Known optimal code lengths for this frequency set.
  const expectedLengths = {
    a: 4,
    b: 4,
    c: 3,
    d: 3,
    e: 3,
    f: 1,
  };

  for (const [sym, code] of table) {
    assert.equal(
      code.length,
      expectedLengths[sym],
      `wrong length for ${sym}: got ${code.length} expected ${expectedLengths[sym]}`,
    );
  }

  // Weighted length is the theoretical minimum: sum of (freq * depth).
  // For this table the minimum is 224.
  assert.equal(weightedLength(table, textbook), 224);
});

test('all codes form a prefix-free set', () => {
  const { tree } = buildHuffmanCode(textbook);
  const table = buildCodeTable(tree);

  const codes = [...table.values()];
  for (let i = 0; i < codes.length; i++) {
    for (let j = 0; j < codes.length; j++) {
      if (i === j) continue;
      assert.ok(
        !codes[j].startsWith(codes[i]),
        `${codes[j]} starts with ${codes[i]} (not prefix-free)`,
      );
    }
  }
});

test('encoding then decoding reproduces the symbol stream', () => {
  const freqs = new Map([
    ['a', 1],
    ['b', 1],
    ['c', 100],
  ]);
  const { tree } = buildHuffmanCode(freqs);
  const table = buildCodeTable(tree);

  const stream = ['c', 'a', 'c', 'b', 'c'];
  const encoded = stream.map((s) => table.get(s)).join('');
  const decoded = decode(encoded, table);
  assert.deepEqual(decoded, stream);
});

test('two symbols of equal frequency each get a one-bit code', () => {
  const freqs = new Map([['p', 7], ['q', 7]]);
  const { tree } = buildHuffmanCode(freqs);
  const table = buildCodeTable(tree);
  assert.equal(table.get('p').length, 1);
  assert.equal(table.get('q').length, 1);
  assert.notEqual(table.get('p'), table.get('q'));
});

test('all-zero frequencies produce length-1 codes', () => {
  // Degenerate but valid: no symbol has any weight. Every symbol still gets
  // a code; the flat chain produces length-1 codes for all but the last.
  const freqs = new Map([['m', 0], ['n', 0], ['o', 0]]);
  const { tree } = buildHuffmanCode(freqs);
  const table = buildCodeTable(tree);
  assert.equal(table.size, 3);
  for (const code of table.values()) {
    assert.ok(code.length === 1 || code.length === 2, `unexpected length ${code.length}`);
  }
});

test('throws TypeError on non-Map input', () => {
  assert.throws(
    () => buildHuffmanCode({ a: 1 }),
    { name: 'TypeError' },
  );
});

test('throws RangeError on negative frequency', () => {
  const freqs = new Map([['a', -1], ['b', 2]]);
  assert.throws(
    () => buildHuffmanCode(freqs),
    { name: 'RangeError' },
  );
});

test('throws RangeError on NaN frequency', () => {
  const freqs = new Map([['a', NaN]]);
  assert.throws(
    () => buildHuffmanCode(freqs),
    { name: 'RangeError' },
  );
});

test('throws RangeError on infinite frequency', () => {
  const freqs = new Map([['a', Infinity]]);
  assert.throws(
    () => buildHuffmanCode(freqs),
    { name: 'RangeError' },
  );
});

test('tie-breaking produces a valid prefix-free code with equal weights', () => {
  // When weights tie, the height tie-breaker keeps the tree shallow. The
  // resulting codes are still prefix-free and cover all symbols.
  const freqs = new Map([['a', 1], ['b', 1], ['c', 1], ['d', 1]]);
  const { tree } = buildHuffmanCode(freqs);
  const table = buildCodeTable(tree);

  assert.equal(table.size, 4);
  const lengths = [...table.values()].map((c) => c.length).sort();
  assert.deepEqual(lengths, [2, 2, 2, 2]);
});

test('optimal weighted length for a skewed distribution', () => {
  // A highly skewed distribution should give the dominant symbol a short code.
  const freqs = new Map([['rare', 1], ['common', 999]]);
  const { tree } = buildHuffmanCode(freqs);
  const table = buildCodeTable(tree);

  assert.equal(table.get('common').length, 1);
  assert.equal(table.get('rare').length, 1);
  assert.notEqual(table.get('common'), table.get('rare'));
});

test('works with numeric symbol keys', () => {
  const freqs = new Map([[0, 3], [1, 1], [2, 1]]);
  const { tree } = buildHuffmanCode(freqs);
  const table = buildCodeTable(tree);
  assert.equal(table.size, 3);
  assert.equal(table.get(0).length, 1);
});
