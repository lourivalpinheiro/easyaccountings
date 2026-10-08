/**
 * Cria o primeiro administrador do sistema.
 * Uso: npm run create-admin -- "Nome Completo" email@dominio.com
 * A senha é solicitada no terminal (não fica no histórico do shell).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

config({ path: ".env.local" });

async function askHidden(question: string) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
    write.call(rl, s.startsWith(question) ? s : "*".repeat(s.length ? 1 : 0));
  };
  const answer = await rl.question(question);
  rl.close();
  stdout.write("\n");
  return answer;
}

async function main() {
  const [name, email] = process.argv.slice(2);
  if (!name || !email) {
    console.error('Uso: npm run create-admin -- "Nome Completo" email@dominio.com');
    process.exit(1);
  }
  const password = process.env.ADMIN_PASSWORD || (await askHidden("Senha (mín. 8 caracteres): "));
  if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Falha ao criar usuário.");

  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  await sql`insert into profiles (id, name, email, role) values (${data.user.id}, ${name}, ${email.toLowerCase()}, 'admin')`;
  await sql.end();
  console.log(`Administrador ${email} criado.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
