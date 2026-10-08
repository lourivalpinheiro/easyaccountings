import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { companies } from "@/db/schema";

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/** Código do link público: 24 bytes aleatórios (192 bits), impossível de adivinhar. */
export function newPublicToken() {
  return randomBytes(24).toString("base64url");
}

/** Empresa publicada pelo código do link; 404 se o código não existir ou a empresa estiver privada. */
export const getPublishedCompany = cache(async (token: string) => {
  if (!TOKEN_RE.test(token)) notFound();
  const [company] = await db.select().from(companies).where(eq(companies.publicToken, token));
  if (!company) notFound();
  return company;
});
