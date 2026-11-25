import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logster | Inteligência climática para logística rodoviária",
  description: "Veja quais rotas de carga podem ser afetadas pelo clima nas próximas 72 horas, estime o impacto e compare alternativas.",
  icons: "/logster-mark.svg",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
