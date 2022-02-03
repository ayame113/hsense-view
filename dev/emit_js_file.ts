import { transform } from "https://deno.land/x/swc@0.1.4/mod.ts";
import { createGraph } from "https://deno.land/x/deno_graph@0.22.0/mod.ts";
const STATIC_FILE_ROOT =
  "file:///C:/Users/azusa/work/deno/socket-graph/static/";
const FRONTEND_ENTRY_POINT = new URL(
  "./component/socket-graph-data.ts",
  STATIC_FILE_ROOT,
);

const graph = await createGraph(FRONTEND_ENTRY_POINT.toString());

function tsToJs(content: string) {
  return transform(content, {
    // minify: true,
    jsc: {
      target: "es2021",
      parser: {
        syntax: "typescript",
      },
    },
    // deno-lint-ignore no-explicit-any
  } as any).code;
}

for (const { specifier } of graph.modules) {
  const jsCode = await Deno.readTextFile(new URL(specifier));
  const tsCode = tsToJs(jsCode);
  await Deno.writeTextFile(
    new URL(
      specifier.replace(STATIC_FILE_ROOT, `${STATIC_FILE_ROOT}js/`)
        .replace(/.ts$/, ".js"),
    ),
    tsCode,
  );
}
