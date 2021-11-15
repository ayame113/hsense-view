import { router } from "../router.ts";

router.GET.set("/api/test", () => ({ body: "[API test]", type: ".html" }));

router.GET.set(
  new URLPattern({ pathname: "/api/test/:message" }),
  ({ match: { pathname: { groups: { message } } } }) => ({
    body: `[API test]: ${message}`,
    type: ".html",
  }),
);
