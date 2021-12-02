import { router } from "../router.ts";
import { html } from "../../static/utils/domtag.ts";

import { meta } from "./components/meta.ts";

router.GET.set(
  "/",
  ({ request }) => ({
    body: html`<!DOCTYPE html>
      <html lang="ja" dir="ltr">
        <head>
          ${
      meta({
        title: "socket graph",
        description: "socket graph",
        fullPathUrl: request.url,
        fullPathImageUrl: `${new URL("favicon.png", request.url)}`,
        twitterUser: `@`,
      })
    }
          <script src="/ws_listen.js" type="module" charset="utf-8"></script>
        </head>
        <body>
          <div id="ws-error-output"></div>
          <div id="ws-output"></div>
        </body>
      </html>`,
    type: ".html",
  }),
);
