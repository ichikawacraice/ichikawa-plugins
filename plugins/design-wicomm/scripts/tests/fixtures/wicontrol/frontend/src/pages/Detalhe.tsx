// o escape em OUTRA string não absolve a animação desta
export function Detalhe() {
  return (
    <section>
      <span className="animate-pulse" />
      <span className="motion-reduce:transition-none" />
    </section>
  )
}
