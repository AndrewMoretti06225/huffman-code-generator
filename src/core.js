/**
 * Huffman code construction.
 *
 * The tree is built with a min-heap keyed on (weight, height). The height is
 * the number of edges on the longest root-to-leaf path in that subtree. Using
 * height as a tie-breaker is what keeps the code lengths close to the
 * theoretical minimum: among trees of equal weight, the shallower one is
 * chosen first, so deep, unbalanced merges are deferred when a flatter
 * candidate of the same weight exists. This is the well-known variant that
 * produces length-limited-ish trees without a separate restriction pass.
 */

/**
 * A min-heap of internal tree nodes.
 *
 * Each entry is { weight, height, node } where `node` is a Leaf or a Branch.
 * Comparisons use weight first, then height, so that when two subtrees have
 * the same total weight we prefer the shallower one.
 */
class NodeHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(weight, height, node) {
    const items = this.items;
    items.push({ weight, height, node });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._less(items[i], items[parent])) {
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      const n = items.length;
      while (true) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < n && this._less(items[left], items[smallest])) smallest = left;
        if (right < n && this._less(items[right], items[smallest])) smallest = right;
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }

  _less(a, b) {
    if (a.weight !== b.weight) return a.weight < b.weight;
    return a.height < b.height;
  }
}

/**
 * A leaf node carrying one symbol.
 */
function leaf(symbol) {
  return { type: 'leaf', symbol };
}

/**
 * An internal node with two children. `left` is the zero side, `right` is the
 * one side; the assignment follows heap extraction order, which is what makes
 * the resulting code optimal regardless of which side is which.
 */
function branch(left, right) {
  return { type: 'branch', left, right };
}

/**
 * Builds a Huffman tree from a frequency table.
 *
 * @param {Map<*, number>} frequencies - maps symbols to their frequencies.
 *        Frequencies must be non-negative finite numbers.
 * @returns {{tree: object|null, leftIsZero: boolean}} The root of the Huffman
 *          tree plus a flag indicating the child-ordering convention used
 *          during code assignment.
 * @throws {TypeError} if `frequencies` is not a Map.
 * @throws {RangeError} if a frequency is negative, non-finite, or NaN.
 */
export function buildHuffmanCode(frequencies) {
  if (!(frequencies instanceof Map)) {
    throw new TypeError('frequencies must be a Map');
  }

  if (frequencies.size === 0) {
    return { tree: null, leftIsZero: true };
  }

  const heap = new NodeHeap();
  let anyPositive = false;

  for (const [symbol, weight] of frequencies) {
    if (typeof weight !== 'number' || Number.isNaN(weight)) {
      throw new RangeError(`frequency for symbol is not a finite number`);
    }
    if (!Number.isFinite(weight)) {
      throw new RangeError(`frequency for symbol is not finite`);
    }
    if (weight < 0) {
      throw new RangeError(`frequency for symbol is negative`);
    }
    if (weight > 0) anyPositive = true;
    heap.push(weight, 0, leaf(symbol));
  }

  // If every frequency is zero, the symbols all tie at weight 0. Returning a
  // flat chain rather than a balanced tree does not affect optimality (every
  // code is length 1, which is the minimum), and it is simpler than special
  // casing the degenerate all-zero input.
  if (!anyPositive) {
    let node = null;
    for (const [symbol] of frequencies) {
      node = node === null ? leaf(symbol) : branch(node, leaf(symbol));
    }
    return { tree: node, leftIsZero: true };
  }

  // Standard Huffman merge: pull the two lightest nodes, combine, push back.
  // We pop the lighter node first so it becomes the `left` (zero) child.
  const leftIsZero = true;

  while (heap.size > 1) {
    const a = heap.pop();
    const b = heap.pop();
    const combined = a.weight + b.weight;
    const combinedHeight = Math.max(a.height, b.height) + 1;
    heap.push(combined, combinedHeight, branch(a.node, b.node));
  }

  const top = heap.pop();
  // A single-symbol alphabet is a degenerate case: the tree is just a leaf.
  // We promote it to a branch with a single child so the code is non-empty.
  const root = top.node.type === 'leaf' ? branch(top.node, leaf(null)) : top.node;
  return { tree: root, leftIsZero };
}

/**
 * Walks the tree and produces a code table mapping each leaf symbol to its
 * binary string.
 *
 * @param {object} tree - the tree returned by buildHuffmanCode.
 * @param {boolean} leftIsZero - whether the left child encodes bit 0.
 * @returns {Map<*, string>} symbol -> code string of '0' and '1'.
 */
export function buildCodeTable(tree, leftIsZero = true) {
  const table = new Map();
  if (tree === null) return table;

  const zeroChar = leftIsZero ? '0' : '1';
  const oneChar = leftIsZero ? '1' : '0';

  // Iterative DFS with an explicit stack of [node, code]. Avoids recursion so
  // very deep trees (e.g. from a pathologically ordered frequency table) do
  // not risk overflowing the call stack.
  const stack = [{ node: tree, code: '' }];

  while (stack.length > 0) {
    const { node, code } = stack.pop();
    if (node.type === 'leaf') {
      if (node.symbol !== null) {
        table.set(node.symbol, code);
      }
    } else {
      // Push right first so left is processed first (for deterministic table
      // ordering, though order does not affect correctness).
      stack.push({ node: node.right, code: code + oneChar });
      stack.push({ node: node.left, code: code + zeroChar });
    }
  }

  return table;
}
