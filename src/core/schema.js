// 札データの決まり（フェーズ1の D8〜D12 で決めた形）。ブラウザとNodeの両方で使う。
// 効果の数字（量・点数）は調整で変えてよい。部品の種類を増やすときは、ゲームの処理・CPU・この確認を同時に直す。

export const ELEMENTS = ['white', 'red', 'blue', 'green', 'yellow'];
export const ROLES = ['generate', 'guide', 'boost', 'convert', 'score', 'chain']; // 生成・導き・強化・変換・得点・連鎖

// 育てる値段（段階1→2、段階2→3）。乗せるのは札と同じ色の素材。
// フェーズ3の自動対戦で上げた（B案）。前は早熟1・2、平ら2・2、晩成2・4で、庭の約7枚のうち約6枚が段階3まで育った。
export const GROWTH = { early: [1, 3], flat: [2, 3], late: [3, 4] }; // 早熟・平ら・晩成

// いつ（フェーズ2で always と use を足した）
// place 置いたとき・activate 毎ラウンドの発動・grow その段階になったとき・pick 拾うとき・end 終わりの得点
// always 置いてある間ずっと・use 反応フェーズの育てる所で、好きなときに1ラウンド1回使える
export const WHEN = ['place', 'activate', 'grow', 'pick', 'end', 'always', 'use'];
// 常に効く部品（値段を下げる・上限を広げる）は always だけで書く
const ALWAYS_ONLY = ['discount', 'limit'];

// 範囲（どこ）。向きは入れない（D11）。
export const AREAS = ['self', 'adjacent', 'row', 'column', 'cross', 'garden']; // 自分・上下左右・同じ行・同じ列・行と列・庭ぜんぶ
export const POSITIONS = ['center', 'corner', 'edge']; // 中央・角・辺

// 拾い方の曲げ方（D12）。基本セットは add と swap。
export const BENDS = ['add', 'swap', 'adjacent', 'redraw', 'recolor']; // 足す・入れ替える・隣から取る・続けて引く・色を変える

// 何を。値は「その部品が持つ項目」。
export const ACTIONS = {
  gain: ['color', 'amount'],        // 素材を得る。color は 5色・'self'（札の色）・'any'（好きな色）
  convert: ['to', 'amount'],        // 手持ちの素材を to の色に、amount 個まで変える
  stageUp: ['amount'],              // 範囲から1枚選んで段階を上げる（素材を払わない）
  discount: ['amount'],             // 範囲の札の育てる値段を下げる（常に。最低1個）
  move: [],                         // 範囲の札1枚を、自分の庭の別のマスへ動かす（空きなら移動、札があれば入れ替え。段階はそのまま）
  score: ['amount'],                // 点を得る
  hoard: ['every', 'amount'],       // 終わりに残った素材 every 個につき amount 点（when: 'end' だけ。フェーズ3で黄の「上限+」から替えた）
  limit: ['amount'],                // 持てる素材の上限を広げる
  trigger: [],                      // 範囲の札を発動させる（連鎖）
  bend: ['kind'],                   // 拾い方を曲げる（when: 'pick' だけ）
};

// 各部品に付けられる共通の項目
const COMMON = ['when', 'do', 'area', 'filter', 'per', 'if', 'at'];
const FILTER_KEYS = ['element', 'role', 'minStage', 'origin', 'empty', 'position'];

function checkFilter(f, where, err) {
  if (f == null) return;
  if (typeof f !== 'object') return err(`${where} は {…} で書く`);
  for (const k of Object.keys(f)) if (!FILTER_KEYS.includes(k)) err(`${where} に知らない項目 "${k}"`);
  if (f.element !== undefined && !ELEMENTS.includes(f.element) && f.element !== 'self') err(`${where}.element が正しくない`);
  if (f.role !== undefined && !ROLES.includes(f.role)) err(`${where}.role が正しくない`);
  if (f.minStage !== undefined && ![1, 2, 3].includes(f.minStage)) err(`${where}.minStage は 1〜3`);
  if (f.origin !== undefined && !['same', 'other'].includes(f.origin)) err(`${where}.origin は same か other`);
  if (f.position !== undefined && !POSITIONS.includes(f.position)) err(`${where}.position が正しくない`);
}

function checkCount(c, where, err, needAtLeast) {
  if (c == null) return;
  if (!AREAS.includes(c.area)) err(`${where}.area が正しくない`);
  checkFilter(c.filter, `${where}.filter`, err);
  if (needAtLeast && !(Number.isInteger(c.atLeast) && c.atLeast >= 1)) err(`${where}.atLeast は1以上の整数`);
}

