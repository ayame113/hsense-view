import { iter } from "../utils/iter.js";
import { DataList } from "./data_list.js";
class ColorRegistry {
  #colors;
  constructor() {
    this.#colors = new Map();
  }
  set(key, value) {
    this.#colors.set(key, value);
  }
  get(key) {
    return this.#colors.get(key) ?? (() => {
      const color = stringToColor(key);
      this.#colors.set(key, color);
      return color;
    })();
  }
}
class DataElement extends HTMLElement {
  #shadow;
  constructor() {
    super();
    this.attr = {
      sourceUrl: null,
      sourceStreamingUrl: null,
    };
    this.#shadow = this.attachShadow({
      mode: "closed",
    });
  }
  connectedCallback() {
    this.init();
  }
  attributeChangedCallback(name, _oldValue, newValue) {
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
              sourceUrl.replaceAll("%fromTime%", `${time || ""}`).replaceAll(
                "%limit%",
                "50",
              ),
            );
            return (await res.json()).data;
          },
          getEventSource() {
            return new EventSource(sourceStreamingUrl);
          },
        }),
        new Set(),
        {
          width: 200,
          height: 400,
        },
      ),
    );
  }
}
DataElement.observedAttributes = [
  "data-source-url",
  "data-source-streaming-url",
];
class GraphElement extends HTMLElement {
  #position;
  #shouldRender = false;
  #canvasElement;
  #ctx = null;
  #keys;
  #list;
  #onDisconnect;
  #resizeObserver;
  #colorRegistry;
  #headerElement;
  #footerElement;
  constructor(dataList, dataKey, { width, height }) {
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
      const height =
        (entry.contentBoxSize?.[0]?.blockSize ?? entry.contentRect.height) -
        (this.#headerElement?.clientHeight ?? 0) -
        (this.#footerElement?.clientHeight ?? 0) - 10;
      const width =
        (entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width) - 2; // border分引く
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
  #offsetX;
  #offsetY;
  #onmousemove = (event) => {
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
  #onwheel = (event) => {
    event.preventDefault();
    const scaleChange = 1 + event.deltaY * 0.001;
    if (!event.shiftKey) {
      const x = event.offsetX;
      const newScaleX = this.#position.scaleX * scaleChange;
      if (!newScaleX) {
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
      if (!newScaleY) {
        return;
      }
      this.#position.originY = y * (newScaleY - this.#position.scaleY) +
        this.#position.originY;
      this.#position.scaleY = newScaleY;
    }
    this.#shouldRender = true;
  };
  connectedCallback() {
    const table = createElement("table");
    for (const keyName of this.#keys) {
      table.appendChild(
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
    this.#headerElement = createElement("div", null, null, [table]);
    this.appendChild(this.#headerElement);
    this.#canvasElement = document.createElement("canvas");
    this.#canvasElement.height = 0;
    this.#canvasElement.width = 0;
    this.#ctx = this.#canvasElement.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    this.appendChild(this.#canvasElement);
    this.#footerElement = createElement("div", null, null, [
      "a",
    ]);
    this.appendChild(this.#footerElement);
    const controller = new AbortController();
    this.#list.onUpdate(() => this.#shouldRender = true, controller);
    this.#list.onKeyUpdate((keyName) => {
      this.#keys.add(keyName);
      table.appendChild(
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
      leftPoint != null && rightPoint != null && maxPoint != null &&
      minPoint != null
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
    let pointerForFirst;
    let preTime;
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
          this.#position.width * this.#position.scaleX;
        const max = this.#position.originY;
        const min = max - this.#position.height * this.#position.scaleY;
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
              ], {
                strokeStyle: "gray",
              });
            }
            let preTime;
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
            const scaleLinesY = getScaleLine(min, max, this.#position.height);
            for (const scaleLinePos of scaleLinesY) {
              renderLine(this.#ctx, [
                this.#valueToCanvasPos([oldestTime, scaleLinePos]),
                this.#valueToCanvasPos([latestTime, scaleLinePos]),
              ], {
                strokeStyle: "gray",
              });
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
            ], {
              strokeStyle: "#00ff00",
              lineWidth: 2,
            });
          }
          if (pointerForFirst) {
            for (const key of this.#keys) {
              let breakNext = true;
              renderLine(
                this.#ctx,
                iter(DataList.iterate(pointerForFirst)).takeWhile((data) => {
                  // グラフの左端を超えた次の値まで描画する
                  const shouldBreak = breakNext;
                  breakNext = data.time < latestTime;
                  return shouldBreak;
                }).filter((v) => v[key] != null).map((v) => [
                  v.time,
                  v[key],
                ]).map(this.#valueToCanvasPos.bind(this)),
                {
                  strokeStyle: this.#colorRegistry.get(key),
                },
              );
            }
          }
        }
        this.#list.requestData({
          oldestTime: Math.floor(oldestTime),
          latestTime: Math.ceil(latestTime),
        });
        if (this.#footerElement) {
          this.#footerElement.innerText = `[${
            formatUnixTimeToDate(oldestTime)
          }]`;
        }
      }
      this.#shouldRender = false;
    }
  }
  #valueToCanvasPos([x, y]) {
    return [
      (x - this.#position.originX) / this.#position.scaleX,
      (this.#position.originY - y) / this.#position.scaleY,
    ];
  }
  /*#canvasPosToValue([cx, cy]: readonly [number, number]) {
    return [
      cx * this.#position.scaleX + this.#position.originX,
      cy * this.#position.scaleY - this.#position.originY,
    ] as const;
  }*/ #isTrackingRealtimeData = false;
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
function selectGraphDataButton(keyName, color, { onCheck, onUpdateColor }) {
  createElement("input").addEventListener("change", (e) => {
    e.currentTarget;
  });
  return createElement("tr", null, null, [
    createElement("td", null, null, [
      createElement("label", null, null, [
        createElement("input", {
          type: "checkbox",
          checked: true,
        }, (e) => {
          e.addEventListener("change", (e) => {
            onCheck(e.currentTarget.checked);
          });
        }),
        keyName,
      ]),
    ]),
    createElement("td", null, null, [
      createElement("input", {
        type: "color",
      }, (e) => {
        e.value = cssColorToColorCode(color);
        e.addEventListener("change", (e) => {
          onUpdateColor(e.currentTarget.value);
        });
      }),
    ]),
  ]);
}
customElements.define("socket-graph-data-inner", GraphElement);
customElements.define("socket-graph-data", DataElement);
class DrowerElement extends HTMLElement {
  #isMouseDown = false;
  #resizeObserver;
  #canvasElement;
  #ctx = null;
  constructor() {
    super();
    this.#resizeObserver = new ResizeObserver(([entry]) => {
      const height =
        (entry.contentBoxSize?.[0]?.blockSize ?? entry.contentRect.height) - 36;
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
    const shadow = this.attachShadow({
      mode: "closed",
    });
    shadow.appendChild(createElement("link", {
      "rel": "stylesheet",
      "href": new URL("./socket-graph-drower.css", import.meta.url),
    }));
    const input = createElement("input", {
      type: "color",
    });
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
  #onmousedown = (event) => {
    this.#isMouseDown = true;
    this.#ctx?.moveTo(event.offsetX, event.offsetY);
  };
  #onmouseup = (event) => {
    if (this.#isMouseDown) {
      this.#ctx?.lineTo(event.offsetX, event.offsetY);
    }
    this.#isMouseDown = false;
  };
  #onmousemove = (event) => {
    if (!this.#isMouseDown) {
      return;
    }
    if (this.#ctx) {
      this.#ctx.lineTo(event.offsetX, event.offsetY);
      this.#ctx.lineWidth = 3;
      this.#ctx.stroke();
    }
  };
  #setColor = (color) => {
    if (this.#ctx) {
      this.#ctx.strokeStyle = color;
      this.#ctx.beginPath();
    }
  };
}
customElements.define("socket-graph-drower", DrowerElement);
function animationFramePromise() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}
function createElement(tagName, attr, cb, children) {
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
function renderLine(ctx, data, option = {}) {
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
/** 目盛り線を引く位置を取得 */ function getScaleLine(min, max, length) {
  // 間隔がだいたい50pxくらいになるように目盛り線を引く
  const width50px = (max - min) * 50 / length;
  const digitCount = Math.floor(Math.log10(width50px));
  const highestDigit = width50px / 10 ** digitCount;
  // 10,5,2の間隔でどれが一番50pxに近いか判定
  let closestN = 1;
  let distanceToClosestN = Math.abs(highestDigit - 1);
  for (
    const n of [
      2,
      5,
    ]
  ) {
    if (Math.abs(highestDigit - n) < distanceToClosestN) {
      closestN = n;
      distanceToClosestN = Math.abs(highestDigit - n);
    }
  }
  const scaleLineWidth = closestN * 10 ** digitCount;
  const minScaleLine = Math.ceil(min / scaleLineWidth) * scaleLineWidth;
  const maxScaleLine = Math.ceil(max / scaleLineWidth) * scaleLineWidth;
  const res = [];
  for (let i = minScaleLine; i < maxScaleLine; i += scaleLineWidth) {
    res.push(i);
  }
  return res;
}
function formatUnixTime(time, prevTime) {
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
  if (hour !== prevHour || minute !== prevMinute || second !== prevSecond) {
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
function formatUnixTimeToDate(time) {
  const date = new Date(time);
  return `${zfill(date.getFullYear(), 4)}.${zfill(date.getMonth() + 1, 2)}.${
    zfill(date.getDate(), 2)
  } - ${formatUnixTime(time)}`;
}
function zfill(str, digit) {
  return `${"0".repeat(digit)}${str}`.slice(-digit);
}
/** 数値{n}を有効数字{significantDigit}で四捨五入する */ function roundWithSignificantDigit(
  n,
  significantDigit,
) {
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
 */ function checkGraphPosition({ scaleX, originX, width }) {
  /** グラフ中心の時刻 */ const latestTime = originX + width * scaleX;
  const now = Date.now();
  if (now < latestTime) {
    const midTime = originX + width * scaleX * 0.5;
    if (now < midTime) {
      const newOriginX = now - width * scaleX * 0.5;
      return {
        trackRealtime: true,
        newOriginX,
      };
    } else {
      return {
        trackRealtime: true,
      };
    }
  }
  return {
    trackRealtime: false,
  };
}
const encoder = new TextEncoder();
function stringToColor(str) {
  const h = encoder.encode(str).reduce((p, c) => p * c % 360);
  return `hsl(${h * h * h % 360}, 100%, 25%)`;
}
const div = document.createElement("div");
document.head.appendChild(div);
/** 'hsl(*, *, *)' を '#******' に変換する */ function cssColorToColorCode(hslText) {
  div.style.color = hslText;
  const { r, g, b } = getComputedStyle(div).color.match(
    /rgb\((?<r>[0-9]*), (?<g>[0-9]*), (?<b>[0-9]*)\)/,
  )?.groups;
  return "#" + [r, g, b].map((v) => zfill((+v).toString(16), 2)).join("");
}
