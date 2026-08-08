import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Compass, 
  Users, 
  MessageSquare, 
  Briefcase, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  X, 
  Globe, 
  LayoutDashboard,
  UserCheck,
  ShieldAlert,
  Bell,
  Sun,
  Sparkles,
  ChevronDown,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { notificationService } from '../services/api';

export const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const moreRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    navigate('/');
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadNotifs = async () => {
      try {
        const data = await notificationService.getNotifications();
        setNotifications(data || []);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    };
    loadNotifs();
    const interval = setInterval(loadNotifs, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreDropdownOpen(false);
    setNotifDropdownOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  const isAdminUser = user?.email?.toLowerCase() === 'admin@tripmate.com' || user?.role?.toLowerCase() === 'admin';

  const primaryNavLinks = isAuthenticated
    ? [
        { label: 'AI Planner', path: '/ai-planner', icon: Sparkles },
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Discover', path: '/discover', icon: Compass },
        { label: 'Buddies', path: '/travel-buddies', icon: Users },
        { label: 'My Trips', path: '/trips', icon: Briefcase },
        { label: 'Connections', path: '/connections', icon: Globe },
        { label: 'Chat', path: '/chat', icon: MessageSquare },
      ]
    : [
        { label: 'Home', path: '/' },
        { label: 'How It Works', path: '/#how-it-works', isScroll: true },
        { label: 'Features', path: '/#features', isScroll: true },
        { label: 'Safety', path: '/#safety', isScroll: true },
      ];

  const moreLinks = isAuthenticated
    ? [
        { label: 'Weather Forecast', path: '/weather', icon: Sun },
        { label: 'Buddy Requests', path: '/requests', icon: UserCheck },
        ...(isAdminUser ? [{ label: 'Admin Dashboard', path: '/admin', icon: ShieldAlert }] : []),
      ]
    : [];

  const handleNavClick = (link: any) => {
    setMobileMenuOpen(false);
    setMoreDropdownOpen(false);
    if (link.isScroll) {
      const id = link.path.split('#')[1];
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate('/');
        setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    } else {
      navigate(link.path);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all duration-150">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-3">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 group">
              <div className="bg-brand-600 group-hover:bg-brand-700 p-1.5 rounded-lg text-white shadow-sm transition-colors">
                <Globe size={15} />
              </div>
              <span className="flex items-center gap-1">
                <span>TripMate</span>
                <span className="bg-brand-50 text-brand-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-brand-200">AI</span>
              </span>
            </Link>

            {/* Desktop Primary Nav Links */}
            <div className="hidden lg:flex items-center gap-0.5">
              {primaryNavLinks.map((link) => {
                const active = isActive(link.path);
                const IconComponent = (link as any).icon;
                return (
                  <button
                    key={link.path}
                    onClick={() => handleNavClick(link)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium tracking-normal transition-colors ${
                      active
                        ? 'text-brand-700 bg-brand-50 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    {IconComponent && <IconComponent size={13} className={active ? 'text-brand-600' : 'text-slate-400'} />}
                    <span>{link.label}</span>
                  </button>
                );
              })}

              {/* Desktop "More" Dropdown */}
              {isAuthenticated && moreLinks.length > 0 && (
                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      moreLinks.some(l => isActive(l.path))
                        ? 'text-brand-700 bg-brand-50 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <span>More</span>
                    <ChevronDown size={12} className={`transition-transform duration-150 ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {moreDropdownOpen && (
                    <div className="absolute left-0 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-black/5 animate-slide-up z-50 divide-y divide-slate-100">
                      {moreLinks.map((link) => {
                        const Icon = link.icon;
                        const active = isActive(link.path);
                        return (
                          <button
                            key={link.path}
                            onClick={() => handleNavClick(link)}
                            className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                              active ? 'text-brand-700 bg-brand-50 font-semibold' : 'text-slate-700 hover:bg-slate-50 hover:text-brand-600'
                            }`}
                          >
                            <Icon size={13} className="text-slate-400 shrink-0" />
                            <span>{link.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Right Side Actions */}
          <div className="hidden lg:flex items-center gap-2.5">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                
                {/* Plan Trip CTA */}
                <Link to="/trips/create">
                  <Button size="sm" className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium gap-1 h-7.5 px-2.5">
                    <Plus size={13} />
                    <span>New Trip</span>
                  </Button>
                </Link>

                {/* Notifications Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                    className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Notifications"
                  >
                    <Bell size={16} />
                    {unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {notifDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-76 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-black/5 animate-slide-up text-left z-50">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={async () => {
                              await notificationService.markAllAsRead();
                              setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                            }}
                            className="text-[10px] font-medium text-brand-600 hover:text-brand-800 underline"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 space-y-1 pr-1">
                        {notifications.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400 font-normal">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`p-2 rounded-xl transition-colors relative ${
                                n.is_read ? 'opacity-70 bg-white hover:bg-slate-50' : 'bg-brand-50/40 hover:bg-brand-50/70 font-medium'
                              }`}
                            >
                              <div
                                onClick={async () => {
                                  if (!n.is_read) {
                                    await notificationService.markAsRead(n.id);
                                    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
                                  }
                                  setNotifDropdownOpen(false);
                                  if (n.link) navigate(n.link);
                                }}
                                className="cursor-pointer text-xs leading-relaxed text-slate-800 pr-4"
                              >
                                <div className="font-semibold text-slate-900 text-xs">{n.title}</div>
                                <div className="text-[11px] text-slate-600 mt-0.5">{n.message}</div>
                                <span className="text-[9px] text-slate-400 font-normal block mt-0.5">
                                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await notificationService.deleteNotification(n.id);
                                  setNotifications(prev => prev.filter(item => item.id !== n.id));
                                }}
                                className="absolute top-2 right-2 text-slate-400 hover:text-rose-500 p-0.5"
                                title="Dismiss"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Avatar & Dropdown */}
                <div className="relative" ref={userRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-1.5 p-1 pl-1 pr-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-colors text-xs font-medium text-slate-700"
                  >
                    {user?.profile_photo ? (
                      <img
                        src={user.profile_photo}
                        alt={user.name}
                        className="w-5 h-5 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                        <UserIcon size={11} />
                      </div>
                    )}
                    <span className="max-w-[90px] truncate">{user?.name?.split(' ')[0] || 'Account'}</span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-black/5 animate-slide-up text-left z-50 divide-y divide-slate-100">
                      <div className="px-2.5 py-1.5 text-xs">
                        <div className="font-semibold text-slate-900 truncate">{user?.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{user?.email}</div>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/profile"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600"
                        >
                          <UserIcon size={13} className="text-slate-400" />
                          <span>Profile</span>
                        </Link>
                        <Link
                          to="/trips"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600"
                        >
                          <Briefcase size={13} className="text-slate-400" />
                          <span>My Trips</span>
                        </Link>
                      </div>
                      <div className="pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          <LogOut size={13} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-xs h-8">Log In</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="text-xs h-8">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Right Controls */}
          <div className="flex lg:hidden items-center gap-1">
            {isAuthenticated && (
              <Link
                to="/requests"
                className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Requests"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[7px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-5 space-y-2 shadow-lg animate-slide-up text-left max-h-[85vh] overflow-y-auto">
          {isAuthenticated && (
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between mb-2">
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 min-w-0"
              >
                {user?.profile_photo ? (
                  <img
                    src={user.profile_photo}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <UserIcon size={14} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">{user?.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{user?.email}</div>
                </div>
              </Link>
              <Link to="/trips/create" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="text-xs h-7 px-2 rounded-md">
                  <Plus size={11} />
                  <span>Trip</span>
                </Button>
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
            {[...primaryNavLinks, ...moreLinks].map((link) => {
              const Icon = (link as any).icon;
              const active = isActive(link.path);
              return (
                <button
                  key={link.path}
                  onClick={() => handleNavClick(link)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    active
                      ? 'text-brand-700 bg-brand-50 font-semibold'
                      : 'text-slate-700 hover:text-brand-600 hover:bg-slate-50'
                  }`}
                >
                  {Icon && <Icon size={14} className={active ? 'text-brand-600' : 'text-slate-400'} />}
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100">
            {isAuthenticated ? (
              <Button
                variant="outline"
                className="w-full justify-center gap-1.5 text-xs py-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={handleLogout}
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
                  <Button variant="outline" className="w-full text-xs">Log In</Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="w-full">
                  <Button className="w-full text-xs">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
