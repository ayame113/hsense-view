import { router } from "../router.ts";
import { database } from "../../db/mod.ts";

const DATA_DELETE_CYCLE = 7 * 24 * 60 * 60 * 1000;

router.GET.set(
  new URLPattern({ pathname: "/api/create_token/:id" }),
  async ({ match: { pathname: { groups: { id } } } }) => {
    const token = await database.createToken(id).catch(() => null);
    return {
      body: JSON.stringify({ success: token != null, token }),
      type: ".json",
    };
  },
);

function stringToInt(str: string | null) {
  if (!str) {
    return;
  }
  const n = parseInt(str);
  if (Number.isFinite(n)) {
    return n;
  }
}

router.GET.set(
  new URLPattern({ pathname: "/api/data/:id" }),
  async (
    { match: { pathname: { groups: { id } } }, url: { searchParams } },
  ) => {
    const limit = stringToInt(searchParams.get("limit"));
    const fromTime = stringToInt(searchParams.get("fromTime"));
    const data = await database.getDataByLimit(id, { limit, fromTime })
      .catch(() => null);
    return {
      body: JSON.stringify({ success: data != null, data }),
      type: ".json",
    };
  },
);

router.GET.set(
  new URLPattern({ pathname: "/api/delete_old_data" }),
  async () => {
    const time = Date.now() - DATA_DELETE_CYCLE;
    const success = await database.deleteDataByTime(time)
      .then(() => true, () => false);
    return {
      body: JSON.stringify({ success }),
      type: ".json",
    };
  },
);
