import { Mail, Play } from "lucide-react";

export function Contact() {
  const contactEmail = process.env.NEXT_PUBLIC_LOGSTER_CONTACT_EMAIL;

  return <section className="shell contact-section" id="contato" aria-labelledby="contact-heading">
    <div className="contact-card">
      <div className="contact-photo" aria-hidden="true" />
      <div className="contact-copy">
        <h2 id="contact-heading">Veja a Logster em ação.</h2>
        <p>Explore três rotas simuladas e veja como cada alerta altera o planejamento.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#plataforma"><Play size={15} fill="currentColor" /> Ver demonstração</a>
          {contactEmail && <a className="button button-secondary" href={`mailto:${contactEmail}`}><Mail size={16} /> Fale com a equipe</a>}
        </div>
      </div>
    </div>
  </section>;
}
