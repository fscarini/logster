import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logster | Painel de operações",
  description: "Planejamento rodoviário com alertas climáticos e estimativas de impacto.",
  icons: "/logster-mark.svg",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
