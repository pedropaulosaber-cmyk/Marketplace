import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Dashboard building blocks: page headers, KPI tiles, tables and the revenue
 * chart. Shared between the seller dashboard and the admin panel so both read
 * as one product.
 */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-6 max-sm:flex-col max-sm:gap-4">
      <div>
        <h1 className="text-[30px] leading-tight font-extrabold max-sm:text-[24px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[68ch] text-[14.5px] leading-[1.6] text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </header>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  delta,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-5">
      <p className="text-[12px] font-bold text-muted">{label}</p>
      <p className="mt-2 text-[26px] leading-none font-extrabold">{value}</p>
      {delta ? (
        <p
          className={cn(
            'mt-2 text-[12.5px] font-semibold',
            tone === 'up' && 'text-ok-fg',
            tone === 'down' && 'text-warn-fg',
            tone === 'neutral' && 'text-muted'
          )}
        >
          {delta}
        </p>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('mt-8 rounded-[14px] border border-line bg-white', className)}
    >
      {title ? (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[16px] font-extrabold">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] text-muted">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Accessible data table with a scroll container for narrow screens. */
export function DataTable({
  caption,
  headers,
  children,
  minWidth = 720,
}: {
  caption: string;
  headers: readonly string[];
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse"
        style={{ minWidth: `${minWidth}px` }}
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="border-b border-line px-[14px] py-[10px] text-left text-[11.5px] font-extrabold tracking-[0.1em] text-muted uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  bold,
  muted,
  className,
}: {
  children: ReactNode;
  bold?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'border-b border-line p-[14px] text-[13.5px]',
        bold && 'font-bold',
        muted && 'text-muted',
        className
      )}
    >
      {children}
    </td>
  );
}

/**
 * Revenue sparkline.
 *
 * Rendered as inline SVG on the server — no charting library ships to the
 * browser. The underlying numbers are also exposed as a visually hidden table
 * so the chart is not the only way to read the data.
 */
export function RevenueChart({
  points,
  formatValue,
  height = 220,
}: {
  points: Array<{ label: string; cents: number }>;
  formatValue: (cents: number) => string;
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <p className="py-12 text-center text-[14px] text-muted">
        Ainda não há vendas para exibir.
      </p>
    );
  }

  const width = 720;
  const padLeft = 56;
  const padTop = 12;
  const padBottom = 34;
  const innerWidth = width - padLeft - 16;
  const innerHeight = height - padTop - padBottom;

  const maxValue = Math.max(...points.map((p) => p.cents), 1);
  // Round the axis up so the peak never touches the top edge.
  const ceiling = Math.ceil((maxValue * 1.15) / 100) * 100;

  const coords = points.map((point, index) => ({
    ...point,
    x:
      padLeft +
      (points.length === 1
        ? innerWidth / 2
        : (innerWidth * index) / (points.length - 1)),
    y: padTop + innerHeight - (point.cents / ceiling) * innerHeight,
  }));

  const line = coords
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const area =
    `${line} L${coords[coords.length - 1]!.x.toFixed(1)} ${padTop + innerHeight} ` +
    `L${coords[0]!.x.toFixed(1)} ${padTop + innerHeight} Z`;

  const gridLines = [0, 1, 2, 3, 4].map((i) => ({
    y: padTop + (innerHeight * i) / 4,
    label: formatValue(Math.round(ceiling - (ceiling * i) / 4)),
  }));

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Evolução da receita por mês"
      >
        <defs>
          <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((grid) => (
          <g key={grid.y}>
            <line
              x1={padLeft}
              y1={grid.y}
              x2={width - 16}
              y2={grid.y}
              stroke="#E2E8F0"
              strokeWidth="1"
            />
            <text
              x={padLeft - 10}
              y={grid.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="#94A3B8"
            >
              {grid.label}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#revenue-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coords.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="3.4" fill="#2563EB" />
            <text
              x={point.x}
              y={height - 12}
              textAnchor="middle"
              fontSize="10.5"
              fill="#64748B"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Same data, readable by screen readers and by anyone who cannot
          interpret the line. */}
      <table className="sr-only">
        <caption>Receita por mês</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Receita</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <td>{point.label}</td>
              <td>{formatValue(point.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
