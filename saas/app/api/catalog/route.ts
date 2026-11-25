import { getStore } from "../../../lib/operations";
import { catalogSource, cities } from "../../../lib/roads";

export async function GET() {
  if (!await getStore()) return Response.json({ error: "Entre para acessar o catálogo." }, { status: 401 });
  return Response.json({ ...catalogSource, cities: cities() }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
