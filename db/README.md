# データベースの実装

## ファイルの内容

### `mod.ts`

- 他のファイルから読み込まれる
- deno deployで実行している場合は、firebaseを使用する
- ローカル（`deno run`コマンド）で実行している場合は、sqliteを使用する
- sqliteモジュールの読み込みはローカルで実行している場合のみ行いたい→動的importを使用して読み込む

### `realtime_db.ts`

- Firebase Realtime Databaseのデータベース読み込み/書き込みを実装する
- https://qiita.com/access3151fq/items/eed16862893dc004d404 も参照してください。
- サーバー向け(Node.js向け)ライブラリが使えないのでブラウザ向けライブラリを使う
- `// @deno-types="<URL>"`のような記述はただのコメントではなく、型チェックに使われる特殊コメントなので注意

### `sqlite3.ts`

- sqlite3ライブラリを使用して、sqliteのデータベース書き込み/読み込みを実装する
- 作成されたデータベースは`../graph_data/`ディレクトリの中に入っている。

### `types.ts`

- `Database`インターフェースが定義されている
- firebaseやsqliteのデータベース読み書きを実装する時は、`class <クラス名> implements Database`のように書く

### `utils.ts`

- データベース実装で使うその他の関数が入っている。

### `sqlite_dll/sqlite3.dll`

- sqliteライブラリで読み込まれるdllファイルが入っている。
- windowsではこのファイルが無いと動かない
- linuxでは元からパソコンに入っているらしい
- dllがある場所を環境変数`DENO_SQLITE_PATH`に設定する（.envファイルに書く）

### その他のファイル

- `firestore.ts`などは昔使っていたのが残っているだけで、無視してよい。
