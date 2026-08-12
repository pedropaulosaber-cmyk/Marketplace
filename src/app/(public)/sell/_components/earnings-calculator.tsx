'use client';

import { useState } from 'react';
import { formatPrice } from '@/lib/money';

/**
 * Earnings calculator for prospective sellers.
 *
 * The whole pitch of this page is "15%, no monthly fee". A number people can
 * put their own price into is far more convincing than the claim, and it is
 * honest in the direction that matters: the platform fee is shown as a
 * deduction rather than buried, and the affiliate line shows what a creator
 * gives up as well as what it wins them.
 */

const PLATFORM_FEE_BPS = 1500;

/** Presets remove the blank-form problem — most people never fill one in. */
const PRESETS = [
  { label: 'Template', price: 79, sales: 40 },
  { label: 'Automação', price: 149, sales: 25 },
  { label: 'Agente de IA', price: 249, sales: 15 },
] as const;

export function EarningsCalculator() {
  const [price, setPrice] = useState(149);
  const [sales, setSales] = useState(25);
  const [commission, setCommission] = useState(0);

  const priceCents = Math.max(0, Math.round(price * 100));
  const platformCents = Math.round((priceCents * PLATFORM_FEE_BPS) / 10_000);
  const affiliateCents = Math.floor((priceCents * commission * 100) / 10_000);
  const keepCents = Math.max(priceCents - platformCents - affiliateCents, 0);

  const monthly = keepCents * Math.max(0, sales);

  return (
    <div className="rounded-[18px] border border-line bg-white p-7 max-sm:p-5">
      <h3 className="text-[20px] font-extrabold">Quanto você recebe</h3>
      <p className="mt-1 text-[14px] text-muted">
        Coloque o seu preço. A conta é a mesma que aparece no seu painel.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setPrice(preset.price);
              setSales(preset.sales);
            }}
            className="rounded-full border border-line px-[14px] py-[7px] text-[13px] font-semibold text-[#475569] transition-colors hover:border-blue hover:text-blue-700"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5 max-sm:grid-cols-1">
        <label className="flex flex-col gap-2">
          <span className="text-[12.5px] font-bold text-[#334155]">
            Preço do produto
          </span>
          <span className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-[10px]">
            <span className="text-[14px] text-muted">R$</span>
            <input
              type="number"
              min={0}
              max={100_000}
              step={10}
              value={price}
              onChange={(event) => setPrice(Number(event.currentTarget.value))}
              className="w-full border-0 bg-transparent text-[16px] font-bold outline-none"
            />
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[12.5px] font-bold text-[#334155]">
            Vendas por mês
          </span>
          <input
            type="number"
            min={0}
            max={100_000}
            step={5}
            value={sales}
            onChange={(event) => setSales(Number(event.currentTarget.value))}
            className="rounded-[10px] border border-line px-3 py-[10px] text-[16px] font-bold outline-none"
          />
        </label>
      </div>

      <label className="mt-6 flex flex-col gap-2">
        <span className="flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-[#334155]">
            Comissão para afiliados
          </span>
          <span className="text-[13px] font-extrabold text-blue-700">
            {commission}%
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={50}
          step={5}
          value={commission}
          onChange={(event) => setCommission(Number(event.currentTarget.value))}
          className="w-full accent-blue"
          aria-label="Comissão para afiliados, em porcentagem"
        />
        <span className="text-[12.5px] text-muted">
          {commission === 0
            ? 'Sem afiliados: você fica com tudo que sobra da taxa, mas divulga sozinho.'
            : 'Você paga só quando o afiliado vende. Sem venda, custo zero.'}
        </span>
      </label>

      <div className="mt-7 rounded-[14px] bg-bg p-5">
        <p className="text-[12.5px] font-extrabold tracking-[0.1em] text-muted uppercase">
          Por venda
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[32px] leading-none font-extrabold text-ink">
              {formatPrice(keepCents)}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">fica com você</p>
          </div>
          <div>
            <p className="text-[17px] font-bold text-muted">
              −{formatPrice(platformCents)}
            </p>
            <p className="text-[12.5px] text-muted">taxa da plataforma (15%)</p>
          </div>
          {affiliateCents > 0 ? (
            <div>
              <p className="text-[17px] font-bold text-blue-700">
                −{formatPrice(affiliateCents)}
              </p>
              <p className="text-[12.5px] text-muted">comissão do afiliado</p>
            </div>
          ) : null}
        </div>

        <p className="mt-5 border-t border-line pt-4 text-[14.5px]">
          Com {sales} {sales === 1 ? 'venda' : 'vendas'} por mês, isso dá{' '}
          <strong className="text-[17px]">{formatPrice(monthly)}</strong> por mês
          {' '}· {formatPrice(monthly * 12)} por ano.
        </p>
      </div>

      <p className="mt-4 text-[12.5px] leading-[1.6] text-muted">
        Estimativa, não promessa. Volume de venda depende do produto, do preço e
        da sua divulgação — a plataforma não garante resultado.
      </p>
    </div>
  );
}
