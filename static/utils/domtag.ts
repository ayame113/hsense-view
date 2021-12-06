type ValueOrArray<T> = T | T[];

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
  ...expressions: ReadonlyArray<ValueOrArray<string | DomTag>>
) {
  return new DomTag(template, ...expressions);
}

export class DomTag {
  #text: string;
  constructor(
    template: TemplateStringsArray,
    ...expressions: ReadonlyArray<ValueOrArray<string | DomTag>>
  ) {
    this.#text = "";
    const len = expressions.length;
    for (let i = 0; i < len; i++) {
      this.#text += template[i];
      const expr = expressions[i];
      this.#text += Array.isArray(expr)
        ? expr.map((v) => v instanceof DomTag ? v : escapeHTML(v)).join("")
        : (expr instanceof DomTag ? expr : escapeHTML(expr));
    }
    this.#text += template[len];
  }
  toString() {
    return this.#text;
  }
}
