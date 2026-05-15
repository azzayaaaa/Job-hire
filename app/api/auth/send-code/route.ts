import { json, readJson } from "../../_lib/response";
import { sendCode } from "../../_lib/auth";

export async function POST(request: Request) {
  const body = await readJson(request);
  const result = await sendCode(String(body?.email || ""));
  return json(result.data, result.status);
}
