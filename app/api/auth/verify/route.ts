import { json, readJson } from "../../_lib/response";
import { verifyCode } from "../../_lib/auth";

export async function POST(request: Request) {
  const body = await readJson(request);
  const result = await verifyCode(String(body?.email || ""), String(body?.code || ""));
  return json(result.data, result.status);
}
