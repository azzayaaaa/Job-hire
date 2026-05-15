import { json, readJson } from "../../_lib/response";
import { loginUser } from "../../_lib/auth";

export async function POST(request: Request) {
  const body = await readJson(request);
  const result = await loginUser(String(body?.email || ""), String(body?.password || ""));
  return json(result.data, result.status);
}
