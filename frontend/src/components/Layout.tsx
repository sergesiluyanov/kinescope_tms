import { Link, Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="text-base font-semibold tracking-tight text-slate-900">
            Kinescope TMS
          </Link>

          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500">
                {user.full_name ?? user.email}{' '}
                <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                  {user.role}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
