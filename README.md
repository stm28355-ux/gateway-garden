# Gateway Garden

3×3 の庭に、別の世界から来た住人を迎えて育てるボードゲーム（2〜4人・30〜60分）。
共通の場から「3個入りの魔素の束」を拾い、住人の札と交換して庭に置き、魔素を乗せて育てる。育った住人は、次からの拾い方そのものを変える。

- 企画の正：Claude Docs「ボードゲーム 企画まとめ（引き継ぎ用）」
- 計画のメモ：[docs/plan.md](docs/plan.md)
- 拡張（住人の札）の足し方：[CONTRIBUTING.md](CONTRIBUTING.md)

## 遊ぶ

https://stm28355-ux.github.io/gateway-garden/

- **1人で遊ぶ**：あなた＋CPU（2〜4人）。
- **通信対戦**：1人が「部屋を作る」で合言葉を決め、ほかの人は「部屋に入る」で同じ合言葉を入れる。人が足りない席は CPU。サーバーなしで、ブラウザ同士を [Trystero](https://github.com/dmotz/trystero) でつなぐ。つながりにくいときは URL の後ろに `?net=torrent`（または `?net=mqtt`）を付けて、全員同じにする。
- 途中で抜けた人の席は CPU が代わりに遊ぶ。同じブラウザで同じ合言葉に入り直すと戻れる。

## 開発

```
npm test          # ルールのテストと拡張データの確認
npm run validate  # 拡張データの書き方だけ確認
```

ビルドはない。静的な HTML と JavaScript（ES モジュール）だけで動く。手元で開くときは `node tools/serve.mjs 5192` で http://localhost:5192/ 。

```
node tools/simulate.mjs 300 2,3,4 8   # CPU どうしの自動対戦
node tools/replay.mjs 記録.json        # 画面の「記録をコピー」から同じゲームを再現
```
