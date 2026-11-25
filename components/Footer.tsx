import { Brand } from "./Brand";

export function Footer() {
  return <footer className="site-footer">
    <div className="shell footer-inner">
      <Brand />
      <p>Projeto acadêmico · A3 Sustentabilidade</p>
      <a href="#inicio">Voltar ao início</a>
    </div>
  </footer>;
}
