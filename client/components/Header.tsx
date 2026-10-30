import { LogOut, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { logoutChef, getCurrentChef } from '../lib/authService';

interface HeaderProps {
  onMenuClick: () => void;
  userName?: string;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const currentChef = getCurrentChef();
  const displayName = currentChef?.firstName || 'Chef';

  const handleLogout = () => {
    logoutChef();
    window.location.href = '/login';
  };

  return (
    <header className="shm-gradient sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo + Title */}
        <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2Fa9ce189e82c94247a809e38e319392c1%2Ff8865e41e45c4ddf97ad76d8d6891080?format=webp&width=100&height=100"
            alt="SHM Logo"
            className="w-12 h-12 md:w-14 md:h-14"
          />
          <div className="hidden sm:block">
            <p className="text-white font-semibold text-sm">Portail des Chefs</p>
            <p className="text-white/70 text-xs">Gestion & Supervision</p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <nav className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-white hover:text-gray-200 transition-colors font-medium text-sm"
            >
              Dashboard
            </Link>
            <Link
              to="/account"
              className="text-white hover:text-gray-200 transition-colors font-medium text-sm"
            >
              Mon Compte
            </Link>
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* User Info - Desktop Only */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-white font-semibold text-sm">{displayName}</p>
              <p className="text-white/70 text-xs">{currentChef?.role === 'main' ? 'Chef Principal' : 'Chef'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-200"
              title="Déconnexion"
            >
              <LogOut size={20} />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="md:hidden text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-200"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>
    </header>
  );
}
