// 3×3 の庭のマス。番号は左上から 0 1 2 / 3 4 5 / 6 7 8。
export const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // 行
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // 列
];

const rowOf = (i) => Math.floor(i / 3);
const colOf = (i) => i % 3;

export function position(i) {
  if (i === 4) return 'center';
  return [0, 2, 6, 8].includes(i) ? 'corner' : 'edge';
}

export function adjacent(i) {
  return CELLS.filter((j) => Math.abs(rowOf(i) - rowOf(j)) + Math.abs(colOf(i) - colOf(j)) === 1);
}

// 範囲の中のマス。self と garden は自分を含み、ほかは自分を含まない。
export function areaCells(area, i) {
  switch (area) {
    case 'self': return [i];
    case 'adjacent': return adjacent(i);
    case 'row': return CELLS.filter((j) => j !== i && rowOf(j) === rowOf(i));
    case 'column': return CELLS.filter((j) => j !== i && colOf(j) === colOf(i));
    case 'cross': return CELLS.filter((j) => j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i)));
    case 'diagonal': return CELLS.filter((j) => Math.abs(rowOf(j) - rowOf(i)) === 1 && Math.abs(colOf(j) - colOf(i)) === 1); // 斜めの4マス（拡張 Arc-en-ciel Creator）
    case 'garden': return CELLS;
    default: throw new Error(`知らない範囲 ${area}`);
  }
}
