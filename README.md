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

## 各ファイルについて

### .gitignore

- ディレクトリ全体をgitで管理しているのだが、その対象から外したいファイルを指定する
- 例えば`.env`ファイルは個人情報やパスワードが書いてあるので、githubで公開されるのは困る。そのため、gitignoreしておく。

### .env

- 「環境変数」を設定するファイル
- ここで設定した環境変数は、プログラム上からのみ使うことができる。
- 例えば、`.env`ファイルの中に`PASSWORD="ひみつ"`と書いておくと、プログラム上で`const pass = Deno.env.get("PASSWORD")`で`ひみつ`という値が取得できる
- 知られたくない情報は全てここに書く（firebaseのアクセストークンなど）
- 主な環境変数
  - `FIREBASE_CONFIG`: `./database/mod.ts`の中で使われる。firebaseのconfigについては
    https://firebase.google.com/docs/web/learn-more?hl=ja#config-object を参照。
  - `DENO_SQLITE_PATH`:
    sqliteのdllファイルへのパス（例えば`C:/Users/azusa/socket-graph/db/sqlite_dll/sqlite3.dll`）を指定する。

※環境変数を使う際は

1. `.env`ファイル（ローカル開発で使う）
2. deno deployの環境変数（deno deployにログインして設定）
3. GitHub Actionsの環境変数（GitHubにログインして設定→secret→Actionsで追加）

の3種を必要に応じて設定・追加する。必要に応じて`.github/workflow/ci.yml`の中にあるテストコマンドも変更する

### LICENSE

- ライセンスが書いてある。MITライセンスです。

### `○○_test.ts`

- テスト用のファイル
- `deno test <ファイル名>`コマンドでテストを実行できる。全てのテストに合格することが期待される。

## 開発方法

### サーバー立ち上げ

以下のコマンドをターミナルで打つ

```
deno run --allow-net -
-allow-read=. --allow-env --allow-ffi --unstable --watch ./serve
.ts
```

（または`deno task serve`コマンドを打つ）

その後、http://localhost:8000/ などにブラウザでアクセスする

## その他

### deno deployについて

- このサーバーは https://socket-graph.deno.dev というドメインから世界に公開されている
- deno deployというサービスを使っている
- GitHubにpushすると、自動でその変更が反映・公開されるようになっている
  - GitHubについては各自で調べてください
- deno deployにログインすると環境変数の設定やログの閲覧が行える。

### JSDocについて

コード中に`/**(コメント)*/`という形式のコメントが現れる。これはドキュメントコメントと呼ばれ、エディタや https://doc.deno.land
でドキュメントを表示させることができるものである。

※GitHubのファイルのページに行き、rawボタンを押してrawファイルを開く。そのURLをコピーして https://doc.deno.land
に入力するとドキュメントが表示される。
