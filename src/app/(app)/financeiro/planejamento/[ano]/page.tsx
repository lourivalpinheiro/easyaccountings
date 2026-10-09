import { redirect } from "next/navigation";

export default async function PlanYearPage({ params }: PageProps<"/financeiro/planejamento/[ano]">) {
  const { ano } = await params;
  redirect(`/financeiro/planejamento/${ano}/diagnostico`);
}
