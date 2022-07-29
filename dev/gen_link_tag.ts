const STATIC_FILE_ROOT =
  "file:///C:/Users/azusa/work/deno/socket-graph/static/";
const FRONTEND_ENTRY_POINT = new URL(
  "./component/socket-graph-data.ts",
  STATIC_FILE_ROOT,
);
import { createGraph } from "https://deno.land/x/deno_graph@0.29.0/mod.ts";

const graph = await createGraph(FRONTEND_ENTRY_POINT.toString());

console.log(
  graph.modules
    .map(({ specifier }) => specifier.replace(STATIC_FILE_ROOT, "/"))
    .map((s) => `<link rel="preload" href="${s}" as="script" crossorigin>`)
    .join("\n"),
);

/*
<link rel="preload" href="/component/data_list.ts" as="script" crossorigin>
<link rel="preload" href="/component/socket-graph-data.ts" as="script" crossorigin>
<link rel="preload" href="/utils/iter.ts" as="script" crossorigin>
<link rel="preload" href="/utils/list.ts" as="script" crossorigin>
*/
