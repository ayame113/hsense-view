/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />

class ViewGraphForm extends HTMLElement {
  #shadow: ShadowRoot;
  #inputElement?: HTMLInputElement;
  #errorOutput?: HTMLDivElement;
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "closed" });
  }
  connectedCallback() {
    this.#shadow.innerHTML = `
			<link rel="stylesheet" href="/component/socket-graph-form.css">
			<h3>グラフ表示</h3>
			登録されたIDを入力して表示ボタンを押すと、グラフが表示されます。<br>
			ID：`;
    this.#shadow.append(
      createElement("input", { type: "text" }, (e) => {
        this.#inputElement = e;
      }),
      createElement("button", { type: "button" }, (element) => {
        element.addEventListener("click", () => {
          const id = this.#inputElement?.value;
          this.goToGraphPage(id);
        });
      }, ["表示"]),
      createElement("div", null, (e) => {
        this.#errorOutput = e;
        e.classList.add("error");
      }),
    );
  }
  goToGraphPage(id: string | undefined) {
    if (!id) {
      this.#errorOutput!.innerText = "idが空です。";
      return;
    }
    this.#errorOutput!.innerText = "";
    const url = new URL("/graph.html", location.href);
    url.searchParams.set("id", id);
    location.href = url.toString();
  }
}
customElements.define("socket-graph-form-view-graph", ViewGraphForm);

class TokenForm extends HTMLElement {
  #shadow: ShadowRoot;
  #inputElement?: HTMLInputElement;
  #tokenOutput?: HTMLTextAreaElement;
  #errorOutput?: HTMLDivElement;
  #copyButton?: HTMLButtonElement;
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "closed" });
  }
  connectedCallback() {
    this.#shadow.innerHTML = `
			<link rel="stylesheet" href="/component/socket-graph-form.css">
			<h3>アクセストークン取得</h3>
			グラフデータ送信にはアクセストークンが必要です。登録したいIDを入力して登録ボタンを押すことで、アクセストークンを取得できます。
			<ul>
				<li>IDを知っている人は誰でもグラフを表示できます。</li>
				<li>アクセストークンを知っている人だけがグラフデータを送信できます。アクセストークンは公開しないでください。</li>
				<li>アクセストークンを取得できるのは最初の1度だけです。アクセストークン生成後にこのページを離れると、再度トークンを表示することはできません。</li>
				<li>グラフ表示ができるのは1週間分です。1週間を過ぎたデータは削除されます。</li>
			</ul>
			ID：`;
    this.#shadow.append(
      createElement("input", { type: "text" }, (e) => {
        this.#inputElement = e;
      }),
      createElement("button", { type: "button" }, (e) => {
        e.addEventListener("click", () => {
          this.createToken(this.#inputElement?.value);
        });
      }, ["登録"]),
      createElement("div", null, (e) => {
        e.classList.add("error");
        this.#errorOutput = e;
      }),
      createElement("textarea", { readonly: "true" }, (e) => {
        this.#tokenOutput = e;
      }),
      createElement("button", { type: "button", disabled: true }, (e) => {
        this.#copyButton = e;
        e.addEventListener("click", () => {
          if (!this.#tokenOutput?.value) {
            return;
          }
          this.#tokenOutput?.select();
          navigator.clipboard.writeText(this.#tokenOutput.value).then(() => {
            e.innerHTML = "コピー✅";
          }, () => {
            e.innerHTML = "コピー✖";
          });
        });
      }, ["コピー"]),
    );
  }
  async createToken(id: string | undefined) {
    console.log(id);

    if (!id) {
      this.#tokenOutput!.value = "";
      this.#errorOutput!.innerText = "idが空です。";
      this.#copyButton!.disabled = true;
      return;
    }
    try {
      const url = new URL(`/api/create_token/${id}`, import.meta.url);
      console.log(url);
      const res = await fetch(url);
      const { success, token }: { success: boolean; token: string } = await res
        .json();
      console.log({ success, token });
      if (success) {
        this.#tokenOutput!.value = token;
        this.#tokenOutput?.select();
        this.#errorOutput!.innerText = "";
        this.#copyButton!.disabled = false;
      } else {
        this.#tokenOutput!.value = "";
        this.#errorOutput!.innerText = "アクセストークンの取得に失敗しました。idが既に使用済みの可能性があります。";
        this.#copyButton!.disabled = true;
      }
    } catch (error) {
      console.error(error);
      this.#errorOutput!.innerText = "アクセストークンを取得できませんでした。";
    }
  }
}
customElements.define("socket-graph-form-token", TokenForm);

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
