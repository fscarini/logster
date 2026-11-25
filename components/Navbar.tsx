"use client";

import { LoaderCircle, LogIn, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Brand } from "./Brand";

const links = [
  { href: "#plataforma", name: "Plataforma" },
  { href: "#recursos", name: "Recursos" },
  { href: "#como-funciona", name: "Como funciona" },
  { href: "#indicadores", name: "Indicadores" },
];

// Endereço do SaaS. O formulário envia as credenciais direto para ele (POST de navegação),
// que cria a sessão na própria origem e abre o painel.
const appUrl = process.env.NEXT_PUBLIC_LOGSTER_APP_URL?.replace(/\/+$/, "");

const loginMessages: Record<string, { text: string; tone: "error" | "info" }> = {
  erro: { text: "E-mail ou senha incorretos. Confira e tente novamente.", tone: "error" },
  invalido: { text: "Preencha e-mail e senha para entrar.", tone: "error" },
  indisponivel: { text: "Não foi possível acessar a conta agora. Tente novamente em instantes.", tone: "error" },
  expirada: { text: "Sua sessão expirou. Entre novamente para continuar.", tone: "info" },
  entrar: { text: "Entre com sua conta para acessar o painel de operações.", tone: "info" },
};

export function Navbar() {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  // Abre o login quando o SaaS devolve o usuário para cá (?login=…#entrar) e limpa a URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    const reason = url.searchParams.get("login");
    if (!reason && url.hash !== "#entrar") return;
    setMessage(reason ? loginMessages[reason] ?? null : null);
    url.searchParams.delete("login");
    if (url.hash === "#entrar") url.hash = "";
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    dialog.current?.showModal();
  }, []);

  // Ao voltar pelo histórico do navegador, a página pode ser restaurada com o botão travado.
  useEffect(() => {
    const reset = () => setSubmitting(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  useEffect(() => {
    if (!expanded) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
        document.getElementById("nav-toggle")?.focus();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [expanded]);

  function openLogin() {
    setExpanded(false);
    setMessage(null);
    dialog.current?.showModal();
  }

  return <header className="site-header">
    <div className="shell nav-inner">
      <Brand />
      <nav id="primary-navigation" aria-label="Navegação principal" data-expanded={expanded}>
        {links.map(link => <a key={link.href} href={link.href} onClick={() => setExpanded(false)}>{link.name}</a>)}
      </nav>
      <div className="nav-actions">
        <button type="button" className="nav-login" onClick={openLogin}><LogIn size={16} /> Entrar</button>
        <a className="button button-primary nav-demo" href="#plataforma">Ver demonstração</a>
        <button id="nav-toggle" type="button" className="nav-toggle" aria-label={expanded ? "Fechar menu" : "Abrir menu"} aria-controls="primary-navigation" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
    </div>
    <dialog ref={dialog} className="login-dialog" aria-labelledby="login-heading" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="login-content">
        <form method="dialog"><button type="submit" className="close-dialog" aria-label="Fechar aviso"><X size={20} /></button></form>
        <div className="icon-box"><LogIn size={22} /></div>
        <h2 id="login-heading">Acesso à plataforma</h2>
        {appUrl ? <>
          <p>Entre com a conta da sua operação para abrir o painel.</p>
          {message && <p className={`login-message ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>}
          <form className="login-form" method="post" action={`${appUrl}/api/session/form`} onSubmit={() => setSubmitting(true)}>
            <label>E-mail <input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
            <label>Senha <input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
            <button type="submit" className="button button-primary" aria-disabled={submitting}>
              {submitting ? <><LoaderCircle size={17} className="spin" /> Entrando…</> : <><LogIn size={17} /> Entrar</>}
            </button>
          </form>
          <a className="login-demo" href="#plataforma" onClick={() => dialog.current?.close()}>Prefere conhecer antes? Ver demonstração</a>
        </> : <>
          <p>A área de login da Logster está em desenvolvimento. Você já pode explorar a prévia do painel.</p>
          <a className="button button-primary" href="#plataforma" onClick={() => dialog.current?.close()}>Ver demonstração</a>
        </>}
      </div>
    </dialog>
  </header>;
}
