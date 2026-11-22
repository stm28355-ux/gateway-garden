# 拡張（住人の札）の足し方

1作＝1拡張。拡張は `expansions/<id>/` のフォルダ1つにまとまる。決まりの中身は [src/core/schema.js](src/core/schema.js) にあり、ゲームの処理と確かめる道具が同じものを使う。

## 手順

1. `main` から新しいブランチを作る（例：`expansion/auto-battler`）。
2. `expansions/<id>/expansion.json` と `expansions/<id>/cards.json` を書き、`expansions/index.json` に id を足す。
3. 確かめる：
   - `npm test`：書き方の誤りと、ルールのテスト。
   - `node tools/serve.mjs 5192` で http://localhost:5192/cards.html を開き、札の説明文が思ったとおりか見る（説明文は効果の部品から自動で作られる）。
   - `node tools/simulate.mjs 200 2,3,4 8 --exp <id>`：CPU どうしの自動対戦。最後の表の「勝ちへの効き」が、新しい札だけ大きく外れていないか（目安 0.7〜1.4）を見る。
4. Pull Request を出す。GitHub Actions が同じ確かめを自動で行い、通ったら取り込む。取り込むと GitHub Pages に出る。

## expansion.json

```json
{ "id": "auto-battler", "name": "号令の戦場", "version": "0.1.0", "authors": ["名前"] }
```

- `id` はフォルダ名と同じ。札を変えたら `version` を上げる（通信対戦で版をそろえるため）。

## cards.json（札の項目）

| 項目 | 中身 |
| --- | --- |
| `id` | `<拡張id>-<番号>`。一度出したら変えない |
| `name` | 住人の名前 |
| `element` | 属性：`white` `red` `blue` `green` `yellow` |
| `role` | 役目：`generate`（生成）`guide`（導き）`boost`（強化）`convert`（変換）`score`（得点）`chain`（連鎖） |
| `cost` | 取る値段。`{ "red": 2, "any": 1 }` のように色ごと。合計1〜4 |
| `growth` | 上がり方：`early`（早熟 1・3）`flat`（平ら 2・3）`late`（晩成 3・4）。育てるのは札と同じ色の素材 |
| `stages` | 段階1〜3の3つ。それぞれ `points`（その段階の点、段階3は1以上）と `effects`（効果の部品の並び） |

## 効果の部品

1つの効果は「いつ（`when`）」「何を（`do`）」「どこの・どの札を（`area`・`filter`）」「どう数える（`per`・`if`）」を組んで書く。

| 項目 | 選べるもの |
| --- | --- |
| `when` | `place` 置いたとき・`activate` 毎ラウンドの発動・`grow` その段階になったとき（段階2・3だけ）・`pick` 拾うとき（導きの札の段階2から）・`end` 終わりの得点・`always` 置いてある間ずっと・`use` 反応フェーズの育てる所で好きなときに1ラウンド1回 |
| `do` | `gain`（`color`,`amount`）素材を得る・`convert`（`to`,`amount`）色を変える・`stageUp`（`amount`）範囲から1枚選んで段階を上げる・`discount`（`amount`）育てる値段を下げる（`always` だけ）・`score`（`amount`）点・`hoard`（`every`,`amount`）終わりに残った素材 `every` 個につき `amount` 点（`end` だけ）・`limit`（`amount`）上限を広げる（`always` だけ）・`trigger` 範囲の当てはまる札を全部発動させる・`move` 範囲の札1枚を庭の別のマスへ動かす・`bend`（`kind`）拾い方を曲げる |
| `area` | `self` 自分・`adjacent` 上下左右・`row` 同じ行・`column` 同じ列・`cross` 行と列・`garden` 庭ぜんぶ |
| `filter` | `element`・`role`・`minStage`（1〜3）・`origin`（`same`/`other` 出身）・`empty`（空きマス）・`position`（`center`/`corner`/`edge`） |
| `per` | `{ "area", "filter" }`：当てはまる札1枚につき `amount` 倍 |
| `if` | `{ "area", "filter", "atLeast" }`：当てはまる札が `atLeast` 枚以上なら |
| `at` | この札が `center`/`corner`/`edge` にあるときだけ |
| `kind`（bend） | `add` 足す・`swap` 入れ替える・`adjacent` 隣から取る・`redraw` 続けて引く・`recolor` 色を変える |

`color` は5色のほか `self`（この札の色）と `any`（好きな色）が使える。

### 効果の読み方（フェーズ2で決定）

1. 効くのは今の段階の効果だけ。段階が上がると、前の段階の効果は入れ替わる。
2. `grow` は、その段階に上がった瞬間に1回だけ動く。
3. 値段を下げる・上限を広げるは `always`（置いてある間ずっと）。
4. 育てる値段は0個まで下がる（0より下にはならない）。
5. `stageUp` は範囲から1枚選ぶ。`trigger` は範囲の当てはまる札を全部動かす。
6. 連鎖の中で同じ札は1回だけ発動する。`stageUp` で上がった札の `grow` も動く。
7. 毎ラウンドの発動は左上から右下へ順に。
8. `use` は反応フェーズの育てる所で、育てる操作と好きな順に混ぜて使える。`move` で動かしても `place` は動かない。
9. 反応フェーズで得た魔素は、その場で育てるのに使える（`activate` はラウンドを終えたときなので、実際には次のラウンドから）。

例：段階3で、隣の赤い札1枚につき赤を1つ得る。

```json
{ "points": 2, "effects": [
  { "when": "activate", "do": "gain", "color": "red", "amount": 1,
    "per": { "area": "adjacent", "filter": { "element": "red" } } }
] }
```

## 守ること

- 新しい部品が要るときは、先に Issue で相談する（ゲームの処理と CPU と確認の道具を一緒に直すため）。
- 数字（量・点数）は調整で変わることがある。
- 札を変えたら `expansion.json` の `version` を上げる。通信対戦では、ホストと札の版が違う人は入れない。
- 拡張の色の個性は、その拡張が決めてよい（基本セットの色の個性に合わせなくてよい）。
- 「違う出身の札」を見る効果（`origin: "other"`）は、拡張を混ぜる理由になる。拡張ごとに1〜2枚あるとよい。
