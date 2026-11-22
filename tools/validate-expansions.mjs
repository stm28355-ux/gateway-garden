// 拡張データ（expansions/<id>/）の書き方を確かめる。誤りがあれば一覧を出して終了コード1で終わる。
// 決まりの中身は src/core/schema.js にある（ゲームの処理と同じものを使う）。
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateExpansion } from '../src/core/schema.js';

export { validateExpansion };

const ROOT = fileURLToPath(new URL('../expansions/', import.meta.url));

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
  // 画面が読む一覧（expansions/index.json）に全部の拡張が載っているか
  try {
    const listed = JSON.parse(await readFile(join(ROOT, 'index.json'), 'utf8'));
    for (const d of dirs) if (!listed.includes(d.name)) errors.push(`index.json に "${d.name}" がない（画面で読めない）`);
    for (const id of listed) if (!dirs.some((d) => d.name === id)) errors.push(`index.json の "${id}" のフォルダがない`);
  } catch (e) {
    errors.push(`index.json が読めない（${e.message}）`);
  }
  if (errors.length) {
    console.error(`拡張データに誤りが ${errors.length} 件あります：\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`拡張 ${dirs.length} 個・札 ${count} 枚、書き方の誤りなし`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
