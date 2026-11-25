import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { Problem } from "../components/Problem";
import { Features } from "../components/Features";
import { HowItWorks } from "../components/HowItWorks";
import { SuccessMetrics } from "../components/SuccessMetrics";
import { Contact } from "../components/Contact";
import { Footer } from "../components/Footer";

export default function Home() {
  return <>
    <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
    <Navbar />
    <main id="conteudo">
      <Hero />
      <Problem />
      <Features />
      <HowItWorks />
      <SuccessMetrics />
      <Contact />
    </main>
    <Footer />
  </>;
}
