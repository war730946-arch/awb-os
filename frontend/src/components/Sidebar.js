'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, MessageSquare, Settings, CreditCard, LogOut } from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/businesses', label: 'Businesses', icon: Building2 },
  { href: '/dashboard/chat', label: 'Chat History', icon: MessageSquare },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/subscription', label: 'Subscription', icon: CreditCard },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('awb_token');
    router.push('/');
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-5 mb-6">
        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
          <span className="text-xl">🤖</span>
        </div>
        <div>
          <h2 className="font-bold text-gray-900">AWB-OS</h2>
          <p className="text-xs text-gray-400">AI WhatsApp OS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="sidebar-link text-red-500 hover:bg-red-50 hover:text-red-600 mt-2"
      >
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </aside>
  );
}
