import { isDemoMode, supabaseClient } from "../../../../lib/supabase";

// Login por formulário HTML enviado da landing page (POST de navegação, não fetch).
// Assim o cookie de sessão é criado na origem do SaaS como cookie primário, sem CORS
// nem cookies de terceiros. O cabeçalho Origin é verificado para impedir login CSRF.

function landingUrl() {
  const value = process.env.NEXT_PUBLIC_LOGSTER_LANDING_URL;
  try { return value ? new URL(value) : null; } catch { return null; }
}

function redirect(location: URL | string) {
  return new Response(null, { status: 303, headers: { Location: String(location), "Cache-Control": "no-store" } });
}

function backToLogin(request: Request, reason: "erro" | "invalido" | "indisponivel") {
  const landing = landingUrl();
  const target = landing ? new URL("/", landing) : new URL("/", request.url);
  target.searchParams.set("login", reason);
  if (landing) target.hash = "entrar";
  return redirect(target);
}

export async function POST(request: Request) {
  const appOrigin = new URL(request.url).origin;
  const allowed = new Set([appOrigin, landingUrl()?.origin].filter(Boolean));
  const origin = request.headers.get("origin");
  if (!origin || !allowed.has(origin)) {
    return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  }

  if (isDemoMode()) return redirect(new URL("/", request.url));

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded") && !contentType.startsWith("multipart/form-data")) {
    return backToLogin(request, "invalido");
  }

  let email = "";
  let password = "";
  try {
    const form = await request.formData();
    email = String(form.get("email") ?? "").trim();
    password = String(form.get("password") ?? "");
  } catch {
    return backToLogin(request, "invalido");
  }
  if (!email || email.length > 254 || !password || password.length > 128) return backToLogin(request, "invalido");

  const supabase = await supabaseClient();
  if (!supabase) return backToLogin(request, "indisponivel");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return backToLogin(request, error.status === 400 || error.status === 401 ? "erro" : "indisponivel");

  return redirect(new URL("/", request.url));
}
