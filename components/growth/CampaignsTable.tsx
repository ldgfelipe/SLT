import React from 'react';
import { BarChart3, Megaphone } from 'lucide-react';
import type { Campaign } from '@/types/database';

export interface CampaignTableRow extends Campaign {
  clientName: string;
}

interface CampaignsTableProps {
  campaigns: CampaignTableRow[];
}

function money(value: number): string {
  return `$${Number(value || 0).toLocaleString('es-MX', {
    maximumFractionDigits: 2,
  })}`;
}

function number(value: number): string {
  return Number(value || 0).toLocaleString('es-MX');
}

function roas(campaign: Campaign): string {
  if (!campaign.spend || campaign.spend <= 0) return '—';
  if (!campaign.revenue || campaign.revenue <= 0) return '—';
  return `${(campaign.revenue / campaign.spend).toFixed(2)}x`;
}

function statusStyle(status: string): string {
  const value = status.toLowerCase();
  if (value === 'active') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  if (value === 'paused') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-white/10 bg-[#0c1f3d]/60 px-6 py-14 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00d4ff]/10 text-[#00d4ff]">
          <Megaphone className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-white">
          Sin campañas sincronizadas
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
          Conecta una cuenta de Facebook y pulsa “Sincronizar Meta Ads” para
          traer gasto, impresiones, leads y ROAS del ad account.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1f3d]/50">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Campaña</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 text-right font-semibold">Gasto</th>
              <th className="px-4 py-3 text-right font-semibold">Impresiones</th>
              <th className="px-4 py-3 text-right font-semibold">Leads</th>
              <th className="px-4 py-3 text-right font-semibold">ROAS</th>
              <th className="px-4 py-3 text-right font-semibold">Visitas</th>
              <th className="px-4 py-3 font-semibold">UTM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {campaigns.map((campaign) => (
              <tr
                key={campaign.id}
                className="transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#00d4ff]">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="max-w-[260px] truncate text-xs font-semibold text-white">
                        {campaign.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${statusStyle(
                            campaign.status
                          )}`}
                        >
                          {campaign.status}
                        </span>
                        {campaign.objective && (
                          <span className="text-[9px] text-slate-500">
                            {campaign.objective}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">
                  {campaign.clientName}
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-white">
                  {money(campaign.spend)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-300">
                  {number(campaign.impressions)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-300">
                  {number(campaign.leads)}
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-300">
                  {roas(campaign)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2 py-0.5 text-[11px] font-semibold text-[#00d4ff]">
                    {number(campaign.visits)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <code className="block max-w-[200px] truncate rounded bg-black/20 px-2 py-1 text-[10px] text-slate-400">
                    {campaign.name}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
