import { CloudLightning } from "lucide-react";

export function Problem() {
  return <section className="section shell problem" aria-labelledby="problem-heading">
    <div className="problem-photo" role="img" aria-label="Caminhão em uma rodovia de serra molhada ao anoitecer">
      <span><CloudLightning size={16} /> Clima e transporte rodoviário</span>
    </div>
    <div className="problem-copy reveal">
      <p className="eyebrow">O desafio</p>
      <h2 id="problem-heading">Quando a estrada para, o custo continua.</h2>
      <p>Uma chuva intensa pode alagar um trecho ou interditar uma rodovia. Para quem planeja as entregas, descobrir o bloqueio tarde demais significa reorganizar horários, rever rotas e absorver custos de espera.</p>
      <p>A Logster cruza alertas climáticos com as rotas da operação para ajudar a decidir antes de despachar a carga.</p>
    </div>
  </section>;
}
