import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { fetchCurrentUser, logout, type User } from './auth/api';
import { Background } from './components/Background';
import { LoginScreen } from './components/LoginScreen';
import KanbanApp from './KanbanApp';

type AuthState = { status: 'checking' } | { status: 'anonymous' } | { status: 'signed-in'; user: User };

const ROUTES = { login: '/login', home: '/home' } as const;

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

/** Where to go after login: the protected page the person tried to open, or /home. */
function redirectTarget(state: unknown): string {
  const from = (state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('//') && from !== ROUTES.login ? from : ROUTES.home;
}

function LoginRoute({ onLogin }: { onLogin: (user: User) => void }) {
  useDocumentTitle('Entrar · Roboyell Kanban');
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <LoginScreen
      onLogin={(user) => {
        onLogin(user);
        navigate(redirectTarget(location.state), { replace: true });
      }}
    />
  );
}

function HomeRoute({ user, onLogout }: { user: User; onLogout: () => void }) {
  useDocumentTitle('Quadro · Roboyell Kanban');
  return <KanbanApp user={user} onLogout={onLogout} />;
}

/** Sends anonymous visitors to /login, remembering where they wanted to go. */
function RequireAuth({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const location = useLocation();
  if (!signedIn) return <Navigate to={ROUTES.login} replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function AppRoutes() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    fetchCurrentUser().then((user) => {
      if (alive) setAuth(user ? { status: 'signed-in', user } : { status: 'anonymous' });
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setAuth({ status: 'anonymous' });
    navigate(ROUTES.login, { replace: true });
  };

  if (auth.status === 'checking') {
    return (
      <div className="splash" role="status" aria-live="polite">
        <Loader2 size={28} className="spin" aria-hidden="true" />
        <span className="sr-only">Verificando sessão…</span>
      </div>
    );
  }

  const signedIn = auth.status === 'signed-in';

  return (
    <Routes>
      <Route
        path={ROUTES.login}
        element={
          signedIn ? (
            <Navigate to={redirectTarget(location.state)} replace />
          ) : (
            <LoginRoute onLogin={(user) => setAuth({ status: 'signed-in', user })} />
          )
        }
      />
      <Route
        path={ROUTES.home}
        element={
          <RequireAuth signedIn={signedIn}>
            {signedIn && <HomeRoute user={auth.user} onLogout={handleLogout} />}
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={signedIn ? ROUTES.home : ROUTES.login} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <Background />
      <AppRoutes />
    </BrowserRouter>
  );
}
