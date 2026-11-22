// 魔素の形（工程7の判定 R6：M1 宝石の切り方）。白＝丸・赤＝三角・青＝菱形・緑＝六角・黄＝四角、好きな色＝虹。
// 形はものを表さない（「赤＝炎」にすると赤い住人とずれるため）。色が見分けにくい人も形で分かる。
const FILL = { white: '#efe9d6', red: '#e3604f', blue: '#4f8fe0', green: '#4ea860', yellow: '#e8bf35' };
const EDGE = { white: '#9e9476', red: '#9c3429', blue: '#25579e', green: '#246b33', yellow: '#9c7612' };
const SHAPE = {
  white: '<circle cx="12" cy="12" r="9"/>',
  red: '<path d="M12 3 L21 19 L3 19 Z"/>',
  blue: '<path d="M12 2 L21 12 L12 22 L3 12 Z"/>',
  green: '<path d="M7 3.5 L17 3.5 L22 12 L17 20.5 L7 20.5 L2 12 Z"/>',
  yellow: '<rect x="4" y="4" width="16" height="16" rx="1.5"/>',
};
let rainbowId = 0;

export function gemSvg(color, size = 20) {
  if (color === 'any') return anySvg(size);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-label="${color}"><g fill="${FILL[color]}" stroke="${EDGE[color]}" stroke-width="2" stroke-linejoin="round">${SHAPE[color]}</g><path d="M8 8 l3 -2" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

export function anySvg(size = 20) {
  const id = `rb${++rainbowId}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-label="好きな色"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3604f"/><stop offset=".33" stop-color="#e8bf35"/><stop offset=".66" stop-color="#4ea860"/><stop offset="1" stop-color="#4f8fe0"/></linearGradient></defs><circle cx="12" cy="12" r="9" fill="url(#${id})" stroke="#fff" stroke-width="2"/></svg>`;
}
