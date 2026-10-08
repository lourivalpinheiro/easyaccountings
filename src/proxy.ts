import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  TWO_FACTOR_COOKIE,
  hasPasswordAmr,
  isTwoFactorCookieValid,
} from "@/lib/auth/two-factor-cookie";

const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/auth/callback"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, httpOnly: true }),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const path = request.nextUrl.pathname;

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) return response;

  if (!claims) return redirect("/login");

  // Sessão aberta por link de recuperação: só pode redefinir a senha.
  if (!hasPasswordAmr(claims.amr)) {
    return path.startsWith("/redefinir-senha") ? response : redirect("/login");
  }

  const verified = isTwoFactorCookieValid(
    request.cookies.get(TWO_FACTOR_COOKIE)?.value,
    claims.session_id as string | undefined,
  );
  if (!verified && !path.startsWith("/verificacao")) return redirect("/verificacao");
  if (verified && path.startsWith("/verificacao")) return redirect("/");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
