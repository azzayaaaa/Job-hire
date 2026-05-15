import { prisma } from "@/lib/prisma";
import { error, json, readJson } from "../../../_lib/response";
import { addDays, addMonths } from "../../../_lib/users";

export async function POST(request: Request) {
  const body = await readJson(request);
  const userId = Number(body?.userId);
  const plan = String(body?.plan || "");
  const duration = String(body?.duration || "ONE_MONTH");
  if (!Number.isInteger(userId)) return error("Invalid userId", 400);

  const now = new Date();
  const data =
    plan === "FREE"
      ? { subscriptionPlan: "FREE", subscriptionExpiresAt: null }
      : duration === "UNTIL_CHANGED"
        ? { subscriptionPlan: "PRO_UNTIL_CHANGED", subscriptionExpiresAt: null }
        : {
            subscriptionPlan: "PRO_MONTHLY",
            subscriptionExpiresAt: duration === "SEVEN_DAYS" ? addDays(now, 7) : addMonths(now, 1),
          };

  const user = await prisma.user.update({ where: { id: userId }, data });
  return json({ success: true, user });
}
