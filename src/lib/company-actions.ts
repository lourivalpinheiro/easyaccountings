"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { COMPANY_COOKIE } from "@/lib/company";

export async function setActiveCompany(companyId: string) {
  await requireUser();
  const cookieStore = await cookies();
  cookieStore.set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
