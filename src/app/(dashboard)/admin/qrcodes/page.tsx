'use client';

import { useState, useEffect } from 'react';
import { LABS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { Printer, Download, Search, Filter, Monitor } from 'lucide-react';

export default function QRCodesPage() {
  const [selectedLab, setSelectedLab] = useState<number>(1);
  const [baseUrl, setBaseUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    setBaseUrl(window.location.origin);
    
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setIsAdmin(profile?.role === 'admin');
      }
    }
    checkAdmin();
  }, [supabase]);

  if (!isAdmin && baseUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-4">
          <Filter className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">Acesso Restrito</h1>
        <p className="text-surface-500 dark:text-surface-400 max-w-md">
          Apenas administradores podem gerar e imprimir QR Codes para os equipamentos.
        </p>
      </div>
    );
  }

  const lab = LABS.find(l => l.id === selectedLab);

  const handlePrint = () => {
    window.print();
  };

  const copyAllLinks = () => {
    if (!lab) return;
    const links = lab.pcs
      .map(pc => `${pc}: ${baseUrl}/lab/${selectedLab}?pc=${pc}`)
      .join('\n');
    navigator.clipboard.writeText(links);
    alert('Todos os links foram copiados para a área de transferência!');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header - Hidden on Print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden animate-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white">
            Gerador de QR Codes
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            Gere etiquetas para identificação e manutenção rápida dos computadores.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={copyAllLinks}
            className="btn-secondary"
            title="Copiar lista de links"
          >
            <Download className="w-5 h-5" />
            Copiar Links
          </button>
          <button
            onClick={handlePrint}
            className="btn-primary"
          >
            <Printer className="w-5 h-5" />
            Imprimir Etiquetas
          </button>
        </div>
      </div>

      {/* Filters - Hidden on Print */}
      <div className="glass-card p-6 print:hidden animate-in stagger-1">
        <div className="flex flex-wrap items-center gap-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300 ml-1">
              Selecionar Laboratório
            </label>
            <div className="flex flex-wrap gap-2">
              {LABS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLab(l.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedLab === l.id
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  Lab {l.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Grid */}
      <div className="qr-print-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {lab?.pcs.map((pcName, index) => {
          const maintenanceUrl = `${baseUrl}/lab/${selectedLab}?pc=${pcName}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(maintenanceUrl)}&margin=10`;

          return (
            <div 
              key={pcName} 
              className="qr-print-card glass-card p-6 flex flex-col items-center justify-center gap-4 animate-in"
              style={{ animationDelay: `${index * 15}ms` }}
            >
              {/* Branding - Print Only */}
              <div className="hidden print:flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-brand-500 rounded flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] font-black tracking-widest text-surface-900">LABMANAGER</span>
              </div>

              <div className="text-center">
                <h3 className="text-2xl font-black text-surface-900 dark:text-white print:text-black print:text-4xl">
                  {pcName}
                </h3>
                <p className="text-[10px] font-bold text-brand-500 print:text-black uppercase tracking-[0.2em] mt-1">
                  Laboratório {selectedLab}
                </p>
              </div>
              
              <div className="bg-white p-2 rounded-lg border border-surface-100 dark:border-surface-700 print:border-none print:p-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={qrUrl} 
                  alt={`QR Code ${pcName}`}
                  className="qr-print-image w-32 h-32"
                  crossOrigin="anonymous"
                />
              </div>

              <div className="text-center space-y-1">
                <p className="text-[8px] font-black text-surface-900 dark:text-surface-300 print:text-black print:text-[11px] uppercase tracking-tighter">
                  Propriedade CCI - Escaneie para Suporte
                </p>
                <p className="text-[7px] text-surface-400 print:text-surface-500 font-medium">
                  {baseUrl.replace('https://', '').replace('http://', '')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Print Instructions */}
      <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 p-4 rounded-xl text-brand-700 dark:text-brand-300 text-sm flex gap-3 print:hidden animate-in stagger-2">
        <Monitor className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-bold mb-1">Instruções para Impressão Premium:</p>
          <ul className="list-disc list-inside space-y-0.5 opacity-90">
            <li>As etiquetas estão configuradas para aprox. <strong>6.5cm x 8cm</strong> (3 por linha).</li>
            <li>Selecione <strong>"Gráficos de Segundo Plano"</strong> nas configurações do navegador.</li>
            <li>Use papel adesivo fosco para evitar reflexos no QR Code.</li>
            <li>Ajuste a escala para 100% para manter o tamanho correto.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
