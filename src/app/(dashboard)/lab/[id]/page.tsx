'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LABS, type PCStatus } from '@/lib/constants';
import MaintenanceModal from '@/components/MaintenanceModal';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  ArrowLeft,
  Monitor,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Clock,
  User,
} from 'lucide-react';

interface PCData {
  pc_name: string;
  lab_id: number;
  status: PCStatus;
  reason: string | null;
  notes: string | null;
  reported_by: string | null;
  reported_at: string | null;
}

export default function LabDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="animate-pulse p-8">Carregando...</div>}>
      <LabDetailContent {...props} />
    </Suspense>
  );
}

function LabDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const searchParams = useSearchParams();
  const pcFromUrl = searchParams.get('pc');
  
  const resolvedParams = use(params);
  const labId = parseInt(resolvedParams.id);
  const lab = LABS.find((l) => l.id === labId);

  const [pcs, setPcs] = useState<PCData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPc, setSelectedPc] = useState<PCData | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchPcs().then((fetchedPcs) => {
      if (pcFromUrl && fetchedPcs) {
        const pc = fetchedPcs.find(p => p.pc_name === pcFromUrl);
        if (pc) setSelectedPc(pc);
      }
    });

    // Debounced refetch for real-time
    let timer: NodeJS.Timeout;

    const channel = supabase
      .channel(`lab-${labId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pc_status',
          filter: `lab_id=eq.${labId}`,
        },
        () => {
          clearTimeout(timer);
          timer = setTimeout(fetchPcs, 500); // Debounce 500ms
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, pcFromUrl]);

  async function fetchPcs() {
    if (!lab) return null;

    try {
      const { data, error } = await supabase
        .from('pc_status')
        .select('*')
        .eq('lab_id', labId);

      if (error) throw error;

      // Merge with full list of PCs so all 31 show
      const pcMap = new Map((data || []).map((pc) => [pc.pc_name, pc]));
      const fullList: PCData[] = lab.pcs.map((pcName) => {
        const existing = pcMap.get(pcName);
        return existing
          ? {
              pc_name: existing.pc_name,
              lab_id: existing.lab_id,
              status: existing.status as PCStatus,
              reason: existing.reason,
              notes: existing.notes,
              reported_by: existing.reported_by,
              reported_at: existing.reported_at,
            }
          : {
              pc_name: pcName,
              lab_id: labId,
              status: 'ok' as PCStatus,
              reason: null,
              notes: null,
              reported_by: null,
              reported_at: null,
            };
      });

      setPcs(fullList);
      setLoading(false);
      return fullList;
    } catch (error) {
      console.error('Error fetching PCs:', error);
      // No alert here to avoid annoying the user on background refetches,
      // but we keep the current data
      setLoading(false);
      return null;
    }
  }


  if (!lab) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-surface-400" />
        <p className="text-surface-500 text-lg">Laboratório não encontrado.</p>
        <Link href="/" className="btn-primary">
          Voltar ao Dashboard
        </Link>
      </div>
    );
  }

  const okCount = pcs.filter((p) => p.status === 'ok').length;
  const maintCount = pcs.filter((p) => p.status === 'maintenance').length;


  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-in">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-brand-500 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white">
              Laboratório {lab.id}
            </h1>
            <p className="text-surface-500 dark:text-surface-400 mt-1">
              LAB{lab.prefix} — LAB{lab.pcEnd} · {lab.pcs.length} computadores
            </p>
          </div>

          {/* Mini Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-surface-600 dark:text-surface-400">{okCount} OK</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-surface-600 dark:text-surface-400">{maintCount} Manut.</span>
            </div>

          </div>
        </div>
      </div>

      {/* PC Grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {Array.from({ length: 31 }).map((_, i) => (
            <div
              key={i}
              className="glass-card p-4 animate-pulse flex flex-col items-center"
            >
              <div className="w-8 h-8 bg-surface-200 dark:bg-surface-700 rounded-lg mb-2" />
              <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {pcs.map((pc, index) => {
            const isOk = pc.status === 'ok';
            const isMaint = pc.status === 'maintenance';
            return (
              <button
                key={pc.pc_name}
                onClick={() => setSelectedPc(pc)}
                className={`glass-card p-4 flex flex-col items-center gap-2 group hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200 animate-in cursor-pointer relative overflow-hidden ${
                  isMaint
                    ? 'ring-2 ring-orange-500/50'
                    : ''
                }`}
                style={{ animationDelay: `${Math.min(index * 20, 600)}ms` }}
                title={
                  isOk
                    ? `${pc.pc_name} — Funcionando`
                    : `${pc.pc_name} — ${pc.reason || pc.status}`
                }
              >
                {/* Status dot */}
                <div
                  className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                    isMaint
                      ? 'bg-orange-500 animate-pulse-slow'
                      : 'bg-emerald-500'
                  }`}
                />

                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isMaint
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                  }`}
                >
                  {isMaint ? (
                    <Wrench className="w-5 h-5" />
                  ) : (
                    <Monitor className="w-5 h-5" />
                  )}
                </div>

                {/* Name */}
                <span className="text-[10px] font-bold text-surface-700 dark:text-surface-300">
                  {pc.pc_name}
                </span>

                {/* Reason tooltip on hover (for non-ok) */}
                {!isOk && pc.reason && (
                  <div className="text-[10px] text-surface-500 dark:text-surface-400 truncate w-full text-center">
                    {pc.reason}
                  </div>
                )}

                {/* Reported info */}
                {!isOk && pc.reported_by && (
                  <div className="flex items-center gap-1 text-[9px] text-surface-400">
                    <User className="w-2.5 h-2.5" />
                    <span className="truncate max-w-[60px]">{pc.reported_by}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-6 text-sm text-surface-600 dark:text-surface-400">
        <span className="font-medium text-surface-800 dark:text-surface-200">Legenda:</span>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Funcionando
        </div>
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-orange-500" />
          Em Manutenção
        </div>

        <div className="flex items-center gap-2 ml-auto text-xs text-surface-400">
          <Clock className="w-3.5 h-3.5" />
          Clique em um PC para relatar ou resolver um problema
        </div>
      </div>

      {/* Maintenance Modal */}
      {selectedPc && (
        <MaintenanceModal
          pcName={selectedPc.pc_name}
          labId={labId}
          currentStatus={selectedPc.status}
          currentReason={selectedPc.reason}
          currentNotes={selectedPc.notes}
          currentReportedBy={selectedPc.reported_by}
          currentReportedAt={selectedPc.reported_at}
          onClose={() => setSelectedPc(null)}
          onSaved={fetchPcs}
        />
      )}
    </div>
  );
}
