'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { matriculaEmail } from '@/lib/auth/matricula.mjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, LogIn, Monitor, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="page-container min-h-screen" />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [identifier, setIdentifier] = useState('');
  const [staffAccess, setStaffAccess] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') ?? '/';
  const nextPath = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  function changeAccessMode(useEmail: boolean) {
    setStaffAccess(useEmail);
    setIdentifier('');
    setPassword('');
    setShowPassword(false);
    setError('');
  }

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    const errorParam = searchParams.get('error');

    if (errorParam === 'unauthorized') {
      setError('Esta conta não está autorizada a acessar o LabManager.');
    }

    if (errorParam === 'auth') {
      setError('Sua sessao expirou. Entre novamente.');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const login = identifier.trim();
      if (!staffAccess && !/^[0-9]{6}$/.test(login)) {
        setError('Informe os seis primeiros dígitos da matrícula.');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: staffAccess ? login.toLowerCase() : matriculaEmail(login),
        password,
      });
      if (error) {
        setError(staffAccess ? 'E-mail ou senha incorretos.' : 'Matrícula ou senha incorretas.');
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError('Não foi possível entrar. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-300/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-in relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/30 mb-4">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">
            Lab<span className="text-gradient">Manager</span>
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            Gestao de Laboratorios de Informatica
          </p>
        </div>

        <div className="glass-card p-8">
          <div className="flex items-center gap-3 p-3 mb-6 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">
              Acesso restrito a professores, monitores e equipe CCI autorizados.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2" role="group" aria-label="Forma de acesso">
            <button
              type="button"
              aria-pressed={!staffAccess}
              disabled={loading}
              onClick={() => changeAccessMode(false)}
              className={`${!staffAccess ? 'btn-primary' : 'btn-secondary'} disabled:opacity-50`}
            >
              Matrícula
            </button>
            <button
              type="button"
              aria-pressed={staffAccess}
              disabled={loading}
              onClick={() => changeAccessMode(true)}
              className={`${staffAccess ? 'btn-primary' : 'btn-secondary'} disabled:opacity-50`}
            >
              E-mail
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                {staffAccess ? 'E-mail' : 'Matrícula'}
              </label>
              <input
                id="identifier"
                name="username"
                type={staffAccess ? 'email' : 'text'}
                inputMode={staffAccess ? 'email' : 'numeric'}
                pattern={staffAccess ? undefined : '[0-9]{6}'}
                maxLength={staffAccess ? 254 : 6}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="input-field"
                placeholder={staffAccess ? 'seu@email.com' : '6 primeiros dígitos'}
                autoComplete="username"
                required
              />
              {!staffAccess && (
                <p className="mt-1.5 text-xs text-surface-500">
                  Use apenas os seis primeiros dígitos, sem traços.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12"
                  placeholder="********"
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !supabase}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Entrar
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-surface-400">
            Novas contas devem ser criadas pela equipe CCI.
          </p>
        </div>

        <p className="text-center text-sm text-surface-400 dark:text-surface-500 mt-6">
          CCI - Laboratorios de Informatica
        </p>
      </div>
    </div>
  );
}
