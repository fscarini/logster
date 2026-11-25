import { getStore } from "../../../../lib/operations";
import { planRoute } from "../../../../lib/roads";

export async function GET(request: Request) {
  if (!await getStore()) return Response.json({ error: "Entre para acessar o catálogo." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const from = Number(params.get("from"));
  const to = Number(params.get("to"));
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) {
    return Response.json({ error: "Escolha cidades diferentes para origem e destino." }, { status: 400 });
  }
  const plan = planRoute(from, to);
  if (!plan) return Response.json({ error: "Não há ligação pela malha rodoviária federal entre essas cidades." }, { status: 404 });
  return Response.json(plan, { headers: { "Cache-Control": "private, max-age=3600" } });
}
