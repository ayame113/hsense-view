# socket-graph

リアルタイム通信を利用してブラウザでグラフを表示します。

```
measuring equipment --(WebSocket)--> deno deploy server --(BroadcastChannel)--> deno deploy server --(Server-Sent-Events)--> browser
```

https://socket-graph.deno.dev

⚠️実験的なプロジェクトです。使用しないでください。
