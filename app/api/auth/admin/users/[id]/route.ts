import { prisma } from "@/lib/prisma";
import { json } from "../../../../_lib/response";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const userId = Number(id);
  await prisma.$transaction(async (tx) => {
    const jobs = await tx.job.findMany({ where: { employerId: userId }, select: { id: true } });
    const jobIds = jobs.map((job) => job.id);
    if (jobIds.length) await tx.jobApplication.deleteMany({ where: { jobId: { in: jobIds } } });
    await tx.jobApplication.deleteMany({ where: { candidateId: userId } });
    await tx.savedJob.deleteMany({ where: { candidateId: userId } });
    await tx.chatMessage.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
    await tx.studyPlan.deleteMany({ where: { userId } });
    await tx.paymentOrder.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
    await tx.job.deleteMany({ where: { employerId: userId } });
    await tx.user.delete({ where: { id: userId } });
  });
  return json({ success: true });
}
