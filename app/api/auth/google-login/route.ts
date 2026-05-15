import { json, readJson } from "../../_lib/response";
import { googleLoginUser } from "../../_lib/auth";

export async function POST(request: Request) {
  const result = await googleLoginUser(await readJson(request));
  return json(result.data, result.status);
}
