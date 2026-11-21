// 拡張データ（expansions/<id>/）の書き方を確かめる。誤りがあれば一覧を出して終了コード1で終わる。
// 効果の部品はフェーズ1で決めるので、いまは札の基本の項目だけを見る。
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ELEMENTS = ['white', 'red', 'blue', 'green', 'yellow'];
const ROOT = fileURLToPath(new URL('../expansions/', import.meta.url));

export function validateExpansion(dirName, meta, cards) {
  const errors = [];
  const err = (msg) => errors.push(`${dirName}: ${msg}`);
  if (meta.id !== dirName) err(`expansion.json の id "${meta.id}" がフォルダ名と違う`);
  if (typeof meta.name !== 'string' || !meta.name) err('expansion.json に name がない');
  if (!/^\d+\.\d+\.\d+$/.test(meta.version ?? '')) err('expansion.json の version は 1.2.3 の形にする');
  if (!Array.isArray(cards)) { err('cards.json は配列にする'); return errors; }
  const seen = new Set();
  cards.forEach((c, i) => {
    const at = `札${i + 1}（${c?.id ?? 'id なし'}）`;
    if (!c.id?.startsWith(`${dirName}-`)) err(`${at}: id は "${dirName}-" で始める`);
    if (seen.has(c.id)) err(`${at}: id が重なっている`);
    seen.add(c.id);
    if (!c.name) err(`${at}: name がない`);
    if (!ELEMENTS.includes(c.element)) err(`${at}: element は ${ELEMENTS.join('・')} のどれか`);
    for (const [k, v] of Object.entries(c.cost ?? {})) {
      if (!ELEMENTS.includes(k) || !Number.isInteger(v) || v < 0) err(`${at}: cost の ${k} が正しくない`);
    }
    if (!Array.isArray(c.stages) || c.stages.length !== 3) err(`${at}: stages は段階1〜3の3つにする`);
  });
  return errors;
}

async function main() {
  const dirs = (await readdir(ROOT, { withFileTypes: true })).filter((d) => d.isDirectory());
  const errors = [];
  let count = 0;
  for (const d of dirs) {
    try {
      const meta = JSON.parse(await readFile(join(ROOT, d.name, 'expansion.json'), 'utf8'));
      const cards = JSON.parse(await readFile(join(ROOT, d.name, 'cards.json'), 'utf8'));
      errors.push(...validateExpansion(d.name, meta, cards));
      count += cards.length;
    } catch (e) {
      errors.push(`${d.name}: 読めない（${e.message}）`);
    }
  }
  if (errors.length) {
    console.error(`拡張データに誤りが ${errors.length} 件あります：\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`拡張 ${dirs.length} 個・札 ${count} 枚、書き方の誤りなし`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
