# 開発時に使用するファイル

速度計測のためのコードや、デバイス側のコードなどが入っているフォルダ。

## デバイス側に使うコード

### `client.ts`

sin波を送信するコード。動作確認に使う。

### `dummy_meter.ts`

水道メーターのダミーデータを送信するコード

## 測定用コード

### `remote_client_bench.ts` `client_receive.ts`

deno deployで動かしている本番サーバーのリアルタイム通信の速度比較

送信してから受信するまで何ミリ秒かかったかを計測する

### `realtime_db.ts` `realtime_db_client.ts`

firebase realtime databaseのリアルタイム通信を使うと送信から受信まで何ミリ秒かかるか計測する

### `swc_bench.ts`

wasm版swcの実行速度を計測する（tscと比較）

## 開発用・その他

### `gen_link_tag.ts`

HTMLで使うpreloadキーワード入りのlinkタグを生成する。生成したコードは手動でHTMLに差し込む。

### `typecheck.ts`

型チェックをテストする。GitHub Actionsで使用
