/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />

import { type ListElement } from "../utils/list.ts";
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
        pointerForFirst = this.#list.getElementFromTime(
          oldestTime,
          pointerForFirst,
        );
        if (this.#ctx && pointerForFirst) {
          this.#ctx.fillStyle = "white";
          this.#ctx.fillRect(
            0,
            0,
            this.#ctx.canvas.width,
            this.#ctx.canvas.height,
          );
          for (const key of this.#keys) {
            renderLine(
              this.#ctx,
              map(
                map(
                  breakIf(
                    DataList.iterate(pointerForFirst),
                    (data) => latestTime < data.time,
                  ),
                  (v) => [v.time, v[key]] as const,
                ),
                this.#valueToCanvasPos.bind(this),
              ),
            );
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

function* map<T, R>(target: Iterable<T>, fn: (arg: T) => R) {
  for (const v of target) {
    yield fn(v);
  }
}
function* breakIf<T>(target: Iterable<T>, fn: (arg: T) => boolean) {
  for (const v of target) {
    if (fn(v)) {
      yield v;
      return;
    }
    yield v;
  }
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
