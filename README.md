# socket-graph

リアルタイム通信を利用してブラウザでグラフを表示します。

```
measuring equipment --(WebSocket)--> deno deploy server --(BroadcastChannel)--> deno deploy server --(Server-Sent-Events)--> browser
```

https://socket-graph.deno.dev

⚠️実験的なプロジェクトです。使用しないでください。

---

### ディレクトリ構成

- [./db/](./db/): データベース接続用のコード
- [./listeners/](./listeners/): サーバーの実装
- [./static/](./static/): ブラウザで使用する静的ファイルや、ブラウザとサーバーで共通のコード
- [./testdata](./testdata/): テストに使うファイル
- [./dev/](./dev/): スピード計測や送信テストなどに用いたコード
- [./github/](./github/): GitHub Actionsの設定など
- [./allow_cors.json](./allow_cors.json):
  他サイトから読み込めるようにCORSヘッダーを付けるページのリスト（serve.tsによって制御）
- [./serve.ts](serve.ts): サーバーのエントリポイント
- [./serve_test](./serve_test.ts): サーバーのテスト
