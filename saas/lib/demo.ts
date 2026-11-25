import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cookies } from "next/headers";
import { uuid } from "./inputs";
import { HOUR, initialRoutes } from "./model";
import type { Decision, Delivery, FreightRoute } from "./model";
import { demoForecast } from "./risk";
import type { Store } from "./store";

const cookieName = "logster_demo_session";
let database: DatabaseSync | undefined;

function getDatabase() {
  if (database) return database;
  const directory = resolve(process.cwd(), ".data");
  mkdirSync(directory, { recursive: true });
  const connection = new DatabaseSync(resolve(directory, "demo.sqlite"));
  connection.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS demo_items (
      owner TEXT NOT NULL,
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (owner, kind, id)
    );
  `);
  database = connection;
  return connection;
}

export async function demoStore(): Promise<Store> {
  const jar = await cookies();
  const current = jar.get(cookieName)?.value;
  const owner = current && uuid.test(current) ? current : randomUUID();

  if (owner !== current) {
    jar.set(cookieName, owner, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86_400 });
  }

  const db = getDatabase();
  const insert = db.prepare("INSERT OR IGNORE INTO demo_items (owner, kind, id, data) VALUES (?, ?, ?, ?)");
  const read = db.prepare("SELECT data FROM demo_items WHERE owner = ? AND kind = ? ORDER BY rowid");

  function list<T>(kind: string) {
    return read.all(owner, kind).map(row => JSON.parse(String(row.data)) as T);
  }

  const now = Date.now();
  const departures = [4, 4, 12];
  initialRoutes.forEach((route, index) => {
    const delivery: Delivery = {
      id: `00000000-0000-4000-a000-00000000010${index}`,
      route_id: route.id,
      reference: `DEMO-10${index + 1}`,
      departure_at: new Date(now + departures[index] * HOUR).toISOString(),
      hour_cost_cents: [25000, 21000, 28000][index],
    };
    insert.run(owner, "delivery", delivery.id, JSON.stringify(delivery));
  });

  return {
    mode: "demo",
    async load() {
      const routes = [...initialRoutes, ...list<FreightRoute>("route")];
      return {
        routes,
        deliveries: list<Delivery>("delivery"),
        decisions: list<Decision>("decision"),
        forecasts: routes.map(route => demoForecast(route, Date.now())),
      };
    },
    async addRoute(route) { insert.run(owner, "route", route.id, JSON.stringify(route)); },
    async addDelivery(delivery) { insert.run(owner, "delivery", delivery.id, JSON.stringify(delivery)); },
    async recordDecision(decision) { insert.run(owner, "decision", decision.delivery_id, JSON.stringify(decision)); },
  };
}
