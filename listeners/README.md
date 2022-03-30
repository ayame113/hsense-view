# サーバーリスナーの実装

- サーバーの本体の処理（リクエストが来たらレスポンスを返す）を書く

### `router.ts`

- ルーターを作成する（`const router = {...}`）
- WebSocket用の特殊なルーターも作成（`const socketRouter = {...}`）

### `mod.ts`

- リスナー実装のコードを全てimportする
- listenersディレクトリにファイルを作っただけでは読み込まれず、ここでimportしないと読み込まれないので注意
