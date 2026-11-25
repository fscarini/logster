"use client";

import { LogIn, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Brand } from "./Brand";

const links = [
  { href: "#plataforma", name: "Plataforma" },
  { href: "#recursos", name: "Recursos" },
  { href: "#como-funciona", name: "Como funciona" },
];

export function Navbar() {
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const loginUrl = process.env.NEXT_PUBLIC_LOGSTER_LOGIN_URL;

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
    dialog.current?.showModal();
  }

  return <header className="site-header">
    <div className="shell nav-inner">
      <Brand />
      <nav id="primary-navigation" aria-label="Navegação principal" data-expanded={expanded}>
        {links.map(link => <a key={link.href} href={link.href} onClick={() => setExpanded(false)}>{link.name}</a>)}
      </nav>
      <div className="nav-actions">
        {loginUrl ? <a className="nav-login" href={loginUrl}><LogIn size={16} /> Entrar</a>
          : <button type="button" className="nav-login" onClick={openLogin}><LogIn size={16} /> Entrar</button>}
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
        <p>A área de login da Logster está em desenvolvimento. Você já pode explorar a prévia do painel.</p>
        <a className="button button-primary" href="#plataforma" onClick={() => dialog.current?.close()}>Ver demonstração</a>
      </div>
    </dialog>
  </header>;
}
