import { InputError, readObject, readText } from "../../../lib/inputs";
import { isDemoMode, supabaseClient } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    if (isDemoMode()) return Response.json({ error: "O modo demonstrativo dispensa login." }, { status: 409 });
    const supabase = await supabaseClient();
    if (!supabase) return Response.json({ error: "O acesso ainda precisa ser configurado." }, { status: 503 });
    const input = await readObject(request);
    if (input.action === "logout") {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) return Response.json({ error: "Não foi possível sair da sessão." }, { status: 502 });
      return Response.json({ ok: true });
    }
    if (input.action !== "login") throw new InputError("Operação inválida.");

    const email = readText(input.email, "o e-mail", 254);
    if (typeof input.password !== "string" || input.password.length < 1 || input.password.length > 128) {
      throw new InputError("Informe a senha da conta.");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (error) return Response.json({ error: "Confira o e-mail e a senha e tente novamente." }, { status: 401 });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Não foi possível acessar a conta agora." }, { status: 502 });
  }
}
