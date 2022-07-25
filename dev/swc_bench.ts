// 計測用コード

import { transform } from "https://deno.land/x/swc@0.2.1/mod.ts";

const content = await Deno.readTextFile("./serve.ts");
export function tsToJs(content: string) {
  const s = performance.now();
  const res = transform(content, {
    // minify: true,
    jsc: {
      target: "es2021",
      parser: {
        syntax: "typescript",
      },
    },
    // deno-lint-ignore no-explicit-any
  } as any).code;
  const res_ = fixJsImport(res);
  console.log(performance.now() - s);
  return res_;
}

function fixJsImport(fileContent: string): string {
  return fileContent.replace(
    /import { ([a-zA-Z].*) } from "(.*)";/gm,
    (_str, importValues, fileImportedFrom) => {
      const jsImport = fileImportedFrom.replace(".ts", ".js");
      return `import { ${importValues} } from \"${jsImport}\";`;
    },
  ).replace(
    /export { ([a-zA-Z].*) } from "(.*)";/gm,
    (_str, importValues, fileImportedFrom) => {
      const jsImport = fileImportedFrom.replace(".ts", ".js");
      return `export { ${importValues} } from \"${jsImport}\";`;
    },
  ).replace(
    /import \"(.*)\";/gm,
    (_str, importValue) => {
      const jsRef = importValue.replace(".ts", ".js");
      return `import \"${jsRef}\";`;
    },
  ).replace(
    /import\(\"(.*)\"\)/gm,
    (_str, importValue) => {
      const jsRef = importValue.replace(".ts", ".js");
      return `import(\"${jsRef}\")`;
    },
  ).replace(
    /import (.*) from \"(.*)\"/gm,
    (_str, importValue, url) => {
      const jsRef = url.replace(".ts", ".js");
      return `import ${importValue} from \"${jsRef}\"`;
    },
  );
}

const c = tsToJs(content);
for (let i = 0; i < 100; i++) {
  const s = performance.now();
  fixJsImport(c);
  console.log(performance.now() - s);
}
