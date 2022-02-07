/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />

import { type ListElement } from "../utils/list.ts";
import { iter } from "../utils/iter.ts";
import { DataList, type TimeData } from "./data_list.ts";

class ColorRegistry {
  #colors: Map<string, string>;
  constructor() {
    this.#colors = new Map();
  }
  set(key: string, value: string) {
    this.#colors.set(key, value);
  }
  get(key: string) {
    return this.#colors.get(key) ?? (() => {
      const color = stringToColor(key);
      this.#colors.set(key, color);
      return color;
    })();
  }
}

class DataElement extends HTMLElement {
  static observedAttributes = ["data-source-url", "data-source-streaming-url"];
  #shadow: ShadowRoot;
  attr: {
    sourceUrl: string | null;
    sourceStreamingUrl: string | null;
  };
  constructor() {
    super();
    this.attr = {
      sourceUrl: null,
      sourceStreamingUrl: null,
    };
    this.#shadow = this.attachShadow({ mode: "closed" });
  }
  connectedCallback() {
    this.init();
  }
  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === "data-source-url") {
      this.attr.sourceUrl = newValue;
    }
    if (name === "data-source-streaming-url") {
      this.attr.sourceStreamingUrl = newValue;
    }
    this.init();
  }
  init() {
    if (!this.attr.sourceUrl || !this.attr.sourceStreamingUrl) {
      return;
    }
    this.#shadow.innerHTML = "";
    this.#shadow.appendChild(createElement("link", {
      "rel": "stylesheet",
      "href": new URL("./socket-graph-data.css", import.meta.url),
    }));
    this.#shadow.appendChild(createElement("div", {}));
    const { sourceUrl, sourceStreamingUrl } = this.attr;
    this.#shadow.appendChild(
      new GraphElement(
        new DataList({
          async requestOldData(time) {
            console.log(`request: ${time}`);
            await new Promise((ok) => setTimeout(ok, 500));
            // time ??= Date.now();
            // time = Math.min(time, Date.now());
            // time = Math.floor(time);
            // const res = [];
            // for (let i = 1; i < 50; i++) {
            //   res.push({
            //     time: time - i * 1000,
            //     i: Math.sin((time - i * 1000) / 5000),
            //   });
            // }
            // return res;
            const res = await fetch(
              sourceUrl
                .replaceAll("%fromTime%", `${time || ""}`)
                .replaceAll("%limit%", "50"),
            );
            return (await res.json()).data;
          },
          getEventSource() {
            return new EventSource(sourceStreamingUrl);
          },
        }),
        new Set(),
        { width: 200, height: 400 },
      ),
    );
    this.#shadow.appendChild(createElement("ul", null, (e) => {
      e.classList.add("bottom-buttons");
    }, [
      createElement("li", null, (e) => {
        e.classList.add("copy-button");
        e.addEventListener("click", () => {
          this.toggleEmbedTag();
        });
      }, ["</>"]),
    ]));
  }
  #embedTagElement?: HTMLDivElement;
  toggleEmbedTag() {
    if (this.#embedTagElement) {
      this.#embedTagElement.remove();
      this.#embedTagElement = undefined;
      return;
    }
    const text = [
      `<script src="${import.meta.url}" type="module"></script>`,
      `<socket-graph-data data-source-url="${this.attr.sourceUrl}" data-source-streaming-url="${this.attr.sourceStreamingUrl}"></socket-graph-data>`,
    ].join("\n");
    this.#shadow.appendChild(createElement("div", null, (wrapper) => {
      this.#embedTagElement = wrapper;
      let textarea: HTMLTextAreaElement | undefined;
      wrapper.append(
        createElement("textarea", null, (e) => {
          e.style.width = "80%";
          e.style.height = "4em";
          textarea = e;
        }, [text]),
        createElement("button", null, (button) => {
          button.addEventListener("click", () => {
            textarea?.select();
            navigator.clipboard.writeText(text).then(
              () => button.innerText = "copy✅",
              () => button.innerText = "copy✖",
            );
          });
        }, ["copy"]),
      );
    }));
  }
}

