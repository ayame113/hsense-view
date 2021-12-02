/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="esnext" />

function escapeHTML(str: string): string {
  return str
    .replaceAll("<", "&lt")
    .replaceAll(">", "&gt")
    .replaceAll("&", "&amp")
    .replaceAll('"', "&quot")
    .replaceAll("'", "&#39");
}

export function html(
  template: TemplateStringsArray,
  ...expressions: ReadonlyArray<
    ValueOrArray<string | Domtag> | DomtagEvent | DomtagCapture
  >
) {
  return new Domtag(template, expressions);
}

type DomtagEvent = {
  [key in keyof HTMLElementEventMap]?: ((event: Event) => void);
};

type ValueOrArray<T> = T | T[];

const bind = Symbol("TpElement.bind");
const domtagEventId = "data-domtag-event-id";
const domtagCaptureId = "data-domtag-capture-id";

class Domtag {
  #text: string;
  #events: Record<string, DomtagEvent[]>;
  #captureRefs: Record<string, DomtagCapture[]>;
  constructor(
    template: TemplateStringsArray,
    expressions: ReadonlyArray<
      ValueOrArray<string | Domtag> | DomtagEvent | DomtagCapture
    >,
  ) {
    console.log({ template, expressions });
    this.#events = {};
    this.#captureRefs = {};
    this.#text = "";
    for (const [i, string] of template.entries()) {
      this.#text += string;
      const expr = expressions[i];
      if (expr == undefined) {
        continue;
      }
      if (
        typeof expr === "string" || expr instanceof Domtag ||
        Array.isArray(expr)
      ) {
        const flattenExpr = [expr].flat();
        for (const val of flattenExpr) {
          if (typeof val === "string") {
            this.#text += escapeHTML(val);
          } else {
            // val is childelment
            this.#text += val.#text;
            Object.assign(this.#events, val.#events);
          }
        }
      } else {
        if (expr instanceof DomtagCapture) {
          const key = `tp-${Math.random()}`;
          this.#text += ` ${domtagCaptureId}="${key}" `;
          this.#captureRefs[key] ??= [];
          this.#captureRefs[key].push(expr);
        } else {
          const key = `tp-${Math.random()}`;
          this.#text += ` ${domtagEventId}="${key}" `;
          this.#events[key] ??= [];
          this.#events[key].push(expr);
        }
      }
    }
  }
  [Symbol.for("Deno.customInspect")]() {
    return `TpElement { ${JSON.stringify(this.#text)} }`;
  }
  renderTo(
    targetElement: Element,
    position?:
      | "beforebegin"
      | "afterbegin"
      | "beforeend"
      | "afterend",
  ) {
    if (!position) {
      targetElement.innerHTML = this.#text;
    } else {
      targetElement.insertAdjacentHTML(position, this.#text);
    }
    for (const [key, events] of Object.entries(this.#events)) {
      const eventElement = targetElement.querySelector(
        `[${domtagEventId}="${key}"]`,
      );
      for (const event of events) {
        for (
          const [eventType, func] of Object.entries(
            event as unknown as Record<string, ((event: Event) => void)>,
          )
        ) {
          eventElement!.addEventListener(eventType, func);
        }
      }
    }
    for (const [key, captures] of Object.entries(this.#captureRefs)) {
      for (const capture of captures) {
        capture[bind](`[${domtagCaptureId}="${key}"]`);
      }
    }
  }
}

export function capture<ReferanceElement = Element>(
  rootElement?: { querySelector(selectors: string): ReferanceElement | null },
) {
  return new DomtagCapture<ReferanceElement>(rootElement);
}

class DomtagCapture<ReferanceElement = Element> {
  #rootElement: { querySelector(selectors: string): ReferanceElement | null };
  #querySelector?: string;
  constructor(
    rootElement?: { querySelector(selectors: string): ReferanceElement | null },
  ) {
    this.#rootElement = rootElement ?? document;
  }
  get element() {
    if (!this.#querySelector) {
      throw new Error();
    }
    return this.#rootElement.querySelector(this.#querySelector);
  }
  [bind](querySelector: string) {
    this.#querySelector = querySelector;
  }
}

const updater = capture(document);
const _updater1 = capture(document.body);
const _updater2 = capture();

//console.log(html`<div ${{ click: console.log }} ${updater}></div>`);

console.log(html`<div>"${"aaa"}${["bbb", "ccc"]}${html`<div></div>`}</div>`);

const aaa = html`<div ${{
  click: console.log,
}} ${updater}>hello ${"<aaaaa>"}</div>`;

const app = document.getElementById("app");

if (!app) {
  throw new Error("aaaa");
}

aaa.renderTo(app);
console.log(updater);

{
  const aaa = html`<div>"${"aaa"}${["bbb", "ccc"]}${html
    `<div>aaaa</div>`}</div>`;

  const app = document.getElementById("app");

  if (!app) {
    throw new Error("aaaa");
  }
  aaa.renderTo(app, "beforeend");
  console.log(updater);
}
