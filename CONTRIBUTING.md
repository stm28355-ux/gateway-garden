# 拡張（住人の札）の足し方

1作＝1拡張。拡張は `expansions/<id>/` のフォルダ1つにまとまる。決まりの中身は [src/core/schema.js](src/core/schema.js) にあり、ゲームの処理と確かめる道具が同じものを使う。

## 手順

1. `main` から新しいブランチを作る（例：`expansion/auto-battler`）。
2. `expansions/<id>/expansion.json` と `expansions/<id>/cards.json` を書く。
3. `npm test` で確かめる（書き方の誤りと、ルールのテスト）。
4. Pull Request を出す。GitHub Actions が同じ確かめを自動で行い、通ったら取り込む。

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
| `growth` | 上がり方：`early`（早熟 1・2）`flat`（平ら 2・2）`late`（晩成 2・4）。育てるのは札と同じ色の素材 |
| `stages` | 段階1〜3の3つ。それぞれ `points`（その段階の点、段階3は1以上）と `effects`（効果の部品の並び） |

## 効果の部品

1つの効果は「いつ（`when`）」「何を（`do`）」「どこの・どの札を（`area`・`filter`）」「どう数える（`per`・`if`）」を組んで書く。

| 項目 | 選べるもの |
| --- | --- |
| `when` | `place` 置いたとき・`activate` 毎ラウンドの発動・`grow` 段階が上がったとき・`pick` 拾うとき（導きの札の段階2から）・`end` 終わりの得点 |
| `do` | `gain`（`color`,`amount`）素材を得る・`convert`（`to`,`amount`）色を変える・`stageUp`（`amount`）段階を上げる・`discount`（`amount`）育てる値段を下げる・`score`（`amount`）点・`limit`（`amount`）上限を広げる・`trigger` 発動させる・`bend`（`kind`）拾い方を曲げる |
| `area` | `self` 自分・`adjacent` 上下左右・`row` 同じ行・`column` 同じ列・`cross` 行と列・`garden` 庭ぜんぶ |
| `filter` | `element`・`role`・`minStage`（1〜3）・`origin`（`same`/`other` 出身）・`empty`（空きマス）・`position`（`center`/`corner`/`edge`） |
| `per` | `{ "area", "filter" }`：当てはまる札1枚につき `amount` 倍 |
| `if` | `{ "area", "filter", "atLeast" }`：当てはまる札が `atLeast` 枚以上なら |
| `at` | この札が `center`/`corner`/`edge` にあるときだけ |
| `kind`（bend） | `add` 足す・`swap` 入れ替える・`adjacent` 隣から取る・`redraw` 続けて引く・`recolor` 色を変える |

`color` は5色のほか `self`（この札の色）と `any`（好きな色）が使える。

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