class GraphElement extends HTMLElement {
  #position: {
    scaleX: number;
    scaleY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
  #shouldRender = false;
  #canvasElement?: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D | null = null;
  #keys: Set<string>;
  #list: DataList;
  #onDisconnect: (() => void)[];
  #resizeObserver: ResizeObserver;
  #colorRegistry: ColorRegistry;
  #headerElement?: HTMLDivElement;
  #footerElement?: HTMLDivElement;
  constructor(
    dataList: DataList,
    dataKey: Set<string>,
    { width, height }: { width: number; height: number },
  ) {
    super();
    this.#keys = dataKey;
    this.#list = dataList;
    this.#position = {
      scaleX: 1,
      scaleY: 1,
      originX: 0,
      originY: 0,
      width,
      height,
    };
    this.style.height = `${height}px`;
    this.#onDisconnect = [];
    this.#resizeObserver = new ResizeObserver(([entry]) => {
      const height = (entry.contentBoxSize?.[0]?.blockSize ??
        entry.contentRect.height) -
        (this.#headerElement?.clientHeight ?? 0) -
        (this.#footerElement?.clientHeight ?? 0) - 10;
      const width = (entry.contentBoxSize?.[0]?.inlineSize ??
        entry.contentRect.width) - 2; // border分引く
      this.#position.height = height;
      this.#position.width = width;
      if (this.#canvasElement) {
        this.#canvasElement.height = height;
        this.#canvasElement.width = width;
        this.#shouldRender = true;
      }
    });
    this.#colorRegistry = new ColorRegistry();
  }
  #isMouseDown = false;
  #onmousedown = () => {
    this.#isMouseDown = true;
  };
  #onmouseup = () => {
    this.#isMouseDown = false;
    this.#offsetX = undefined;
    this.#offsetY = undefined;
  };
  #offsetX: number | undefined;
  #offsetY: number | undefined;
  #onmousemove = (event: MouseEvent) => {
    if (!this.#isMouseDown) {
      return;
    }
    if (this.#offsetX != null) {
      const newOriginX = this.#position.originX -
        (event.offsetX - this.#offsetX) * this.#position.scaleX;
      const posInfo = checkGraphPosition({
        scaleX: this.#position.scaleX,
        originX: newOriginX,
        width: this.#position.width,
      });
      if (posInfo.trackRealtime) {
        this.#startTrackRealtimeData();
      } else {
        this.#stopTrackRealtimeData();
      }
      this.#position.originX = posInfo.newOriginX ?? newOriginX;
      this.#shouldRender = true;
    }
    if (this.#offsetY != null) {
      this.#position.originY += (event.offsetY - this.#offsetY) *
        this.#position.scaleY;
      this.#shouldRender = true;
    }
    this.#offsetX = event.offsetX;
    this.#offsetY = event.offsetY;
  };
  #onwheel = (event: WheelEvent) => {
    event.preventDefault();
    const scaleChange = (1 + event.deltaY * 0.001);
    if (!event.shiftKey) {
      const x = event.offsetX;
      const newScaleX = this.#position.scaleX * scaleChange;
      if (!newScaleX) { //0の場合は無効
        return;
      }
      const newOriginX = x * (this.#position.scaleX - newScaleX) +
        this.#position.originX;
      const posInfo = checkGraphPosition({
        scaleX: newScaleX,
        originX: newOriginX,
        width: this.#position.width,
      });
      if (posInfo.trackRealtime) {
        this.#startTrackRealtimeData();
      } else {
        this.#stopTrackRealtimeData();
      }
      this.#position.originX = posInfo.newOriginX ?? newOriginX;
      this.#position.scaleX = newScaleX;
    }
    if (!event.ctrlKey) {
      const y = event.offsetY;
      const newScaleY = this.#position.scaleY * scaleChange;
      if (!newScaleY) { //0の場合は無効
        return;
      }
      this.#position.originY = y * (newScaleY - this.#position.scaleY) +
        this.#position.originY;
      this.#position.scaleY = newScaleY;
    }
    this.#shouldRender = true;
  };
  connectedCallback() {
    const buttons = createElement("div");
    buttons.classList.add("buttons");
    for (const keyName of this.#keys) {
      buttons.appendChild(
        selectGraphDataButton(keyName, this.#colorRegistry.get(keyName), {
          onCheck: (v) => {
            if (v) {
              this.#keys.add(keyName);
            } else {
              this.#keys.delete(keyName);
            }
            this.#shouldRender = true;
          },
          onUpdateColor: (v) => {
            this.#colorRegistry.set(keyName, v);
            this.#shouldRender = true;
          },
        }),
      );
    }
    this.#headerElement = createElement("div", null, null, [buttons]);
    this.appendChild(this.#headerElement);
    this.#canvasElement = document.createElement("canvas");
    this.#canvasElement.height = 0;
    this.#canvasElement.width = 0;
    this.#ctx = this.#canvasElement.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    this.appendChild(this.#canvasElement);
    this.#footerElement = createElement("div", null, null, ["a"]);
    this.appendChild(this.#footerElement);
    const controller = new AbortController();
    this.#list.onUpdate(() => this.#shouldRender = true, controller);
    this.#list.onKeyUpdate((keyName) => {
      this.#keys.add(keyName);
      buttons.appendChild(
        selectGraphDataButton(keyName, this.#colorRegistry.get(keyName), {
          onCheck: (v) => {
            if (v) {
              this.#keys.add(keyName);
            } else {
              this.#keys.delete(keyName);
            }
            this.#shouldRender = true;
          },
          onUpdateColor: (v) => {
            this.#colorRegistry.set(keyName, v);
            this.#shouldRender = true;
          },
        }),
      );
      // 要素追加に合わせて高さ更新
      const height = this.clientHeight -
        (this.#headerElement?.clientHeight ?? 0) -
        (this.#footerElement?.clientHeight ?? 0) - 10;
      this.#position.height = height;
      if (this.#canvasElement) {
        this.#canvasElement.height = height;
      }
    }, controller);
    this.#onDisconnect.push(() => controller.abort());
    this.#startListeningMoveEvent();
    this.#resizeObserver.observe(this);
  }
  disconnectedCallback() {
    for (const fn of this.#onDisconnect) {
      fn();
    }
    this.#onDisconnect = [];
    this.#resizeObserver.unobserve(this);
  }
  async #startListeningMoveEvent() {
    this.#canvasElement?.addEventListener("mousedown", this.#onmousedown);
    globalThis.addEventListener("mouseup", this.#onmouseup);
    this.#canvasElement?.addEventListener("mousemove", this.#onmousemove);
    this.#canvasElement?.addEventListener("wheel", this.#onwheel);
    this.#onDisconnect.push(() => {
      this.#canvasElement?.removeEventListener("mousedown", this.#onmousedown);
      globalThis.removeEventListener("mouseup", this.#onmouseup);
      this.#canvasElement?.removeEventListener("mousemove", this.#onmousemove);
      this.#canvasElement?.removeEventListener("wheel", this.#onwheel);
    });
    let isLoop = true;
    this.#onDisconnect.push(() => {
      isLoop = false;
    });
    await this.#list.requestData();
    const leftPoint = this.#list.first.value?.time;
    const rightPoint = this.#list.last.value?.time;
    const maxPoint = this.#list.getMaxVal(...this.#keys);
    const minPoint = this.#list.getMinVal(...this.#keys);
    if (
      leftPoint != null && rightPoint != null &&
      maxPoint != null && minPoint != null
    ) {
      this.#position = {
        scaleX: (rightPoint - leftPoint) / this.#position.width,
        scaleY: (maxPoint - minPoint) / this.#position.height,
        originX: leftPoint,
        originY: maxPoint,
        width: this.#position.width,
        height: this.#position.height,
      };
      console.log(this.#position);
    } else {
      // 初期データなし
      // 現在時刻が中央になるように合わせて、streaming開始
      this.#position = {
        scaleX: 60 * 1000 / this.#position.width,
        scaleY: 2 / this.#position.height,
        originX: Date.now() - 30 * 1000,
        originY: 1,
        width: this.#position.width,
        height: this.#position.height,
      };
      this.#startTrackRealtimeData();
    }

    let pointerForFirst: ListElement<TimeData> | undefined;
    let preTime: number | undefined;
    while (isLoop) {
      const currentTime = await animationFramePromise();
      if (this.#isTrackingRealtimeData) {
        // 時刻更新に合わせて描画範囲を追尾
        if (preTime) {
          this.#position.originX += currentTime - preTime;
        }
        this.#shouldRender = true;
      }
      preTime = currentTime;
      if (this.#shouldRender) {
        const oldestTime = this.#position.originX;
        const latestTime = oldestTime +
          (this.#position.width * this.#position.scaleX);
        const max = this.#position.originY;
        const min = max - (this.#position.height * this.#position.scaleY);
        pointerForFirst = this.#list.getElementFromTime(
          oldestTime,
          pointerForFirst,
        );
        if (this.#ctx) {
          {
            this.#ctx.fillStyle = "white";
            this.#ctx.fillRect(
              0,
              0,
              this.#ctx.canvas.width,
              this.#ctx.canvas.height,
            );
          }
          {
            this.#ctx.textAlign = "start";
            this.#ctx.fillStyle = "black";
            this.#ctx.font = "normal 16px sans-serif";
            const scaleLinesX = getScaleLine(
              oldestTime,
              latestTime,
              this.#position.width,
            );
            for (const scaleLinePos of scaleLinesX) {
              renderLine(this.#ctx, [
                this.#valueToCanvasPos([scaleLinePos, max]),
                this.#valueToCanvasPos([scaleLinePos, min]),
              ], { strokeStyle: "gray" });
            }
            let preTime: number | undefined;
            for (const scaleLinePos of scaleLinesX) {
              const [x, y] = this.#valueToCanvasPos([scaleLinePos, min]);
              this.#ctx.save();
              this.#ctx.translate(x - 3, y - 3);
              this.#ctx.rotate(-Math.PI / 2);
              this.#ctx.translate(-x + 3, -y + 3);
              this.#ctx.fillText(
                `${
                  formatUnixTime(
                    roundWithSignificantDigit(scaleLinePos, 14),
                    preTime,
                  )
                }`,
                x - 3,
                y - 3,
              );
              this.#ctx.restore();
              preTime = scaleLinePos;
            }
            const scaleLinesY = getScaleLine(
              min,
              max,
              this.#position.height,
            );
            for (const scaleLinePos of scaleLinesY) {
              renderLine(this.#ctx, [
                this.#valueToCanvasPos([oldestTime, scaleLinePos]),
                this.#valueToCanvasPos([latestTime, scaleLinePos]),
              ], { strokeStyle: "gray" });
            }
            for (const scaleLinePos of scaleLinesY) {
              const [x, y] = this.#valueToCanvasPos([oldestTime, scaleLinePos]);
              this.#ctx.fillText(
                `${roundWithSignificantDigit(scaleLinePos, 10)}`,
                x + 3,
                y - 3,
              );
            }
          }
          {
            const now = Date.now();
            renderLine(this.#ctx, [
              this.#valueToCanvasPos([now, max]),
              this.#valueToCanvasPos([now, min]),
            ], { strokeStyle: "#00ff00", lineWidth: 2 });
          }
          if (pointerForFirst) {
            for (const key of this.#keys) {
              let breakNext = true;
              renderLine(
                this.#ctx,
                iter(DataList.iterate(pointerForFirst))
                  .takeWhile((data) => {
                    // グラフの左端を超えた次の値まで描画する
                    const shouldBreak = breakNext;
                    breakNext = data.time < latestTime;
                    return shouldBreak;
                  })
                  .filter((v) => v[key] != null)
                  .map((v) => [v.time, v[key]] as const)
                  .map(this.#valueToCanvasPos.bind(this)),
                { strokeStyle: this.#colorRegistry.get(key) },
              );
            }
          }
        }
        this.#list.requestData({
          oldestTime: Math.floor(oldestTime),
          latestTime: Math.ceil(latestTime),
        });
        if (this.#footerElement) {
          this.#footerElement
            .innerText = `[${formatUnixTimeToDate(oldestTime)}]`;
        }
      }
      this.#shouldRender = false;
    }
  }
  #valueToCanvasPos([x, y]: readonly [number, number]) {
    return [
      (x - this.#position.originX) / this.#position.scaleX,
      (this.#position.originY - y) / this.#position.scaleY,
    ] as const;
  }
  /*#canvasPosToValue([cx, cy]: readonly [number, number]) {
    return [
      cx * this.#position.scaleX + this.#position.originX,
      cy * this.#position.scaleY - this.#position.originY,
    ] as const;
  }*/
  #isTrackingRealtimeData = false;
  #startTrackRealtimeData() {
    if (!this.#isTrackingRealtimeData) {
      this.#list.startStreaming();
    }
    this.#isTrackingRealtimeData = true;
  }
  #stopTrackRealtimeData() {
    if (this.#isTrackingRealtimeData) {
      this.#list.stopStreaming();
    }
    this.#isTrackingRealtimeData = false;
  }
}
function selectGraphDataButton(
  keyName: string,
  color: string,
  { onCheck, onUpdateColor }: {
    onCheck(isChecked: boolean): void;
    onUpdateColor(color: string): void;
  },
) {
  return createElement("div", null, null, [
    createElement("span", null, null, [
      createElement("label", null, null, [
        createElement("input", { type: "checkbox", checked: true }, (e) => {
          e.addEventListener("change", (e) => {
            onCheck((e.currentTarget as HTMLInputElement).checked);
          });
        }),
        keyName,
      ]),
    ]),
    createElement("span", null, null, [
      createElement("input", { type: "color" }, (e) => {
        e.value = cssColorToColorCode(color);
        e.addEventListener("change", (e) => {
          onUpdateColor((e.currentTarget as HTMLInputElement).value);
        });
      }),
    ]),
  ]);
}

