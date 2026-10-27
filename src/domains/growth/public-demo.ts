import { DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { prisma } from "@/services/prisma/client";

export async function readPublicDemoEntry(): Promise<{ available: true; href: string } | { available: false }> {
  const account = await prisma.user.findFirst({
    where: {
      email: DEMO_LOGIN_EMAIL,
      status: "ACTIVE",
      company: { isDemo: true, status: { in: ["ACTIVE", "TRIAL"] } },
    },
    select: { id: true },
  });
  if (!account) return { available: false };
  return { available: true, href: `/login?email=${encodeURIComponent(DEMO_LOGIN_EMAIL)}` };
}
