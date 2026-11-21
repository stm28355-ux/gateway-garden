# 拡張（住人の札）の足し方

1作＝1拡張。拡張は `expansions/<id>/` のフォルダ1つにまとまる。

## 手順

1. `main` から新しいブランチを作る（例：`expansion/auto-battler`）。
2. `expansions/<id>/expansion.json` と `expansions/<id>/cards.json` を書く。
3. `npm test` で確かめる（書き方の誤りと、ルールのテスト）。
4. Pull Request を出す。GitHub Actions が同じ確かめを自動で行い、通ったら取り込む。

## ファイルの形（仮）

効果の部品と札の項目は、フェーズ1・2で決めてからここに書く。いまは仮の形。

`expansion.json`

```json
{ "id": "base", "name": "基本セット", "version": "0.1.0", "authors": ["名前"] }
```

`cards.json`

```json
[
  { "id": "base-001", "name": "住人の名前", "element": "red", "role": "generate",
    "cost": { "red": 2 }, "growth": "early",
    "stages": [ { "effects": [] }, { "effects": [] }, { "effects": [] } ] }
]
```

## 守ること

- 効果は決まった部品の組み合わせで書く（新しい部品が要るときは、先に Issue で相談する）。
- 札の `id` は `<拡張id>-<番号>` にする。出した札の `id` は変えない。
- 札を変えたら、`expansion.json` の `version` を上げる（通信対戦で版をそろえるため）。
