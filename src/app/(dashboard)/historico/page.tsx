'use client';

import { useEffect, useState } from 'react';
import { LABS } from '@/lib/constants';
import {
  ClipboardList,
  Search,
  Filter,
  Monitor,
  User,
  Clock,
  Wrench,
  CheckCircle2,

  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface LogEntry {
  id: string;
  pc_name: string;
  lab_id: number;
  action: string;
  status: string | null;
  reason: string;
  notes: string | null;
  performed_by: string;
  performed_by_email: string;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function HistoricoPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLab, setFilterLab] = useState<number | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [supabase, setSupabase] = useState<ReturnType<typeof import('@/lib/supabase/client').createClient> | null>(null);

  useEffect(() => {
    setSupabase(require('@/lib/supabase/client').createClient());
  }, []);

  useEffect(() => {
    if (supabase) fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterLab, filterAction, searchQuery, supabase]);

  async function fetchLogs() {
    setLoading(true);

    let query = supabase!
      .from('maintenance_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterLab) {
      query = query.eq('lab_id', filterLab);
    }
    if (filterAction) {
      query = query.eq('action', filterAction);
    }
    if (searchQuery.trim()) {
      query = query.or(
        `pc_name.ilike.%${searchQuery}%,reason.ilike.%${searchQuery}%,performed_by.ilike.%${searchQuery}%`
      );
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching logs:', error);
      setLoading(false);
      return;
    }

    setLogs(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-in">
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white">
          Histórico de Manutenções
        </h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1">
          Registro completo de todas as manutenções e resoluções
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 animate-in stagger-1">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="input-field pl-10"
              placeholder="Buscar por PC, motivo ou responsável..."
            />
          </div>

          {/* Lab filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <select
              value={filterLab || ''}
              onChange={(e) => {
                setFilterLab(e.target.value ? parseInt(e.target.value) : null);
                setPage(0);
              }}
              className="input-field pl-10 pr-8 min-w-[160px]"
            >
              <option value="">Todos os Labs</option>
              {LABS.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  Lab {lab.id}
                </option>
              ))}
            </select>
          </div>

          {/* Action filter */}
          <select
            value={filterAction || ''}
            onChange={(e) => {
              setFilterAction(e.target.value || null);
              setPage(0);
            }}
            className="input-field min-w-[140px]"
          >
            <option value="">Todas ações</option>
            <option value="reported">Reportados</option>
            <option value="resolved">Resolvidos</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 animate-in stagger-2">
        <ClipboardList className="w-4 h-4" />
        <span>
          {totalCount} registro{totalCount !== 1 ? 's' : ''} encontrado
          {totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden animate-in stagger-3">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 bg-surface-200 dark:bg-surface-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-1/3" />
                  <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-surface-400">
            <ClipboardList className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">Nenhum registro encontrado</p>
            <p className="text-sm mt-1">
              Ajuste os filtros ou aguarde manutenções serem registradas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200/50 dark:border-surface-700/50">
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-4">
                    PC
                  </th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-4">
                    Ação
                  </th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-4 hidden md:table-cell">
                    Motivo
                  </th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">
                    Responsável
                  </th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-4">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30 transition-colors"
                  >
                    {/* PC */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                          <Monitor className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-surface-900 dark:text-white">
                            {log.pc_name}
                          </p>
                          <p className="text-[11px] text-surface-400">
                            Lab {log.lab_id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        log.action === 'resolved'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                      }`}>
                        {log.action === 'resolved' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Resolvido
                          </>
                        ) : (
                          <>
                            <Wrench className="w-3 h-3" />
                            Manutenção
                          </>
                        )}
                      </span>
                    </td>

                    {/* Reason */}
                    <td className="px-6 py-4 hidden md:table-cell">
                      <p className="text-sm text-surface-700 dark:text-surface-300 max-w-xs truncate">
                        {log.reason}
                      </p>
                      {log.notes && (
                        <p className="text-[11px] text-surface-400 truncate max-w-xs mt-0.5">
                          {log.notes}
                        </p>
                      )}
                    </td>

                    {/* Responsible */}
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-surface-400" />
                        <span className="text-sm text-surface-700 dark:text-surface-300">
                          {log.performed_by}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(log.created_at)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-surface-200/50 dark:border-surface-700/50">
            <p className="text-sm text-surface-500">
              Página {page + 1} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="btn-secondary !px-3 !py-2 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="btn-secondary !px-3 !py-2 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
