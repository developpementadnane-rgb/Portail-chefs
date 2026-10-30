import { X, LogOut, Home, User, Users, FileText, Calendar, Lightbulb, QrCode, ClipboardList, UserCog, DatabaseZap, ShieldAlert, Images, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { logoutChef } from '../lib/authService';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const handleLogout = () => {
    logoutChef();
    window.location.href = '/login';
  };

  const menuItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
    { icon: User, label: 'Mon compte', href: '/account' },
    { icon: Users, label: 'Comptes des membres', href: '/members' },
    { icon: UserCheck, label: 'Demandes en attente', href: '/pending-registrations' },
    { icon: FileText, label: 'Rapports', href: '/reports' },
    { icon: FileText, label: 'Rapports Quotidiens', href: '/daily-reports' },
    { icon: Calendar, label: 'Séances', href: '/sessions' },
    { icon: QrCode, label: 'Scanner présence', href: '/attendance-scan' },
    { icon: ShieldAlert, label: "Page d'urgence", href: '/emergency-access' },
    { icon: DatabaseZap, label: 'Espace de stockage', href: '/sync-cache' },
    { icon: ClipboardList, label: 'Adhésion', href: '/membership' },
    { icon: Images, label: 'Galerie', href: '/gallery' },
    { icon: UserCog, label: 'Gestion adhésion', href: '/membership/manage' },
    { icon: Lightbulb, label: 'Boîte à idées', href: '/ideas' },
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 z-40 md:static md:translate-x-0 md:shadow-none md:h-auto md:w-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Menu</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col">
          {menuItems.map(({ icon: Icon, label, href }) => (
            <Link
              key={href}
              to={href}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-shm-red/10 hover:text-shm-red transition-colors border-l-4 border-transparent hover:border-shm-red"
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="md:hidden border-t border-gray-200 my-4" />

        {/* Logout - Mobile */}
        <button
          onClick={handleLogout}
          className="md:hidden w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Déconnexion</span>
        </button>
      </aside>
    </>
  );
}
