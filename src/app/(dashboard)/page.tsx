'use client';

import Link from 'next/link';
import { LABS } from '@/lib/constants';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Monitor,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Activity,
  Wrench,
  BarChart3,
  Clock,
} from 'lucide-react';

interface LabSummary {
  lab_id: number;
  total: number;
  ok: number;
  maintenance: number;
}

export default function DashboardPage() {
  const [labSummaries, setLabSummaries] = useState<LabSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>('');
  const supabase = createClient();

  useEffect(() => {
    fetchSummaries();
    setLastSync(new Date().toLocaleTimeString());

    // Debounced refetch for real-time
    let timer: NodeJS.Timeout;
    
    const channel = supabase
      .channel('pc-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pc_status' },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            fetchSummaries();
            setLastSync(new Date().toLocaleTimeString());
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSummaries() {
    const { data, error } = await supabase.from('lab_summary_view').select('*');

    if (error) {
      console.error('Error fetching Lab summaries:', error);
      setLoading(false);
      return;
    }

    const summaries: LabSummary[] = LABS.map((lab) => {
      const dbSummary = (data || []).find((s) => s.lab_id === lab.id);
      
      return {
        lab_id: lab.id,
        total: lab.pcs.length,
        ok: dbSummary ? dbSummary.ok : lab.pcs.length,
        maintenance: dbSummary ? dbSummary.maintenance : 0,
      };
    });

    setLabSummaries(summaries);
    setLoading(false);
  }

  const totalPcs = labSummaries.reduce((a, b) => a + b.total, 0);
  const totalOk = labSummaries.reduce((a, b) => a + b.ok, 0);
  const totalMaint = labSummaries.reduce((a, b) => a + b.maintenance, 0);
  const globalHealth = totalPcs > 0 ? Math.round((totalOk / totalPcs) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-surface-950 dark:bg-black p-8 md:p-12 animate-in shadow-2xl">
        {/* Decorative Blurs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-500/20 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 blur-[80px] rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-medium text-brand-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              Sistema Operacional
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight">
              Visão <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-200">Geral</span>
            </h1>
            <p className="text-surface-400 max-w-lg text-lg leading-relaxed">
              Monitore a saúde tecnológica de {totalPcs} equipamentos em tempo real nos 10 laboratórios da unidade.
            </p>
          </div>

          <div className="flex items-center gap-6 p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
            <div className="relative flex items-center justify-center">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-white/10"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * globalHealth) / 100}
                  className={`transition-all duration-1000 ease-out ${
                    globalHealth > 90 ? 'text-emerald-500' : 'text-amber-500'
                  }`}
                />
              </svg>
              <span className="absolute text-xl font-black text-white">{globalHealth}%</span>
            </div>
            <div>
              <p className="text-sm font-medium text-surface-400 uppercase tracking-widest">Saúde Global</p>
              <p className="text-2xl font-bold text-white">Status Estável</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in stagger-1">
        <StatsCard
          icon={<Monitor className="w-6 h-6" />}
          label="Parque Tecnológico"
          value={loading ? '...' : totalPcs.toString()}
          subtitle="Equipamentos totais"
          color="brand"
        />
        <StatsCard
          icon={<CheckCircle2 className="w-6 h-6" />}
          label="Disponíveis agora"
          value={loading ? '...' : totalOk.toString()}
          subtitle={`${Math.round((totalOk/totalPcs)*100)}% de disponibilidade`}
          color="emerald"
        />
        <StatsCard
          icon={<Wrench className="w-6 h-6" />}
          label="Em Manutenção"
          value={loading ? '...' : totalMaint.toString()}
          subtitle="Aguardando reparo"
          color="orange"
        />
      </div>

      {/* Labs Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-surface-900 dark:text-white">
              Monitoramento por Laboratório
            </h2>
          </div>
          <p className="text-xs text-surface-400 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Última sincronização: {lastSync}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card h-64 p-6 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {LABS.map((lab, index) => {
              const summary = labSummaries.find((s) => s.lab_id === lab.id) || {
                lab_id: lab.id,
                total: lab.pcs.length,
                ok: lab.pcs.length,
                maintenance: 0,
              };
              const healthPercent = Math.round((summary.ok / summary.total) * 100);
              const isHealthy = healthPercent > 95;

              return (
                <Link
                  key={lab.id}
                  href={`/lab/${lab.id}`}
                  className={`group relative glass-card p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl animate-in stagger-${(index % 3) + 1}`}
                >
                  <div className="flex items-start justify-between mb-8">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-surface-900 dark:text-white group-hover:text-brand-500 transition-colors">
                        Lab {lab.id}
                      </h3>
                      <p className="text-xs font-bold text-surface-400 tracking-widest uppercase">
                        Lab{lab.prefix} — {lab.pcEnd}
                      </p>
                    </div>
                    <div className={`p-4 rounded-[1.25rem] transition-all duration-500 group-hover:scale-110 ${
                      isHealthy 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                    }`}>
                      {isHealthy ? <Activity className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
                    </div>
                  </div>

                  {/* Health Bar Section */}
                  <div className="space-y-3 mb-8">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-bold text-surface-600 dark:text-surface-400">Status da Sala</span>
                      <span className={`text-lg font-black ${
                        isHealthy ? 'text-emerald-500' : 'text-orange-500'
                      }`}>{healthPercent}%</span>
                    </div>
                    <div className="h-3 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden p-0.5 border border-surface-200 dark:border-surface-700">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${
                          isHealthy ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-orange-500 to-amber-400'
                        }`}
                        style={{ width: `${healthPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* PC Mini Grid Preview */}
                  <div className="grid grid-cols-10 gap-1 opacity-40 group-hover:opacity-70 transition-opacity">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-surface-300 dark:bg-surface-600" />
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-surface-400 uppercase font-bold tracking-wider">OK</span>
                        <span className="text-sm font-bold text-emerald-500">{summary.ok}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-surface-400 uppercase font-bold tracking-wider">MNT</span>
                        <span className="text-sm font-bold text-orange-500">{summary.maintenance}</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-surface-50 dark:bg-surface-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                      <ArrowRight className="w-5 h-5 text-brand-500" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsCard({
  icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-500/10 text-brand-500 ring-brand-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20',
    orange: 'bg-orange-500/10 text-orange-500 ring-orange-500/20',
  };

  return (
    <div className="glass-card p-8 group hover:scale-[1.02] transition-transform duration-300 overflow-hidden relative">
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-10 -translate-y-12 translate-x-12 ${
        color === 'brand' ? 'bg-brand-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-orange-500'
      }`} />
      
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ring-1 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">{label}</p>
        <p className="text-4xl font-black text-surface-900 dark:text-white">{value}</p>
        <p className="text-xs text-surface-400 font-medium">{subtitle}</p>
      </div>
    </div>
  );
}

