'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LABS } from '@/lib/constants';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Keyboard,
  Loader2,
  QrCode,
  Search,
  XCircle,
} from 'lucide-react';

type ScanState = 'idle' | 'starting' | 'scanning' | 'found' | 'unsupported' | 'error';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector() {
  if (typeof window === 'undefined') return null;

  const detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  return detector ?? null;
}

function resolvePcDestination(rawValue: string) {
  const value = rawValue.trim();
  const pcMatch = value.match(/LAB\d{3,4}/i);
  const pcName = pcMatch?.[0].toUpperCase();

  if (!pcName) return null;

  const lab = LABS.find((item) => item.pcs.includes(pcName));
  if (!lab) return null;

  return {
    pcName,
    labId: lab.id,
    href: `/lab/${lab.id}?pc=${encodeURIComponent(pcName)}`,
  };
}

export default function ScannerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [message, setMessage] = useState('Aponte a camera para a etiqueta QR do computador.');
  const [manualPc, setManualPc] = useState('');

  const canScan = useMemo(() => Boolean(getBarcodeDetector()), []);

  useEffect(() => {
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopScanner() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function handleStopScanner() {
    stopScanner();
    setScanState('idle');
    setMessage('Aponte a camera para a etiqueta QR do computador.');
  }

  async function startScanner() {
    const BarcodeDetector = getBarcodeDetector();

    if (!BarcodeDetector) {
      setScanState('unsupported');
      setMessage('Este navegador nao tem leitor QR nativo. Use o campo manual abaixo.');
      return;
    }

    try {
      setScanState('starting');
      setMessage('Abrindo camera...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      setScanState('scanning');
      setMessage('Escaneando... mantenha o QR Code dentro do quadro.');

      const scanFrame = async () => {
        if (!videoRef.current || scanState === 'found') return;

        try {
          const codes = await detector.detect(videoRef.current);
          const destination = codes
            .map((code) => resolvePcDestination(code.rawValue))
            .find(Boolean);

          if (destination) {
            setScanState('found');
            setMessage(`Computador encontrado: ${destination.pcName}. Abrindo chamado...`);
            stopScanner();
            router.push(destination.href);
            return;
          }
        } catch {
          // Keep scanning; camera frames can fail transiently while focusing.
        }

        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (error) {
      console.error('Erro ao abrir camera:', error);
      stopScanner();
      setScanState('error');
      setMessage('Nao foi possivel acessar a camera. Verifique a permissao do navegador.');
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();

    const destination = resolvePcDestination(manualPc);

    if (!destination) {
      setScanState('error');
      setMessage('Computador nao encontrado. Digite algo como LAB205.');
      return;
    }

    router.push(destination.href);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="animate-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white">
              Leitor de QR Code
            </h1>
            <p className="text-surface-500 dark:text-surface-400">
              Escaneie a etiqueta do computador para abrir a manutencao correta.
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-6">
        <section className="glass-card overflow-hidden animate-in stagger-1">
          <div className="relative aspect-[4/3] sm:aspect-video bg-surface-950">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />

            {scanState !== 'scanning' && scanState !== 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white bg-surface-950">
                <Camera className="w-14 h-14 text-brand-300" />
                <button onClick={startScanner} className="btn-primary">
                  <Camera className="w-5 h-5" />
                  Iniciar leitura
                </button>
              </div>
            )}

            {(scanState === 'scanning' || scanState === 'starting') && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 max-w-[70vw] max-h-[70vw] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
              </div>
            )}

            {scanState === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
          </div>

          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-surface-100 dark:border-surface-800">
            <StatusMessage state={scanState} message={message} />
            {(scanState === 'scanning' || scanState === 'starting') && (
              <button onClick={handleStopScanner} className="btn-secondary">
                <XCircle className="w-5 h-5" />
                Parar
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <form onSubmit={handleManualSubmit} className="glass-card p-6 animate-in stagger-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                <Keyboard className="w-5 h-5 text-brand-500" />
              </div>
              <div>
                <h2 className="font-bold text-surface-900 dark:text-white">Entrada manual</h2>
                <p className="text-xs text-surface-400">Caso a camera nao leia o QR.</p>
              </div>
            </div>

            <label htmlFor="manualPc" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
              Codigo do computador
            </label>
            <input
              id="manualPc"
              value={manualPc}
              onChange={(e) => setManualPc(e.target.value.toUpperCase())}
              className="input-field"
              placeholder="LAB205"
              autoCapitalize="characters"
            />
            <button type="submit" className="btn-primary w-full mt-4">
              <Search className="w-5 h-5" />
              Abrir computador
            </button>
          </form>

          <div className="glass-card p-6 animate-in stagger-3">
            <h2 className="font-bold text-surface-900 dark:text-white mb-3">Como usar</h2>
            <div className="space-y-3 text-sm text-surface-500 dark:text-surface-400">
              <p>1. Toque em iniciar leitura e permita o uso da camera.</p>
              <p>2. Aponte para a etiqueta QR do computador com problema.</p>
              <p>3. O sistema abre o computador certo para relatar ou resolver manutencao.</p>
            </div>
            {!canScan && (
              <div className="mt-4 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-3 text-sm text-orange-700 dark:text-orange-300">
                Este navegador pode nao suportar leitura nativa de QR. No celular, use Chrome ou Edge atualizado.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatusMessage({ state, message }: { state: ScanState; message: string }) {
  const Icon = state === 'found' ? CheckCircle2 : state === 'error' || state === 'unsupported' ? AlertTriangle : QrCode;
  const color = state === 'found'
    ? 'text-emerald-600 dark:text-emerald-400'
    : state === 'error' || state === 'unsupported'
      ? 'text-orange-600 dark:text-orange-400'
      : 'text-surface-600 dark:text-surface-300';

  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${color}`}>
      <Icon className="w-5 h-5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