customElements.define("socket-graph-data-inner", GraphElement);
customElements.define("socket-graph-data", DataElement);

class DrowerElement extends HTMLElement {
  #isMouseDown = false;
  #resizeObserver: ResizeObserver;
  #canvasElement?: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D | null = null;
  constructor() {
    super();
    this.#resizeObserver = new ResizeObserver(([entry]) => {
      const height = (entry.contentBoxSize?.[0]?.blockSize ??
        entry.contentRect.height) - 36;
      const width = entry.contentBoxSize?.[0]?.inlineSize ??
        entry.contentRect.width;
      if (this.#canvasElement) {
        this.#canvasElement.height = height;
        this.#canvasElement.width = width;
        if (this.#ctx) {
          this.#ctx.fillStyle = "white";
          this.#ctx.fillRect(
            0,
            0,
            this.#canvasElement.width,
            this.#canvasElement.height,
          );
        }
      }
    });
  }
  connectedCallback() {
    const shadow = this.attachShadow({ mode: "closed" });
    shadow.appendChild(createElement("link", {
      "rel": "stylesheet",
      "href": new URL("./socket-graph-drower.css", import.meta.url),
    }));
    const input = createElement("input", { type: "color" });
    input.addEventListener("change", () => this.#setColor(input.value));
    const div = createElement("div", null, null, [input]);
    div.style.height = "36px";
    shadow.appendChild(div);
    this.#canvasElement = document.createElement("canvas");
    this.#canvasElement.height = 0;
    this.#canvasElement.width = 0;
    this.#ctx = this.#canvasElement.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    shadow.appendChild(this.#canvasElement);
    this.#resizeObserver.observe(this);
    this.#canvasElement.addEventListener("mousedown", this.#onmousedown);
    globalThis.addEventListener("mouseup", this.#onmouseup);
    this.#canvasElement.addEventListener("mousemove", this.#onmousemove);
  }
  disconnectedCallback() {
    this.innerHTML = "";
    this.#resizeObserver.unobserve(this);
    this.#canvasElement?.removeEventListener("mousedown", this.#onmousedown);
    globalThis.removeEventListener("mouseup", this.#onmouseup);
    this.#canvasElement?.removeEventListener("mousemove", this.#onmousemove);
  }
  #onmousedown = (event: MouseEvent) => {
    this.#isMouseDown = true;
    this.#ctx?.moveTo(event.offsetX, event.offsetY);
  };
  #onmouseup = (event: MouseEvent) => {
    if (this.#isMouseDown) {
      this.#ctx?.lineTo(event.offsetX, event.offsetY);
    }
    this.#isMouseDown = false;
  };
  #onmousemove = (event: MouseEvent) => {
    if (!this.#isMouseDown) {
      return;
    }
    if (this.#ctx) {
      this.#ctx.lineTo(event.offsetX, event.offsetY);
      this.#ctx.lineWidth = 3;
      this.#ctx.stroke();
    }
  };
  #setColor = (color: string) => {
    if (this.#ctx) {
      this.#ctx.strokeStyle = color;
      this.#ctx.beginPath();
    }
  };
}

