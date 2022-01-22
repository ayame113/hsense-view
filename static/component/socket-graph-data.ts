/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />

import { type ListElement } from "../utils/list.ts";
import { iter } from "../utils/iter.ts";
import { DataList, type TimeData } from "./data_list.ts";

class DataElement extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: "closed" });
    shadow.appendChild(createElement("link", {
      "rel": "stylesheet",
      "href": new URL("./socket-graph-data.css", import.meta.url),
    }));
    shadow.appendChild(createElement("div", {}));
    shadow.appendChild(
      new GraphElement(
        new DataList({
          async requestOldData(time) {
            await new Promise((ok) => setTimeout(ok, 500));
            time ??= Date.now();
            time = Math.floor(time);
            const res = [];
            for (let i = 1; i < 50; i++) {
              res.push({ time: time - i, i: Math.sin((time - i) / 5) });
            }
            return res;
          },
        }),
        ["i"],
        { width: 200, height: 200 },
      ),
    );
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
  #keys: string[];
  #list: DataList;
  #onDisconnect: (() => void)[];
  #resizeObserver: ResizeObserver;
  constructor(
    dataList: DataList,
    dataKey: string[],
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
    this.#onDisconnect = [];
    this.#resizeObserver = new ResizeObserver(([entry]) => {
      const height = entry.contentBoxSize?.[0]?.blockSize ??
        entry.contentRect.height;
      const width = entry.contentBoxSize?.[0]?.inlineSize ??
        entry.contentRect.width;
      this.#position.height = height;
      this.#position.width = width;
      if (this.#canvasElement) {
        this.#canvasElement.height = height;
        this.#canvasElement.width = width;
        this.#shouldRender = true;
      }
    });
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
      this.#position.originX -= (event.offsetX - this.#offsetX) *
        this.#position.scaleX;
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
    {
      const x = event.offsetX;
      const newScaleX = this.#position.scaleX * scaleChange;
      if (!newScaleX) { //0の場合は無効
        return;
      }
      this.#position.originX = x * (this.#position.scaleX - newScaleX) +
        this.#position.originX;
      this.#position.scaleX = newScaleX;
    }
    {
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
    this.#canvasElement = document.createElement("canvas");
    this.#canvasElement.height = 0;
    this.#canvasElement.width = 0;
    this.#ctx = this.#canvasElement.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    this.appendChild(this.#canvasElement);
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
    }

    let pointerForFirst: ListElement<TimeData> | undefined;
    while (isLoop) {
      await animationFramePromise();
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
        if (this.#ctx && pointerForFirst) {
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
                `${formatUnixTime(scaleLinePos, preTime)}`,
                x - 3,
                y - 3,
              );
              this.#ctx.restore();
              preTime = scaleLinePos;
            }
            const scaleLinesY = getScaleLine(
              min,
              max,
              this.#position.width,
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
                `${scaleLinePos}`,
                x + 3,
                y - 3,
              );
            }
          }
          {
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
                  .map((v) => [v.time, v[key]] as const)
                  .map(this.#valueToCanvasPos.bind(this)),
              );
            }
          }
        }
        this.#list.requestData({
          oldestTime: Math.floor(oldestTime),
          latestTime: Math.ceil(latestTime),
        })
          .then((loaded) => {
            if (loaded) {
              this.#shouldRender = true;
            }
          });
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
    const div = createElement("div", {}, [input]);
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
  attr: Record<string, { toString: () => string }> = {},
  children: (string | HTMLElement)[] = [],
) {
  const element = document.createElement(tagName);
  for (const [k, v] of Object.entries(attr)) {
    element.setAttribute(k, v.toString());
  }
  for (const child of children) {
    element.append(child);
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
    if (i === 0) {
      // 0の時はNaNになるので例外処理
      res.push(0);
    } else {
      // 上から14桁分で四捨五入
      const d = 10 ** (Math.floor(Math.log10(Math.abs(i))) + 14);
      res.push(Math.round(i * d) / d);
    }
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
function _formatUnixTimeToDate(time: number) {
  const date = new Date(time);
  return `${zfill(date.getFullYear(), 4)}.${zfill(date.getMonth() + 1, 2)}.${
    zfill(date.getDay(), 2)
  }`;
}

function zfill(str: { toString(): string }, digit: number) {
  return `${"0".repeat(digit)}${str}`.slice(-digit);
}
