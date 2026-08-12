import { cn } from '@/lib/cn';

/**
 * Infinite marquee of solution types, from the Canvas design.
 *
 * The list is rendered twice so the -50% translation loops seamlessly. The
 * whole strip is decorative — the same categories are reachable as real links
 * on /products — so it is hidden from assistive technology rather than
 * announced as fourteen duplicated items. Animation pauses on hover and is
 * disabled entirely under prefers-reduced-motion (see globals.css).
 */

const SOLUTIONS: ReadonlyArray<{ label: string; paths: string[] }> = [
  { label: 'Prompts estratégicos', paths: ['m9 8-4 4 4 4', 'M13 16h6'] },
  { label: 'CRM e funil', paths: ['M3 5h18', 'M6 12h12', 'M10 19h4'] },
  { label: 'Templates', paths: ['M4 4h16v6H4z', 'M4 14h7v6H4z', 'M15 14h5v6h-5z'] },
  { label: 'Landing pages', paths: ['M3 5h18v14H3z', 'M3 9h18'] },
  { label: 'Chatbots', paths: ['M4 5h16v11H9l-5 4z'] },
  {
    label: 'Agentes de IA',
    paths: ['M12 3v4', 'M7 7h10v10H7z', 'M4 12h3', 'M17 12h3', 'M10 21v-4', 'M14 21v-4'],
  },
  {
    label: 'Workflows n8n',
    paths: ['M4 7h6', 'M14 7h6', 'M4 17h6', 'M14 17h6', 'M10 7v10'],
  },
  { label: 'Automações Make', paths: ['M12 3v18', 'M3 12h18'] },
  { label: 'Atendimento no WhatsApp', paths: ['M4 5h16v11H9l-5 4z', 'M9 10h6'] },
  { label: 'Geração de conteúdo', paths: ['M4 6h16', 'M4 12h10', 'M4 18h7'] },
  { label: 'Análise de dados', paths: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'] },
  { label: 'Integrações e APIs', paths: ['M9 7 5 11l4 4', 'm15 7 4 4-4 4'] },
];

export function SolutionMarquee() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative mt-16 overflow-hidden border-y border-line bg-bg py-[26px] max-sm:mt-10',
        // Edge fades so items enter and leave rather than being cut off.
        'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-2 before:w-[120px]',
        'before:bg-gradient-to-r before:from-bg before:to-transparent',
        'after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-2 after:w-[120px]',
        'after:bg-gradient-to-l after:from-bg after:to-transparent',
        'group'
      )}
    >
      <div className="marquee-track group-hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex">
            {SOLUTIONS.map((item) => (
              <span
                key={`${copy}-${item.label}`}
                className="mr-3 flex items-center gap-[10px] rounded-full border border-line bg-white px-5 py-[11px] text-[15px] font-semibold whitespace-nowrap"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-none text-blue"
                >
                  {item.paths.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
                {item.label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
