import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, User as UserIcon } from 'lucide-react';
import { login, type User } from '../auth/api';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const ids = { user: useId(), pass: useId(), remember: useId(), err: useId(), caps: useId() };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!username.trim() || !password) {
      setError('Informe usuário e senha.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await login(username.trim(), password, remember);
    setLoading(false);
    if (result.ok) {
      onLogin(result.user);
    } else {
      setError(result.error);
      setPassword('');
      passwordRef.current?.focus();
    }
  };

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="login">
      <aside className="login__brand">
        <img src={`${import.meta.env.BASE_URL}logo_roboyell.png`} alt="Roboyell" className="login__logo" width={210} height={39} />
        <div className="login__pitch">
          <h1>Kanban de Projetos</h1>
          <p>Organize as demandas do KAyla, da análise à entrega, com cada tarefa direcionada automaticamente para a equipe certa.</p>
        </div>
        <span className="login__copy">© Roboyell · Visão computacional & IA</span>
      </aside>

      <main className="login__panel">
        <form className="login__card" onSubmit={submit} noValidate aria-describedby={error ? ids.err : undefined}>
          <div className="login__head">
            <span className="login__lock" aria-hidden="true"><Lock size={18} /></span>
            <h2>Entrar</h2>
            <p>Acesso restrito. Use as credenciais fornecidas para você.</p>
          </div>

          {error && (
            <div id={ids.err} className="login__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor={ids.user}>Usuário</label>
            <div className="input-icon">
              <UserIcon size={16} aria-hidden="true" />
              <input
                id={ids.user}
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="ex.: guilherme"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor={ids.pass}>Senha</label>
            <div className="input-icon">
              <Lock size={16} aria-hidden="true" />
              <input
                ref={passwordRef}
                id={ids.pass}
                className="input input--pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={trackCaps}
                onKeyUp={trackCaps}
                onBlur={() => setCapsLock(false)}
                autoComplete="current-password"
                placeholder="••••••••••••"
                required
                aria-describedby={capsLock ? ids.caps : undefined}
              />
              <button
                type="button"
                className="input-icon__toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {capsLock && <p id={ids.caps} className="field__warn">Caps Lock está ativado.</p>}
          </div>

          <label className="check" htmlFor={ids.remember}>
            <input id={ids.remember} type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span className="check__box" aria-hidden="true" />
            Manter conectado por 30 dias
          </label>

          <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
            {loading ? 'Entrando…' : 'Entrar'}
            {!loading && <ArrowRight size={16} aria-hidden="true" />}
          </button>

          <p className="login__help">Esqueceu a senha? Fale com o administrador do projeto.</p>
        </form>
      </main>
    </div>
  );
}