export function validateEffect(e, where, ctx, err) {
  if (!WHEN.includes(e.when)) return err(`${where}: when は ${WHEN.join('・')} のどれか`);
  const fields = ACTIONS[e.do];
  if (!fields) return err(`${where}: do は ${Object.keys(ACTIONS).join('・')} のどれか`);
  for (const k of Object.keys(e)) if (!COMMON.includes(k) && !fields.includes(k)) err(`${where}: 知らない項目 "${k}"`);
  if (fields.includes('amount') && !(Number.isInteger(e.amount) && e.amount >= 1)) {
    err(`${where}: amount は1以上の整数`);
  }
  if (e.do === 'gain' && !(ELEMENTS.includes(e.color) || e.color === 'self' || e.color === 'any')) err(`${where}: gain の color が正しくない`);
  if (e.do === 'convert' && !(ELEMENTS.includes(e.to) || e.to === 'any')) err(`${where}: convert の to が正しくない`);
  if (e.do === 'bend') {
    if (!BENDS.includes(e.kind)) err(`${where}: bend の kind は ${BENDS.join('・')} のどれか`);
    if (e.when !== 'pick') err(`${where}: bend は when: "pick" で書く`);
  }
  if (e.when === 'pick') {
    if (ctx.role !== 'guide') err(`${where}: 拾うときの効果は役目「導き」の札だけ（D12）`);
    if (ctx.stage < 2) err(`${where}: 拾い方を曲げるのは段階2から（D12）`);
  }
  if (ALWAYS_ONLY.includes(e.do) && e.when !== 'always') err(`${where}: ${e.do} は when: "always" で書く`);
  if (e.do === 'hoard') {
    if (e.when !== 'end') err(`${where}: hoard は when: "end" で書く`);
    if (!(Number.isInteger(e.every) && e.every >= 1)) err(`${where}: hoard の every は1以上の整数`);
  }
  if (e.when === 'grow' && ctx.stage === 1) err(`${where}: 段階1の「その段階になったとき」は起きない`);
  if (e.area !== undefined && !AREAS.includes(e.area)) err(`${where}: area が正しくない`);
  if (['stageUp', 'discount', 'trigger', 'move'].includes(e.do) && e.area === undefined) err(`${where}: ${e.do} には area が要る`);
  checkFilter(e.filter, `${where}.filter`, err);
  checkCount(e.per, `${where}.per`, err, false);
  checkCount(e.if, `${where}.if`, err, true);
  if (e.at !== undefined && !POSITIONS.includes(e.at)) err(`${where}: at は ${POSITIONS.join('・')} のどれか`);
}

export function validateCard(c, prefix, err) {
  const at = `札「${c?.id ?? 'id なし'}」`;
  if (!c?.id?.startsWith(`${prefix}-`)) err(`${at}: id は "${prefix}-" で始める`);
  if (!c.name) err(`${at}: name がない`);
  if (!ELEMENTS.includes(c.element)) err(`${at}: element は ${ELEMENTS.join('・')} のどれか`);
  if (!ROLES.includes(c.role)) err(`${at}: role は ${ROLES.join('・')} のどれか`);
  if (!GROWTH[c.growth]) err(`${at}: growth は ${Object.keys(GROWTH).join('・')} のどれか`);
  const cost = Object.entries(c.cost ?? {});
  let total = 0;
  for (const [k, v] of cost) {
    if (!ELEMENTS.includes(k) && k !== 'any') err(`${at}: cost の色 "${k}" が正しくない`);
    if (!Number.isInteger(v) || v < 1) err(`${at}: cost の数は1以上の整数`);
    total += v;
  }
  if (total < 1 || total > 4) err(`${at}: 値段の合計は1〜4（D8）。いまは ${total}`);
  if (!Array.isArray(c.stages) || c.stages.length !== 3) return err(`${at}: stages は段階1〜3の3つにする`);
  c.stages.forEach((s, i) => {
    const where = `${at} 段階${i + 1}`;
    if (!(Number.isInteger(s.points ?? 0) && (s.points ?? 0) >= 0)) err(`${where}: points は0以上の整数`);
    if (!Array.isArray(s.effects)) return err(`${where}: effects は配列にする`);
    s.effects.forEach((e, j) => validateEffect(e, `${where} 効果${j + 1}`, { role: c.role, stage: i + 1 }, err));
  });
  if (!((c.stages[2].points ?? 0) >= 1)) err(`${at}: 段階3は1点以上にする（D9：どの札も段階3で少し点を持つ）`);
}

export function validateExpansion(dirName, meta, cards) {
  const errors = [];
  const err = (msg) => errors.push(`${dirName}: ${msg}`);
  if (meta.id !== dirName) err(`expansion.json の id "${meta.id}" がフォルダ名と違う`);
  if (typeof meta.name !== 'string' || !meta.name) err('expansion.json に name がない');
  if (meta.short !== undefined && (typeof meta.short !== 'string' || !meta.short || [...meta.short].length > 3)) err('expansion.json の short（カードの上に出す世界の略）は3文字まで');
  if (!/^\d+\.\d+\.\d+$/.test(meta.version ?? '')) err('expansion.json の version は 1.2.3 の形にする');
  if (!Array.isArray(cards)) { err('cards.json は配列にする'); return errors; }
  const seen = new Set();
  for (const c of cards) {
    if (seen.has(c?.id)) err(`札「${c.id}」: id が重なっている`);
    seen.add(c?.id);
    validateCard(c, dirName, err);
  }
  return errors;
}
