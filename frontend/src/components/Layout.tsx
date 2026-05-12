import { NavLink, Link, Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import { isAdmin } from '@/auth/permissions';

const NAV: { to: string; label: string }[] = [
  { to: '/', label: 'Главная' },
  { to: '/projects', label: 'Проекты' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const showAdmin = isAdmin(user);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-base font-semibold tracking-tight text-slate-900">
              Kinescope TMS
            </Link>
            <nav className="flex items-center gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm transition ${
                      isActive
                        ? 'bg-brand/10 text-brand'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              {showAdmin && (
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm transition ${
                      isActive
                        ? 'bg-brand/10 text-brand'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  Пользователи
                </NavLink>
              )}
            </nav>
          </div>

          {user && (
            <div className="flex items-center gap-3 text-sm">
              <Link
                to="/profile"
                className="flex items-center gap-1 text-slate-500 hover:text-slate-900"
                title="Профиль"
              >
                {user.full_name ?? user.email}
                <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                  {user.role}
                </span>
              </Link>
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
