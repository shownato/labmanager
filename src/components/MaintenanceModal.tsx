'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MAINTENANCE_REASONS, type PCStatus } from '@/lib/constants';
import { X, AlertTriangle, Wrench, Send } from 'lucide-react';

interface MaintenanceModalProps {
  pcName: string;
  labId: number;
  currentStatus: PCStatus;
  currentReason?: string | null;
  currentNotes?: string | null;
  currentReportedBy?: string | null;
  currentReportedAt?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const details = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [details.message, details.details, details.hint, details.code ? `Codigo: ${details.code}` : null]
      .filter(Boolean)
      .join('\n');
  }

  return String(error || 'Erro desconhecido');
}

export default function MaintenanceModal({
  pcName,
  labId,
  currentStatus,
  currentReason,
  currentNotes,
  currentReportedBy,
  currentReportedAt,
  onClose,
  onSaved,
}: MaintenanceModalProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [status] = useState<PCStatus>(
    currentStatus === 'ok' ? 'maintenance' : 'ok'
  );
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const isResolving = currentStatus !== 'ok' && status === 'ok';

  function formatReportedAt(value?: string | null) {
    if (!value) return null;

    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Usuário não autenticado');

      const userName = user.user_metadata?.full_name || user.email;

      if (isResolving) {
        // Resolve using Atomic RPC
        const { error } = await supabase.rpc('resolve_pc_issue', {
          p_pc_name: pcName,
          p_lab_id: labId,
          p_notes: notes || 'Sem observações adicionais',
          p_user_name: userName,
          p_user_email: user.email,
        });

        if (error) throw error;
      } else {
        // Report using Atomic RPC
        const { error } = await supabase.rpc('report_pc_issue', {
          p_pc_name: pcName,
          p_lab_id: labId,
          p_reason: reason,
          p_notes: notes,
          p_user_name: userName,
          p_user_email: user.email,
        });

        if (error) throw error;

        // Tenta criar o chamado no GLPI e informa se a integração falhar.
        try {
          const glpiTitle = `Manutenção: ${pcName} (Lab ${labId}) - ${reason}`;
          const glpiContent = `
🚨 **Novo Problema Relatado via LabManager** 🚨

* **Laboratório:** ${labId}
* **Computador:** ${pcName}
* **Professor(a)/Monitor:** ${userName} (${user.email})

* **Motivo Principal:** ${reason}
* **Detalhes Extras:** ${notes || 'Nenhuma observação adicional fornecida.'}
          `.trim();
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              title: glpiTitle,
              description: glpiContent
            })
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            console.error('Falha ao enviar para GLPI:', payload || response.statusText);
            const details = payload
              ? [payload.stage ? `Etapa: ${payload.stage}` : null, payload.endpoint ? `Destino: ${payload.endpoint}` : null, payload.error ? `Erro: ${payload.error}` : null]
                  .filter(Boolean)
                  .join('\n')
              : response.statusText;
            alert(`Problema salvo no LabManager, mas o chamado no GLPI falhou.\n\n${details}`);
          }
        } catch (glpiErr) {
          console.error("Erro ao enviar chamado para o GLPI:", glpiErr);
          alert('Problema salvo no LabManager, mas o GLPI não respondeu. Avise a equipe CCI.');
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar manutenção:', err);
      alert(`Falha ao salvar as alterações.\n\n${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass-card p-0 animate-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-200/50 dark:border-surface-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              {isResolving ? (
                <Wrench className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                {isResolving ? 'Resolver Problema' : 'Relatar Problema'}
              </h2>
              <p className="text-sm text-surface-500">{pcName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {isResolving && (
            <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                Problema atual
              </p>
              <p className="text-sm font-semibold text-surface-900 dark:text-white">
                {currentReason || 'Problema nao informado'}
              </p>
              {currentNotes && (
                <p className="text-sm text-surface-600 dark:text-surface-300">
                  {currentNotes}
                </p>
              )}
              {(currentReportedBy || currentReportedAt) && (
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Reportado por {currentReportedBy || 'usuario'}{formatReportedAt(currentReportedAt) ? ` em ${formatReportedAt(currentReportedAt)}` : ''}
                </p>
              )}
            </div>
          )}

          {!isResolving && (
            <>
              {/* Reason */}
              <div>
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5"
                >
                  Motivo *
                </label>

                <select
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Selecione o motivo...</option>
                  {MAINTENANCE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5"
            >
              Observações {isResolving ? '(o que foi feito)' : '(opcional)'}
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder={
                isResolving
                  ? 'Descreva o que foi feito para resolver...'
                  : 'Detalhes adicionais sobre o problema...'
              }
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (!isResolving && !reason)}
              className={`flex-1 ${isResolving ? 'btn-primary' : 'btn-danger'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {isResolving ? 'Colocar Online' : 'Relatar Problema'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
