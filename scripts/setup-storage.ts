/**
 * Cria (se não existirem) os buckets de Storage usados pelo app.
 * Uso: npm run setup-storage
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(listError.message);
  const names = new Set(existing.map((b) => b.name));

  const buckets: { name: string; public: boolean }[] = [
    { name: "avatars", public: true },
    { name: "anexos", public: false },
  ];

  for (const b of buckets) {
    if (names.has(b.name)) {
      console.log(`Bucket "${b.name}" já existe.`);
      continue;
    }
    const { error } = await supabase.storage.createBucket(b.name, { public: b.public });
    if (error) throw new Error(`Falha ao criar bucket "${b.name}": ${error.message}`);
    console.log(`Bucket "${b.name}" criado (${b.public ? "público" : "privado"}).`);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
