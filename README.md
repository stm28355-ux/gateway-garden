# Gateway Garden

3×3 の庭に、別の世界から来た住人を迎えて育てるボードゲーム（2〜4人・30〜60分）。
共通の場から「3個入りの魔素の束」を拾い、住人の札と交換して庭に置き、魔素を乗せて育てる。育った住人は、次からの拾い方そのものを変える。

- 企画の正：Claude Docs「ボードゲーム 企画まとめ（引き継ぎ用）」
- 計画のメモ：[docs/plan.md](docs/plan.md)
- 拡張（住人の札）の足し方：[CONTRIBUTING.md](CONTRIBUTING.md)

## 遊ぶ

https://stm28355-ux.github.io/gateway-garden/ （試作：1人＋CPU）。通信対戦はサーバーなしで、ブラウザ同士を [Trystero](https://github.com/dmotz/trystero) でつなぐ予定（フェーズ5）。部屋の合言葉を共有して入る。

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
