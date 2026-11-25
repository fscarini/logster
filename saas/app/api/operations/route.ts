import { InputError, readObject } from "../../../lib/inputs";
import { applyOperation, getStore, operations } from "../../../lib/operations";

function respond(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function handle(request?: Request) {
  try {
    const store = await getStore();
    if (!store) return respond({ error: "Entre para acessar sua operação." }, 401);
    if (request) await applyOperation(store, await readObject(request));
    return respond(await operations(store));
  } catch (error) {
    if (error instanceof InputError) return respond({ error: error.message }, 400);
    console.error("Falha ao acessar operação Logster", error);
    return respond({ error: "Não foi possível carregar a operação. Tente novamente." }, 500);
  }
}

export function GET() { return handle(); }
export function POST(request: Request) { return handle(request); }
