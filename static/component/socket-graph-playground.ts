/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />

declare global {
  // deno-lint-ignore no-explicit-any no-var
  var monaco: any;
  // deno-lint-ignore no-explicit-any no-var
  var require: any;
}

globalThis.require = {
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.31.0/min/vs" },
  "vs/nls": { availableLanguages: { "*": "ja" } },
};

await new Promise((resolve) => {
  document.head.append(
    createElement("link", {
      rel: "stylesheet",
      "data-name": "vs/editor/editor.main",
      href:
        "https://cdn.jsdelivr.net/npm/monaco-editor@0.31.0/min/vs/editor/editor.main.css",
    }),
    createElement("script", {
      src: "https://cdn.jsdelivr.net/npm/monaco-editor@0.31.0/min/vs/loader.js",
    }),
    createElement("script", {
      src:
        "https://cdn.jsdelivr.net/npm/monaco-editor@0.31.0/min/vs/editor/editor.main.nls.ja.js",
    }),
    createElement("script", {
      src:
        "https://cdn.jsdelivr.net/npm/monaco-editor@0.31.0/min/vs/editor/editor.main.js",
    }, (e) => e.addEventListener("load", resolve)),
  );
});

// monaco editorのバグでshadow domにできない
class Playground extends HTMLElement {
  static observedAttributes = ["data-token", "data-id"];
  // deno-lint-ignore no-explicit-any
  #editor: any;
  #iframe?: HTMLIFrameElement;
  #attr: {
    token: string | null;
    id: string | null;
  };
  #resizeObserver?: ResizeObserver;
  constructor() {
    super();
    this.#attr = {
      token: null,
      id: null,
    };
    this.#resizeObserver = new ResizeObserver(() => {
      this.#editor?.layout();
    });
  }
  connectedCallback() {
    this.appendChild(
      createElement("link", {
        rel: "stylesheet",
        href: new URL("./socket-graph-playground.css", import.meta.url),
      }),
    );
    this.appendChild(createElement("div", null, (e) => {
      e.classList.add("playground-editor");
      e.style.width = "100%";
      e.style.height = "40vh";
      setTimeout(() => {
        this.#editor = monaco.editor.create(e, {
          value: ['console.log("Hello world!");', ""].join("\n"),
          language: "javascript",
        });
        this.#init();
      }, 500);
    }));
    this.appendChild(createElement("div", null, (e) => {
      e.classList.add("playground-output");
    }, [
      createElement("button", null, (e) => {
        e.classList.add("playground-button");
        e.addEventListener("click", this.#run.bind(this));
      }, ["▶Run"]),
      createElement("button", null, (e) => {
        e.classList.add("playground-button");
        e.addEventListener("click", this.#stop.bind(this));
      }, ["■Stop"]),
      createElement("iframe", { sandbox: "allow-scripts" }, (e) => {
        e.classList.add("playground-iframe");
        this.#iframe = e;
      }),
    ]));
    this.#resizeObserver?.observe(this);
  }
  disconnectedCallback() {
    this.#resizeObserver?.unobserve(this);
  }
  #run() {
    this.#iframe!.src = codeToObjectURL(this.#editor.getValue());
  }
  #stop() {
    this.#iframe!.src = "";
  }
  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === "data-token") {
      this.#attr.token = newValue;
    }
    if (name === "data-id") {
      this.#attr.id = newValue;
    }
    this.#init();
  }
  #init() {
    if (!this.#attr.token || !this.#attr.id) {
      return;
    }
    if (!this.#editor) {
      return;
    }
    const wsURL = new URL(`/ws/send/${this.#attr.id}`, location.href);
    wsURL.protocol = wsURL.protocol === "https:" ? "wss:" : "ws:";
    this.#editor.setValue(
      `const delay = (ms) => new Promise((ok) => setTieout(ok, ms));
const ID = "${this.#attr.id}";
const TOKEN = "${this.#attr.token}";

// 送信はWebSocketで行う
const socket = new WebSocket(\`${wsURL}\`);
socket.addEventListener("close", event=>console.log("接続が閉じられました。", event.reason, event.code))
// WebSocketのコネクションが開かれるまで待つ
await new Promise((ok) => socket.addEventListener("open", ok));

// 最初にトークンを送信
socket.send(TOKEN);

function send() {
	const time = Date.now(); // 現在時刻を取得
	// 送信するデータはtimeプロパティ(現在時刻)と任意のプロパティ(値)のペア
	const data = {
		time,
		sin: Math.sin(time / 5000),
		"-sin": -Math.sin(time / 5000),
		// cos: Math.cos(time / 5000),
		// "-cos": -Math.cos(time / 5000),
	};
	console.log(JSON.stringify(data));

	// WebSocketを通してJSONデータを送信
	socket.send(JSON.stringify(data));
}
setInterval(send, 1000); // 1秒に1回送信する
`,
    );
    this.#run();
  }
}
customElements.define("socket-graph-playground", Playground);

function codeToObjectURL(code: string) {
  return URL.createObjectURL(
    new Blob(
      [
        `<!DOCTYPE html>
      <html>
        <head>
          <style>
            .info {color: blue;}
            .error {color: red;}
            .info::before,
            .error::before{content: "> "}
          </style>
        </head>
        <body>
          <script>
            const originalConsoleLog = console.log
            function output(type, ...args) {
              originalConsoleLog(args)
              const div = document.createElement("div")
              div.classList.add(type)
              div.innerText = args.join(" ")
              document.body.appendChild(div)
            }
            window.addEventListener("error", (e)=>{
              originalConsoleLog(e)
              output("error", "[" + event.type + "] " + event.message)
            })
            window.addEventListener("unhandledrejection", (e)=>{
              originalConsoleLog(e)
              output("error", "[" + event.type + "] " + event.reason)
            })
            console.assert = (assert, ...msgs)=>assert||output(
              "error",
              "assertion error: "+ msgs.join(" "),
            )
            console.debug = (...args)=>output("info", args)
            console.log = (...args)=>output("info", args)
            console.info = (...args)=>output("info", args)
            console.error = (...args)=>output("error", args)
            console.warn = (...args)=>output("error", args)
          </script>
          <script type="module">
            import("data:text/javascript,${encodeURIComponent(code)}");
          </script>
        </body>
      </html>`,
      ],
      { type: "text/html" },
    ),
  );
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attr?: Record<string, { toString: () => string }> | null,
  cb?: ((e: HTMLElementTagNameMap[K]) => void) | null,
  children?: (string | Node)[],
) {
  const element = document.createElement(tagName);
  for (const [k, v] of Object.entries(attr ?? {})) {
    element.setAttribute(k, v.toString());
  }
  for (const child of children ?? []) {
    element.append(child);
  }
  if (cb) {
    cb(element);
  }
  return element;
}
export {};
