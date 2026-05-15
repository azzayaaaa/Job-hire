import { json, readJson } from "../../_lib/response";
import { registerUser } from "../../_lib/auth";

export async function POST(request: Request) {
  const result = await registerUser(await readJson(request));
  return json(result.data, result.status);
}
