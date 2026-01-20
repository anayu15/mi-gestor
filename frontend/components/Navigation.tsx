'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if we're on the chat page (dark theme)
  const isDarkTheme = pathname === '/dashboard';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const baseNavItems = [
    { href: '/dashboard', label: 'Chat', icon: '💬' },
    { href: '/tesoreria', label: 'Tesorería' },
    { href: '/facturas', label: 'Facturas' },
  ];

  // Build nav items in desired order: Chat, Tesorería, Facturas, Fiscal, Documentos
  const navItems = [
    ...baseNavItems,
    { href: '/fiscal/calendario', label: 'Fiscal' },
    { href: '/documentos', label: 'Documentos' }
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className={isDarkTheme ? 'bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50' : 'bg-white shadow'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <Link 
            href="/dashboard" 
            className={`text-2xl font-bold transition-colors ${
              isDarkTheme 
                ? 'text-white hover:text-emerald-400' 
                : 'text-gray-900 hover:text-blue-600'
            }`}
          >
            miGestor
          </Link>
          <nav className="flex gap-4 items-center">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors ${
                  isActive(item.href)
                    ? isDarkTheme
                      ? 'text-emerald-400 font-medium'
                      : 'text-blue-600 font-medium'
                    : isDarkTheme
                      ? 'text-slate-300 hover:text-emerald-400'
                      : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${
                  isDropdownOpen
                    ? isDarkTheme
                      ? 'border-emerald-400 text-emerald-400'
                      : 'border-blue-600 text-blue-600'
                    : isDarkTheme
                      ? 'border-slate-500 text-slate-300 hover:border-emerald-400 hover:text-emerald-400'
                      : 'border-gray-600 text-gray-600 hover:border-blue-600 hover:text-blue-600'
                }`}
                aria-label="User menu"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg py-1 z-50 border ${
                  isDarkTheme 
                    ? 'bg-slate-800 border-slate-700' 
                    : 'bg-white border-gray-200'
                }`}>
                  <Link
                    href="/fiscal/calendario"
                    className={`block px-4 py-2 text-sm transition-colors ${
                      isDarkTheme
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Calendario Fiscal
                  </Link>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleLogout();
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      isDarkTheme
                        ? 'text-red-400 hover:bg-slate-700'
                        : 'text-red-600 hover:bg-gray-100'
                    }`}
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