customElements.define("socket-graph-drower", DrowerElement);

function animationFramePromise() {
  return new Promise<number>((resolve) => {
    requestAnimationFrame(resolve);
  });
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

function renderLine(
  ctx: CanvasRenderingContext2D,
  data: Iterable<readonly [number, number]>,
  option: { strokeStyle?: string; lineWidth?: number } = {},
) {
  ctx.beginPath();
  ctx.strokeStyle = option.strokeStyle ?? "black";
  ctx.lineWidth = option.lineWidth ?? 1;
  let isFirst = true;
  for (const [x, y] of data) {
    ctx[isFirst ? "moveTo" : "lineTo"](x, y);
    isFirst = false;
  }
  ctx.stroke();
}

/** 目盛り線を引く位置を取得 */
function getScaleLine(min: number, max: number, length: number) {
  // 間隔がだいたい50pxくらいになるように目盛り線を引く
  const width50px = (max - min) * 50 / length;
  const digitCount = Math.floor(Math.log10(width50px));
  const highestDigit = width50px / 10 ** digitCount;
  // 10,5,2の間隔でどれが一番50pxに近いか判定
  let closestN = 1;
  let distanceToClosestN = Math.abs(highestDigit - 1);
  for (const n of [2, 5]) {
    if (Math.abs(highestDigit - n) < distanceToClosestN) {
      closestN = n;
      distanceToClosestN = Math.abs(highestDigit - n);
    }
  }
  const scaleLineWidth = closestN * 10 ** digitCount;
  const minScaleLine = Math.ceil(min / scaleLineWidth) * scaleLineWidth;
  const maxScaleLine = Math.ceil(max / scaleLineWidth) * scaleLineWidth;
  const res: number[] = [];
  for (let i = minScaleLine; i < maxScaleLine; i += scaleLineWidth) {
    res.push(i);
  }
  return res;
}

function formatUnixTime(time: number, prevTime?: number) {
  const date = new Date(Math.round(time));
  // date.getMillisecondsは誤差が切り捨てられる
  const ms = Math.round(time % 1000);
  if (prevTime === undefined) {
    if (ms !== 0) {
      return `${zfill(date.getHours(), 2)}:${zfill(date.getMinutes(), 2)}:${
        zfill(date.getSeconds(), 2)
      }.${zfill(ms, 4).replace(/0{0,3}$/, "")}`;
    }
    return `${zfill(date.getHours(), 2)}:${zfill(date.getMinutes(), 2)}:${
      zfill(date.getSeconds(), 2)
    }`;
  }
  const prevDate = new Date(Math.round(prevTime));
  const hour = date.getHours();
  const prevHour = prevDate.getHours();
  const minute = date.getMinutes();
  const prevMinute = prevDate.getMinutes();
  const second = date.getSeconds();
  const prevSecond = prevDate.getSeconds();
  const prevMs = Math.round(prevTime % 1000);
  if ((hour !== prevHour || minute !== prevMinute || second !== prevSecond)) {
    if (ms !== prevMs) {
      return `${zfill(date.getHours(), 2)}:${zfill(date.getMinutes(), 2)}:${
        zfill(date.getSeconds(), 2)
      }.${zfill(ms, 4).replace(/0{0,3}$/, "")}`;
    } else {
      return `${zfill(date.getHours(), 2)}:${zfill(date.getMinutes(), 2)}:${
        zfill(date.getSeconds(), 2)
      }`;
    }
  } else {
    return `.${zfill(ms, 4).replace(/0{0,3}$/, "")}`;
  }
}
function formatUnixTimeToDate(time: number) {
  const date = new Date(time);
  return `${zfill(date.getFullYear(), 4)}.${zfill(date.getMonth() + 1, 2)}.${
    zfill(date.getDate(), 2)
  } - ${formatUnixTime(time)}`;
}

function zfill(str: { toString(): string }, digit: number) {
  return `${"0".repeat(digit)}${str}`.slice(-digit);
}

/** 数値{n}を有効数字{significantDigit}で四捨五入する */
function roundWithSignificantDigit(n: number, significantDigit: number) {
  if (n === 0) {
    // 0の時はNaNになるので例外処理
    return 0;
  } else {
    // 上から14桁分で四捨五入
    const d = 10 ** (Math.floor(Math.log10(Math.abs(n))) + significantDigit);
    return Math.round(n * d) / d;
  }
}

/**
 * グラフの表示範囲と現在時刻の関係をチェックする
 * - 現在位置がグラフ中央より右にある場合：時間の経過に従ってグラフの表示範囲を更新
 * - 現在位置がグラフ中央より左にある場合：表示不可
 */
function checkGraphPosition(
  { scaleX, originX, width }: {
    scaleX: number;
    originX: number;
    width: number;
  },
): { trackRealtime: boolean; newOriginX?: number } {
  /** グラフ中心の時刻 */
  const latestTime = originX + width * scaleX;
  const now = Date.now();
  if (now < latestTime) {
    const midTime = originX + width * scaleX * 0.5;
    if (now < midTime) {
      const newOriginX = now - width * scaleX * 0.5;
      return { trackRealtime: true, newOriginX };
    } else {
      return { trackRealtime: true };
    }
  }
  return { trackRealtime: false };
}

const encoder = new TextEncoder();
function stringToColor(str: string) {
  const h = encoder.encode(str).reduce((p, c) => (p * c) % 360);
  return `hsl(${(h * h * h) % 360}, 100%, 25%)`;
}

const div = document.createElement("div");
document.head.appendChild(div);
/** 'hsl(*, *, *)' を '#******' に変換する */
function cssColorToColorCode(hslText: string) {
  div.style.color = hslText;
  const { r, g, b } = getComputedStyle(div).color
    .match(/rgb\((?<r>[0-9]*), (?<g>[0-9]*), (?<b>[0-9]*)\)/)
    ?.groups as { r: string; g: string; b: string };
  return "#" + [r, g, b].map((v) => zfill((+v).toString(16), 2)).join("");
}
