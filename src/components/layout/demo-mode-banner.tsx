/**
 * Slim notice shown site-wide while no database is configured.
 *
 * Every listing and detail page falls back to fictional content in this
 * state (`src/lib/demo-data.ts`) so the site never looks empty — but showing
 * fabricated products, creators and demands without saying so would be
 * dishonest the moment a real visitor tried to act on one of them. One
 * banner, defined once, is cheaper to keep truthful than a label repeated on
 * every card.
 */
export function DemoModeBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[12.5px] font-semibold text-amber-900">
      Catálogo de demonstração — os produtos, criadores e demandas abaixo são
      ilustrativos até o banco de dados ser conectado.
    </div>
  );
}
