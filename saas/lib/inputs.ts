export class InputError extends Error {}

export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readObject(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new InputError("Envie os dados em JSON.");
  const body = await request.text();
  if (body.length > 10_000) throw new InputError("Dados excedem o tamanho permitido.");

  try {
    const value: unknown = JSON.parse(body);
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    throw new InputError("Dados inválidos.");
  }
  throw new InputError("Dados inválidos.");
}

export function readText(value: unknown, label: string, max: number, optional = false) {
  if (typeof value !== "string" || value.trim().length > max || (!optional && !value.trim())) {
    throw new InputError(`Informe ${label} usando até ${max} caracteres.`);
  }
  return value.trim();
}

export function readNumber(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new InputError(`Informe ${label} entre ${min} e ${max}.`);
  }
  return value;
}
