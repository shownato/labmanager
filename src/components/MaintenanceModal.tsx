'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MAINTENANCE_REASONS, type PCStatus } from '@/lib/constants';
import { X, AlertTriangle, Wrench, Send } from 'lucide-react';

interface MaintenanceModalProps {
  pcName: string;
  labId: number;
  currentStatus: PCStatus;
  onClose: () => void;
  onSaved: () => void;
}

export default function MaintenanceModal({
  pcName,
  labId,
  currentStatus,
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

        // NOVO: Criar chamado automático no servidor GLPI 
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
          
          // Dispara para nossa API Next.js que vai se comunicar com o servidor GLPI físico
          fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: glpiTitle,
              description: glpiContent
            })
          }).catch(err => console.error("Falha silenciosa ao enviar para GLPI:", err));
          
          // Note que não usamos 'await' de propósito aqui.
          // Assim a tela fecha rápido para o professor sem esperar o servidor GLPI responder.
        } catch (glpiErr) {
          console.error("Erro interno ao montar chamado para o GLPI:", glpiErr);
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar manutenção:', err);
      alert('Falha ao salvar as alterações. Por favor, tente novamente.');
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
