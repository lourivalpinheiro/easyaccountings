import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const supabaseUrl = process.env.SUPABASE_URL!;
// Toda interação com o Supabase Auth acontece no servidor.
export const supabaseKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY!;

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Chamado a partir de um Server Component: o proxy renova a sessão.
        }
      },
    },
  });
}

export function createAdminClient() {
  return createSupabaseClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
