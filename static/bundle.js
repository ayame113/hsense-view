// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

class Iter {
    #src;
    constructor(src){
        this.#src = src;
    }
    map(fn) {
        return new Iter(map(this.#src, fn));
    }
    takeWhile(fn) {
        return new Iter(takeWhile(this.#src, fn));
    }
    filter(fn) {
        return new Iter(filter(this.#src, fn));
    }
    forEach(fn) {
        for (const val of this.#src){
            fn(val);
        }
        return this;
    }
    toArray() {
        return [
            ...this.#src
        ];
    }
    [Symbol.iterator]() {
        return this.#src[Symbol.iterator]();
    }
}
function iter(src) {
    return new Iter(src);
}
function map(src, fn) {
    return {
        *[Symbol.iterator] () {
            for (const val of src){
                yield fn(val);
            }
        }
    };
}
function takeWhile(src, fn) {
    return {
        *[Symbol.iterator] () {
            for (const val of src){
                if (!fn(val)) {
                    break;
                }
                yield val;
            }
        }
    };
}
function filter(src, fn) {
    return {
        *[Symbol.iterator] () {
            for (const val of src){
                if (!fn(val)) {
                    continue;
                }
                yield val;
            }
        }
    };
}
class TimeListIterator {
    #current;
    #direction;
    constructor(start, direction = "forward"){
        this.#current = start;
        this.#direction = direction;
    }
    next() {
        const current = this.#current;
        if (!current.done) {
            if (this.#direction === "forward") {
                this.#current = current.next;
            } else {
                this.#current = current.prev;
            }
        }
        return current;
    }
}
class TimeList {
    static iterate(start, direction = "forward") {
        return {
            [Symbol.iterator] () {
                return new TimeListIterator(start, direction);
            }
        };
    }
    #first;
    #last;
    #destroyed = false;
    constructor(){
        this.#first = {
            done: true,
            value: undefined,
            next: null,
            prev: null
        };
        this.#last = {
            done: true,
            value: undefined,
            next: null,
            prev: null
        };
        this.#first.next = this.#last;
        this.#last.prev = this.#first;
    }
    get first() {
        this.throwIfDestroyed();
        return this.#first.next;
    }
    get last() {
        this.throwIfDestroyed();
        return this.#last.prev;
    }
    get destroyed() {
        return this.#destroyed;
    }
    addFirst(value) {
        this.throwIfDestroyed();
        const { prev , newElement  } = addData(this.#first, value, this.#first.next);
        this.#first = prev;
        return newElement;
    }
    addLast(value) {
        this.throwIfDestroyed();
        const { next , newElement  } = addData(this.#last.prev, value, this.#last);
        this.#last = next;
        return newElement;
    }
    margeFirst(target) {
        this.throwIfDestroyed();
        const leftLast = target.#last.prev;
        const rightFirst = this.#first.next;
        leftLast.next = rightFirst;
        rightFirst.prev = leftLast;
        this.#first = target.#first;
        target.#destroyed = true;
    }
    margeLast(target) {
        this.throwIfDestroyed();
        const leftLast = this.#last.prev;
        const rightFirst = target.#first.next;
        leftLast.next = rightFirst;
        rightFirst.prev = leftLast;
        this.#last = target.#last;
        target.#destroyed = true;
    }
    dump() {
        console.log("==dump==");
        let target = this.#first;
        for(let i = 0; i < 100; i++){
            console.log({
                done: target.done,
                value: JSON.stringify(target.value)
            });
            if (!target.next) {
                console.log(`count: ${i}`);
                break;
            }
            target = target.next;
        }
        console.log("==dump end==");
    }
    throwIfDestroyed() {
        if (this.#destroyed) {
            throw new Error("cannot call destroyed list's method");
        }
    }
}
function addData(prev, target, next) {
    const newElement = {
        done: false,
        value: target,
        next,
        prev
    };
    prev.next = newElement;
    next.prev = newElement;
    return {
        prev,
        newElement,
        next
    };
}
class DataList extends TimeList {
    #max;
    #min;
    #requestOldData;
    #getEventSource;
    #onUpdateFunc;
    #onUpdateKeyFunc;
    #keys;
    empty = true;
    constructor({ requestOldData , getEventSource  }){
        super();
        this.#requestOldData = requestOldData;
        this.#getEventSource = getEventSource;
        this.#max = {};
        this.#min = {};
        this.#loadingPromise = Promise.resolve();
        this.#onUpdateFunc = new Set();
        this.#onUpdateKeyFunc = new Set();
        this.#keys = new Set([
            "time"
        ]);
    }
    addFirst(value) {
        this.throwIfDestroyed();
        this.empty = true;
        const kvValue = Object.entries(value);
        this.#updateMaxValue(kvValue);
        this.#updateMinValue(kvValue);
        this.#updateKey(kvValue);
        const res = super.addFirst(value);
        for (const fn of this.#onUpdateFunc){
            fn();
        }
        return res;
    }
    addLast(value) {
        this.throwIfDestroyed();
        this.empty = true;
        const kvValue = Object.entries(value);
        this.#updateMaxValue(kvValue);
        this.#updateMinValue(kvValue);
        this.#updateKey(kvValue);
        const res = super.addLast(value);
        for (const fn of this.#onUpdateFunc){
            fn();
        }
        return res;
    }
    margeFirst(target) {
        this.empty = this.empty || target.empty;
        this.throwIfDestroyed();
        this.#updateMaxValue(Object.entries(target.#max));
        this.#updateMinValue(Object.entries(target.#min));
        this.#updateKey(Object.entries(target.#min));
        super.margeFirst(target);
        for (const fn of this.#onUpdateFunc){
            fn();
        }
    }
    margeLast(target) {
        this.empty = this.empty || target.empty;
        this.throwIfDestroyed();
        this.#updateMaxValue(Object.entries(target.#max));
        this.#updateMinValue(Object.entries(target.#min));
        this.#updateKey(Object.entries(target.#min));
        this.#latestTime = target.#latestTime && this.#latestTime ? Math.max(target.#latestTime, this.#latestTime) : target.#latestTime ?? this.#latestTime;
        super.margeLast(target);
        for (const fn of this.#onUpdateFunc){
            fn();
        }
    }
     #updateMaxValue(data) {
        for (const [key, val] of data){
            this.#max[key] = this.#max[key] == undefined ? val : Math.max(this.#max[key], val);
        }
    }
     #updateMinValue(data1) {
        for (const [key, val] of data1){
            this.#min[key] = this.#min[key] == undefined ? val : Math.min(this.#min[key], val);
        }
    }
     #updateKey(data2) {
        for (const [key] of data2){
            if (!this.#keys.has(key)) {
                this.#keys.add(key);
                for (const fn of this.#onUpdateKeyFunc){
                    fn(key);
                }
            }
        }
    }
    getMaxVal(...keys) {
        const val = keys.map((key)=>this.#max[key]
        ).filter((v)=>v !== null
        );
        if (val.length) {
            return Math.max(...val);
        }
    }
    getMinVal(...keys) {
        const val = keys.map((key)=>this.#min[key]
        ).filter((v)=>v !== null
        );
        if (val.length) {
            return Math.min(...val);
        }
    }
    #latestTime = null;
    #oldestTime = null;
    #loadingPromise;
    requestData(range, { allowAdditionalRange =true  } = {}) {
        return this.#loadingPromise = this.#loadingPromise.then(async ()=>{
            if (!range) {
                if (!this.first.done) {
                    throw new Error("Calls to non-empty lists that do not specify a range are not supported.");
                }
                await this.#internalRequestData(null, null);
                return true;
            }
            const { oldestTime , latestTime  } = range;
            const oldestTimeForAdditionalRange = allowAdditionalRange ? oldestTime * 2 - latestTime : oldestTime;
            const latestTimeForAdditionalRange = allowAdditionalRange ? latestTime * 2 - oldestTime : latestTime;
            if (this.first.done) {
                if (this.#latestTime === Infinity) {
                    return;
                }
                await this.#internalRequestData(oldestTimeForAdditionalRange, latestTimeForAdditionalRange);
                return true;
            }
            let loaded = false;
            if (oldestTime < this.first.value.time) {
                await this.#internalRequestData(oldestTimeForAdditionalRange, null);
                loaded = true;
            }
            if (this.#latestTime !== null && this.#latestTime < latestTime) {
                const newData = new DataList({
                    requestOldData: this.#requestOldData,
                    getEventSource: this.#getEventSource
                });
                await newData.#internalRequestData(this.#latestTime, latestTimeForAdditionalRange, true);
                this.margeLast(newData);
                loaded = true;
            }
            return loaded;
        }).catch(console.error);
    }
    async #internalRequestData(oldestTime, latestTime, stopLoadingIfOldestTime = false) {
        let loadStartTime;
        if (this.first.done) {
            loadStartTime = latestTime ?? undefined;
            if (latestTime !== null) {
                if (this.#latestTime === null || this.#latestTime < latestTime) {
                    this.#latestTime = Math.min(latestTime, Date.now());
                }
            }
        } else {
            loadStartTime = this.first.value.time;
        }
        if (loadStartTime && this.#oldestTime && loadStartTime <= this.#oldestTime) {
            return;
        }
        const result = await this.#requestOldData(loadStartTime);
        if (result.length === 0) {
            this.#oldestTime = this.#oldestTime == null ? loadStartTime ?? null : Math.max(loadStartTime ?? Date.now(), this.#oldestTime);
            return;
        }
        let breaked = false;
        for (const data of result){
            if (stopLoadingIfOldestTime && oldestTime !== null && data.time < oldestTime) {
                breaked = true;
                break;
            }
            this.addFirst(data);
        }
        if (!this.last.done) {
            this.#latestTime ??= this.last.value.time;
        }
        if (!breaked && oldestTime !== null && !this.first.done && oldestTime < this.first.value.time) {
            await this.#internalRequestData(oldestTime, null, stopLoadingIfOldestTime);
        }
    }
    getElementFromTime(time, initialPointer) {
        this.throwIfDestroyed();
        if (this.first.done) {
            return;
        }
        let pointer = initialPointer ?? this.first;
        if (pointer.value.time < time) {
            while(!pointer.next.done && pointer.next.value.time <= time){
                pointer = pointer.next;
            }
        } else {
            while(!pointer.prev.done && time < pointer.value.time){
                pointer = pointer.prev;
            }
        }
        return pointer;
    }
    #eventSource;
    startStreaming() {
        if (!this.#eventSource) {
            this.#eventSource = this.#getEventSource();
            const loadLatestData = new Promise((ok)=>{
                this.#eventSource?.addEventListener("open", async ()=>{
                    if (this.last.value) {
                        await this.requestData({
                            oldestTime: this.last.value.time,
                            latestTime: Date.now()
                        }, {
                            allowAdditionalRange: false
                        });
                    } else {
                        await this.requestData();
                    }
                    this.#latestTime = Infinity;
                    ok();
                });
            }).catch(console.error);
            this.#eventSource.addEventListener("message", (e)=>{
                const data3 = JSON.parse(e.data);
                loadLatestData.then(()=>{
                    this.addLast(data3);
                });
            });
        }
    }
    stopStreaming() {
        this.#eventSource?.close();
        this.#eventSource = undefined;
        this.#latestTime = Date.now();
    }
    onUpdate(fn, { signal  } = {}) {
        if (signal?.aborted) {
            return;
        }
        signal?.addEventListener("abort", ()=>this.#onUpdateFunc.delete(fn)
        );
        this.#onUpdateFunc.add(fn);
    }
    onKeyUpdate(fn, { signal  } = {}) {
        if (signal?.aborted) {
            return;
        }
        signal?.addEventListener("abort", ()=>this.#onUpdateKeyFunc.delete(fn)
        );
        this.#onUpdateKeyFunc.add(fn);
    }
}
const importMeta = {
    // url: "file:///C:/Users/azusa/work/deno/socket-graph/static/component/socket-graph-data.ts",
    url: new URL("/component/socket-graph-data.ts", location.href).toString(),
    main: import.meta.main
};
class ColorRegistry {
    #colors;
    constructor(){
        this.#colors = new Map();
    }
    set(key, value) {
        this.#colors.set(key, value);
    }
    get(key) {
        return this.#colors.get(key) ?? (()=>{
            const color = stringToColor(key);
            this.#colors.set(key, color);
            return color;
        })();
    }
}
class DataElement extends HTMLElement {
    static observedAttributes = [
        "data-source-url",
        "data-source-streaming-url"
    ];
    #shadow;
    attr;
    constructor(){
        super();
        this.attr = {
            sourceUrl: null,
            sourceStreamingUrl: null
        };
        this.#shadow = this.attachShadow({
            mode: "closed"
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
            "href": new URL("./socket-graph-data.css", importMeta.url)
        }));
        this.#shadow.appendChild(createElement("div", {}));
        const { sourceUrl , sourceStreamingUrl  } = this.attr;
        this.#shadow.appendChild(new GraphElement(new DataList({
            async requestOldData (time) {
                console.log(`request: ${time}`);
                await new Promise((ok)=>setTimeout(ok, 500)
                );
                const res = await fetch(sourceUrl.replaceAll("%fromTime%", `${time || ""}`).replaceAll("%limit%", "50"));
                return (await res.json()).data;
            },
            getEventSource () {
                return new EventSource(sourceStreamingUrl);
            }
        }), new Set(), {
            width: 200,
            height: 400
        }));
    }
}
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
    constructor(dataList, dataKey, { width: width1 , height: height1  }){
        super();
        this.#keys = dataKey;
        this.#list = dataList;
        this.#position = {
            scaleX: 1,
            scaleY: 1,
            originX: 0,
            originY: 0,
            width: width1,
            height: height1
        };
        this.style.height = `${height1}px`;
        this.#onDisconnect = [];
        this.#resizeObserver = new ResizeObserver(([entry])=>{
            const height = (entry.contentBoxSize?.[0]?.blockSize ?? entry.contentRect.height) - (this.#headerElement?.clientHeight ?? 0) - (this.#footerElement?.clientHeight ?? 0) - 10;
            const width = (entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width) - 2;
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
    #onmousedown = ()=>{
        this.#isMouseDown = true;
    };
    #onmouseup = ()=>{
        this.#isMouseDown = false;
        this.#offsetX = undefined;
        this.#offsetY = undefined;
    };
    #offsetX;
    #offsetY;
    #onmousemove = (event)=>{
        if (!this.#isMouseDown) {
            return;
        }
        if (this.#offsetX != null) {
            const newOriginX = this.#position.originX - (event.offsetX - this.#offsetX) * this.#position.scaleX;
            const posInfo = checkGraphPosition({
                scaleX: this.#position.scaleX,
                originX: newOriginX,
                width: this.#position.width
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
            this.#position.originY += (event.offsetY - this.#offsetY) * this.#position.scaleY;
            this.#shouldRender = true;
        }
        this.#offsetX = event.offsetX;
        this.#offsetY = event.offsetY;
    };
    #onwheel = (event)=>{
        event.preventDefault();
        const scaleChange = 1 + event.deltaY * 0.001;
        if (!event.shiftKey) {
            const x = event.offsetX;
            const newScaleX = this.#position.scaleX * scaleChange;
            if (!newScaleX) {
                return;
            }
            const newOriginX = x * (this.#position.scaleX - newScaleX) + this.#position.originX;
            const posInfo = checkGraphPosition({
                scaleX: newScaleX,
                originX: newOriginX,
                width: this.#position.width
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
            this.#position.originY = y * (newScaleY - this.#position.scaleY) + this.#position.originY;
            this.#position.scaleY = newScaleY;
        }
        this.#shouldRender = true;
    };
    connectedCallback() {
        const table = createElement("table");
        for (const keyName1 of this.#keys){
            table.appendChild(selectGraphDataButton(keyName1, this.#colorRegistry.get(keyName1), {
                onCheck: (v)=>{
                    if (v) {
                        this.#keys.add(keyName1);
                    } else {
                        this.#keys.delete(keyName1);
                    }
                    this.#shouldRender = true;
                },
                onUpdateColor: (v)=>{
                    this.#colorRegistry.set(keyName1, v);
                    this.#shouldRender = true;
                }
            }));
        }
        this.#headerElement = createElement("div", null, null, [
            table
        ]);
        this.appendChild(this.#headerElement);
        this.#canvasElement = document.createElement("canvas");
        this.#canvasElement.height = 0;
        this.#canvasElement.width = 0;
        this.#ctx = this.#canvasElement.getContext("2d", {
            alpha: false,
            desynchronized: true
        });
        this.appendChild(this.#canvasElement);
        this.#footerElement = createElement("div", null, null, [
            "a"
        ]);
        this.appendChild(this.#footerElement);
        const controller = new AbortController();
        this.#list.onUpdate(()=>this.#shouldRender = true
        , controller);
        this.#list.onKeyUpdate((keyName)=>{
            this.#keys.add(keyName);
            table.appendChild(selectGraphDataButton(keyName, this.#colorRegistry.get(keyName), {
                onCheck: (v)=>{
                    if (v) {
                        this.#keys.add(keyName);
                    } else {
                        this.#keys.delete(keyName);
                    }
                    this.#shouldRender = true;
                },
                onUpdateColor: (v)=>{
                    this.#colorRegistry.set(keyName, v);
                    this.#shouldRender = true;
                }
            }));
            const height = this.clientHeight - (this.#headerElement?.clientHeight ?? 0) - (this.#footerElement?.clientHeight ?? 0) - 10;
            this.#position.height = height;
            if (this.#canvasElement) {
                this.#canvasElement.height = height;
            }
        }, controller);
        this.#onDisconnect.push(()=>controller.abort()
        );
        this.#startListeningMoveEvent();
        this.#resizeObserver.observe(this);
    }
    disconnectedCallback() {
        for (const fn of this.#onDisconnect){
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
        this.#onDisconnect.push(()=>{
            this.#canvasElement?.removeEventListener("mousedown", this.#onmousedown);
            globalThis.removeEventListener("mouseup", this.#onmouseup);
            this.#canvasElement?.removeEventListener("mousemove", this.#onmousemove);
            this.#canvasElement?.removeEventListener("wheel", this.#onwheel);
        });
        let isLoop = true;
        this.#onDisconnect.push(()=>{
            isLoop = false;
        });
        await this.#list.requestData();
        const leftPoint = this.#list.first.value?.time;
        const rightPoint = this.#list.last.value?.time;
        const maxPoint = this.#list.getMaxVal(...this.#keys);
        const minPoint = this.#list.getMinVal(...this.#keys);
        if (leftPoint != null && rightPoint != null && maxPoint != null && minPoint != null) {
            this.#position = {
                scaleX: (rightPoint - leftPoint) / this.#position.width,
                scaleY: (maxPoint - minPoint) / this.#position.height,
                originX: leftPoint,
                originY: maxPoint,
                width: this.#position.width,
                height: this.#position.height
            };
            console.log(this.#position);
        } else {
            this.#position = {
                scaleX: 60 * 1000 / this.#position.width,
                scaleY: 2 / this.#position.height,
                originX: Date.now() - 30 * 1000,
                originY: 1,
                width: this.#position.width,
                height: this.#position.height
            };
            this.#startTrackRealtimeData();
        }
        let pointerForFirst;
        let preTime;
        while(isLoop){
            const currentTime = await animationFramePromise();
            if (this.#isTrackingRealtimeData) {
                if (preTime) {
                    this.#position.originX += currentTime - preTime;
                }
                this.#shouldRender = true;
            }
            preTime = currentTime;
            if (this.#shouldRender) {
                const oldestTime = this.#position.originX;
                const latestTime = oldestTime + this.#position.width * this.#position.scaleX;
                const max = this.#position.originY;
                const min = max - this.#position.height * this.#position.scaleY;
                pointerForFirst = this.#list.getElementFromTime(oldestTime, pointerForFirst);
                if (this.#ctx) {
                    {
                        this.#ctx.fillStyle = "white";
                        this.#ctx.fillRect(0, 0, this.#ctx.canvas.width, this.#ctx.canvas.height);
                    }
                    {
                        this.#ctx.textAlign = "start";
                        this.#ctx.fillStyle = "black";
                        this.#ctx.font = "normal 16px sans-serif";
                        const scaleLinesX = getScaleLine(oldestTime, latestTime, this.#position.width);
                        for (const scaleLinePos of scaleLinesX){
                            renderLine(this.#ctx, [
                                this.#valueToCanvasPos([
                                    scaleLinePos,
                                    max
                                ]),
                                this.#valueToCanvasPos([
                                    scaleLinePos,
                                    min
                                ]),
                            ], {
                                strokeStyle: "gray"
                            });
                        }
                        let preTime;
                        for (const scaleLinePos1 of scaleLinesX){
                            const [x, y] = this.#valueToCanvasPos([
                                scaleLinePos1,
                                min
                            ]);
                            this.#ctx.save();
                            this.#ctx.translate(x - 3, y - 3);
                            this.#ctx.rotate(-Math.PI / 2);
                            this.#ctx.translate(-x + 3, -y + 3);
                            this.#ctx.fillText(`${formatUnixTime(roundWithSignificantDigit(scaleLinePos1, 14), preTime)}`, x - 3, y - 3);
                            this.#ctx.restore();
                            preTime = scaleLinePos1;
                        }
                        const scaleLinesY = getScaleLine(min, max, this.#position.height);
                        for (const scaleLinePos2 of scaleLinesY){
                            renderLine(this.#ctx, [
                                this.#valueToCanvasPos([
                                    oldestTime,
                                    scaleLinePos2
                                ]),
                                this.#valueToCanvasPos([
                                    latestTime,
                                    scaleLinePos2
                                ]),
                            ], {
                                strokeStyle: "gray"
                            });
                        }
                        for (const scaleLinePos3 of scaleLinesY){
                            const [x, y] = this.#valueToCanvasPos([
                                oldestTime,
                                scaleLinePos3
                            ]);
                            this.#ctx.fillText(`${roundWithSignificantDigit(scaleLinePos3, 10)}`, x + 3, y - 3);
                        }
                    }
                    {
                        const now = Date.now();
                        renderLine(this.#ctx, [
                            this.#valueToCanvasPos([
                                now,
                                max
                            ]),
                            this.#valueToCanvasPos([
                                now,
                                min
                            ]),
                        ], {
                            strokeStyle: "#00ff00",
                            lineWidth: 2
                        });
                    }
                    if (pointerForFirst) {
                        for (const key of this.#keys){
                            let breakNext = true;
                            renderLine(this.#ctx, iter(DataList.iterate(pointerForFirst)).takeWhile((data3)=>{
                                const shouldBreak = breakNext;
                                breakNext = data3.time < latestTime;
                                return shouldBreak;
                            }).filter((v)=>v[key] != null
                            ).map((v)=>[
                                    v.time,
                                    v[key]
                                ]
                            ).map(this.#valueToCanvasPos.bind(this)), {
                                strokeStyle: this.#colorRegistry.get(key)
                            });
                        }
                    }
                }
                this.#list.requestData({
                    oldestTime: Math.floor(oldestTime),
                    latestTime: Math.ceil(latestTime)
                });
                if (this.#footerElement) {
                    this.#footerElement.innerText = `[${formatUnixTimeToDate(oldestTime)}]`;
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
function selectGraphDataButton(keyName, color, { onCheck , onUpdateColor  }) {
    createElement("input").addEventListener("change", (e)=>{
        e.currentTarget;
    });
    return createElement("tr", null, null, [
        createElement("td", null, null, [
            createElement("label", null, null, [
                createElement("input", {
                    type: "checkbox",
                    checked: true
                }, (e1)=>{
                    e1.addEventListener("change", (e)=>{
                        onCheck(e.currentTarget.checked);
                    });
                }),
                keyName,
            ]),
        ]),
        createElement("td", null, null, [
            createElement("input", {
                type: "color"
            }, (e2)=>{
                e2.value = cssColorToColorCode(color);
                e2.addEventListener("change", (e)=>{
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
    constructor(){
        super();
        this.#resizeObserver = new ResizeObserver(([entry])=>{
            const height = (entry.contentBoxSize?.[0]?.blockSize ?? entry.contentRect.height) - 36;
            const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
            if (this.#canvasElement) {
                this.#canvasElement.height = height;
                this.#canvasElement.width = width;
                if (this.#ctx) {
                    this.#ctx.fillStyle = "white";
                    this.#ctx.fillRect(0, 0, this.#canvasElement.width, this.#canvasElement.height);
                }
            }
        });
    }
    connectedCallback() {
        const shadow = this.attachShadow({
            mode: "closed"
        });
        shadow.appendChild(createElement("link", {
            "rel": "stylesheet",
            "href": new URL("./socket-graph-drower.css", importMeta.url)
        }));
        const input = createElement("input", {
            type: "color"
        });
        input.addEventListener("change", ()=>this.#setColor(input.value)
        );
        const div1 = createElement("div", null, null, [
            input
        ]);
        div1.style.height = "36px";
        shadow.appendChild(div1);
        this.#canvasElement = document.createElement("canvas");
        this.#canvasElement.height = 0;
        this.#canvasElement.width = 0;
        this.#ctx = this.#canvasElement.getContext("2d", {
            alpha: false,
            desynchronized: true
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
    #onmousedown = (event)=>{
        this.#isMouseDown = true;
        this.#ctx?.moveTo(event.offsetX, event.offsetY);
    };
    #onmouseup = (event)=>{
        if (this.#isMouseDown) {
            this.#ctx?.lineTo(event.offsetX, event.offsetY);
        }
        this.#isMouseDown = false;
    };
    #onmousemove = (event)=>{
        if (!this.#isMouseDown) {
            return;
        }
        if (this.#ctx) {
            this.#ctx.lineTo(event.offsetX, event.offsetY);
            this.#ctx.lineWidth = 3;
            this.#ctx.stroke();
        }
    };
    #setColor = (color)=>{
        if (this.#ctx) {
            this.#ctx.strokeStyle = color;
            this.#ctx.beginPath();
        }
    };
}
customElements.define("socket-graph-drower", DrowerElement);
function animationFramePromise() {
    return new Promise((resolve)=>{
        requestAnimationFrame(resolve);
    });
}
function createElement(tagName, attr, cb, children) {
    const element = document.createElement(tagName);
    for (const [k, v] of Object.entries(attr ?? {})){
        element.setAttribute(k, v.toString());
    }
    for (const child of children ?? []){
        element.append(child);
    }
    if (cb) {
        cb(element);
    }
    return element;
}
function renderLine(ctx, data4, option = {}) {
    ctx.beginPath();
    ctx.strokeStyle = option.strokeStyle ?? "black";
    ctx.lineWidth = option.lineWidth ?? 1;
    let isFirst = true;
    for (const [x1, y1] of data4){
        ctx[isFirst ? "moveTo" : "lineTo"](x1, y1);
        isFirst = false;
    }
    ctx.stroke();
}
function getScaleLine(min, max, length) {
    const width50px = (max - min) * 50 / length;
    const digitCount = Math.floor(Math.log10(width50px));
    const highestDigit = width50px / 10 ** digitCount;
    let closestN = 1;
    let distanceToClosestN = Math.abs(highestDigit - 1);
    for (const n of [
        2,
        5
    ]){
        if (Math.abs(highestDigit - n) < distanceToClosestN) {
            closestN = n;
            distanceToClosestN = Math.abs(highestDigit - n);
        }
    }
    const scaleLineWidth = closestN * 10 ** digitCount;
    const minScaleLine = Math.ceil(min / scaleLineWidth) * scaleLineWidth;
    const maxScaleLine = Math.ceil(max / scaleLineWidth) * scaleLineWidth;
    const res = [];
    for(let i = minScaleLine; i < maxScaleLine; i += scaleLineWidth){
        res.push(i);
    }
    return res;
}
function formatUnixTime(time, prevTime) {
    const date = new Date(Math.round(time));
    const ms = Math.round(time % 1000);
    if (prevTime === undefined) {
        if (ms !== 0) {
            return `${zfill(date.getHours(), 2)}:${zfill(date.getMinutes(), 2)}:${zfill(date.getSeconds(), 2)}.${zfill(ms, 4).replace(/0{0,3}$/, "")}`;
        }
        return `${zfill(date.getHours(), 2)}:${zfill(date.getMinutes(), 2)}:${zfill(date.getSeconds(), 2)}`;
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
            return `${zfill(date.getHours(), 2)}:${zfill(date.getMinutes(), 2)}:${zfill(date.getSeconds(), 2)}.${zfill(ms, 4).replace(/0{0,3}$/, "")}`;
        } else {
            return `${zfill(date.getHours(), 2)}:${zfill(date.getMinutes(), 2)}:${zfill(date.getSeconds(), 2)}`;
        }
    } else {
        return `.${zfill(ms, 4).replace(/0{0,3}$/, "")}`;
    }
}
function formatUnixTimeToDate(time) {
    const date = new Date(time);
    return `${zfill(date.getFullYear(), 4)}.${zfill(date.getMonth() + 1, 2)}.${zfill(date.getDate(), 2)} - ${formatUnixTime(time)}`;
}
function zfill(str, digit) {
    return `${"0".repeat(digit)}${str}`.slice(-digit);
}
function roundWithSignificantDigit(n, significantDigit) {
    if (n === 0) {
        return 0;
    } else {
        const d = 10 ** (Math.floor(Math.log10(Math.abs(n))) + significantDigit);
        return Math.round(n * d) / d;
    }
}
function checkGraphPosition({ scaleX , originX , width  }) {
    const latestTime1 = originX + width * scaleX;
    const now = Date.now();
    if (now < latestTime1) {
        const midTime = originX + width * scaleX * 0.5;
        if (now < midTime) {
            const newOriginX = now - width * scaleX * 0.5;
            return {
                trackRealtime: true,
                newOriginX
            };
        } else {
            return {
                trackRealtime: true
            };
        }
    }
    return {
        trackRealtime: false
    };
}
const encoder = new TextEncoder();
function stringToColor(str) {
    const h = encoder.encode(str).reduce((p, c)=>p * c % 360
    );
    return `hsl(${h * h * h % 360}, 100%, 25%)`;
}
const div = document.createElement("div");
document.head.appendChild(div);
function cssColorToColorCode(hslText) {
    div.style.color = hslText;
    const { r , g , b  } = getComputedStyle(div).color.match(/rgb\((?<r>[0-9]*), (?<g>[0-9]*), (?<b>[0-9]*)\)/)?.groups;
    return "#" + [
        r,
        g,
        b
    ].map((v)=>zfill((+v).toString(16), 2)
    ).join("");
}
