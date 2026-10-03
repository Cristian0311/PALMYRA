import { useShallow } from 'zustand/react/shallow';
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Store,
  Settings,
  Menu,
  RotateCcw,
  Calculator,
  ArrowLeftRight,
  BarChart,
  UserCircle,
  LogOut,
  Truck,
  ClipboardCheck,
  Wifi,
  WifiOff,
  CloudOff,
  CreditCard,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { useStore } from "../store/useStore";
import { getOfflineQueueCount, processOfflineQueue } from "../services/offlineSync";
import { 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Info, 
  AlertCircle 
} from "lucide-react";

const adminNavItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Punto de Venta", href: "/pos", icon: ShoppingCart },
  { name: "Transferencias", href: "/transfers", icon: ArrowLeftRight },
  { name: "Clientes (POS)", href: "/customers", icon: UserCircle },
  { name: "Inventario", href: "/inventory", icon: Package },
  { name: "Auditoría Stock", href: "/inventory-audit", icon: ClipboardCheck },
  { name: "Proveedores", href: "/suppliers", icon: Truck },
  { name: "Cuentas Bancarias", href: "/banks", icon: CreditCard },
  { name: "Devoluciones", href: "/returns", icon: RotateCcw },
  { name: "Reportes", href: "/reports", icon: BarChart },
  { name: "Configuración", href: "/settings", icon: Settings },
];

const cashierNavItems = [
  { name: "Punto de Venta", href: "/pos", icon: ShoppingCart },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(getOfflineQueueCount());
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const { currentUser, logout, notifications, removeNotification, storeConfig, syncWithSupabase, addNotification } = useStore(useShallow((state) => ({ currentUser: state.currentUser, logout: state.logout, notifications: state.notifications, removeNotification: state.removeNotification, storeConfig: state.storeConfig, syncWithSupabase: state.syncWithSupabase, addNotification: state.addNotification })));
  const location = useLocation();
  const isPosPage = location.pathname === "/pos";

  // Efecto para el Modo Oscuro (Mejorado para Miopía: contraste suave)
  useEffect(() => {
    if (storeConfig.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [storeConfig.darkMode]);

  useEffect(() => {
    const updateCount = () => setPendingOfflineCount(getOfflineQueueCount());
    const handleOnline = () => {
      setIsOnline(true);
      updateCount();
    };
    const handleOffline = () => {
      setIsOnline(false);
      updateCount();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline_queue_updated', updateCount);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline_queue_updated', updateCount);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncingOffline) return;
    setIsSyncingOffline(true);
    try {
      const res = await processOfflineQueue();
      setPendingOfflineCount(res.remaining);
      const cloudResult = await syncWithSupabase();
      if (res.remaining > 0 || cloudResult?.success === false) {
        addNotification(`Sincronización incompleta: quedan ${res.remaining} operaciones pendientes.`, 'warning');
      } else {
        addNotification("Sincronización con la nube completada con éxito", 'success');
      }
    } catch {
      addNotification("Error al sincronizar con Supabase", 'error');
    } finally {
      setIsSyncingOffline(false);
    }
  };

  // Auto-collapse sidebar on POS page to maximize tablet space
  useEffect(() => {
    if (isPosPage) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
    }
  }, [isPosPage]);

  const navItems =
    currentUser?.role === "admin" ? adminNavItems : cashierNavItems;

  return (
    <div className="h-[100dvh] w-full min-h-[100dvh] max-h-[100dvh] overflow-hidden bg-primary text-primary flex flex-col md:flex-row relative overscroll-none transition-colors duration-200">
      {/* Sistema de Notificaciones Globales */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {notifications.map((n) => (
          <div 
            key={n.id} 
            className={cn(
              "pointer-events-auto min-w-[280px] p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right-4 duration-300",
              n.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" :
              n.type === 'error' ? "bg-rose-50 border-rose-100 text-rose-800" :
              n.type === 'warning' ? "bg-amber-50 border-amber-100 text-amber-800" :
              "bg-indigo-50 border-indigo-100 text-indigo-800"
            )}
          >
            <div className="shrink-0">
              {n.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {n.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
              {n.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
              {n.type === 'info' && <Info className="w-5 h-5 text-indigo-500" />}
            </div>
            <div className="flex-1 text-[11px] font-black uppercase tracking-tight leading-tight">
              {n.message}
            </div>
            <button 
              onClick={() => removeNotification(n.id)}
              className="shrink-0 p-1 hover:bg-black/5 rounded-full transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      {/* Mobile Top Bar (Only when not on POS or if POS wants it) */}
      {!isPosPage && (
        <div className="md:hidden bg-indigo-600 text-white p-3.5 flex justify-between items-center shadow-md shrink-0">
          <h1 className="text-lg font-bold tracking-tight">MARÉ POS</h1>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      )}

      <aside
        className={cn(
          "bg-secondary border-r border-base transition-all duration-300 ease-in-out flex flex-col h-full shrink-0 shadow-sm",
          // Mobile: off-canvas drawer with fixed overlay
          "fixed inset-y-0 left-0 z-50",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop / Tablet (md+): relative in-flow column, NEVER covers or overlaps the right content
          "md:relative md:inset-auto md:z-auto md:translate-x-0",
          sidebarCollapsed ? "md:w-16" : "md:w-64"
        )}
      >
        {/* Header with Collapse toggle */}
        <div className={cn("p-4 shrink-0 flex items-center justify-between border-b border-subtle", sidebarCollapsed && "md:p-3 md:justify-center")}>
          <div className={cn("flex flex-col min-w-0", sidebarCollapsed && "md:hidden")}>
            <h1 className="text-lg font-black tracking-tight text-primary uppercase truncate">
              MARÉ<span className="text-indigo-600"> POS</span>
            </h1>
            <p className="text-[7px] text-muted uppercase tracking-[0.2em] font-black">Enterprise CRM</p>
          </div>
          
          <button 
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title={sidebarCollapsed ? "Expandir menú" : "Minimizar menú"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.name : undefined}
              >
                {({ isActive }) => (
                  <div className={cn(
                    "flex items-center rounded-xl transition-all duration-150 group",
                    sidebarCollapsed ? "justify-center p-2.5 my-1" : "space-x-3 px-3.5 py-2.5",
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-muted hover:bg-subtle hover:text-primary"
                  )}>
                    <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-white" : "text-muted group-hover:text-indigo-600")} />
                    {!sidebarCollapsed && (
                      <span className="font-black text-[9px] uppercase tracking-wider truncate">{item.name}</span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className={cn("shrink-0 p-3 bg-secondary border-t border-subtle", sidebarCollapsed && "md:p-2 md:items-center")}>
          <div className={cn("mb-2 space-y-1.5", sidebarCollapsed && "md:hidden")}>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncingOffline || !isOnline}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border",
                !isOnline
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : pendingOfflineCount > 0
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20 cursor-pointer"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              )}
              title={pendingOfflineCount > 0 ? "Clic para sincronizar datos pendientes con Supabase" : undefined}
            >
              <div className="flex items-center gap-1.5 truncate">
                {isSyncingOffline ? (
                  <RefreshCw className="w-3 h-3 animate-spin shrink-0 text-indigo-500" />
                ) : isOnline ? (
                  <Wifi className="w-3 h-3 shrink-0" />
                ) : (
                  <WifiOff className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">
                  {!isOnline ? "Modo Offline" : (pendingOfflineCount > 0 ? (isSyncingOffline ? "Subiendo..." : "Sincronizar") : "Online")}
                </span>
              </div>
              {pendingOfflineCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[7px] font-black bg-amber-500 text-white shrink-0">
                  {pendingOfflineCount}
                </span>
              )}
            </button>
          </div>

          <div className={cn("flex items-center gap-2 mb-2", sidebarCollapsed && "md:justify-center md:mb-1")}>
            <div className="w-7 h-7 rounded-full bg-subtle border border-base flex items-center justify-center text-primary font-black text-[9px] uppercase shrink-0 shadow-sm">
              {currentUser?.name.charAt(0)}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black text-primary uppercase leading-tight truncate">
                  {currentUser?.name}
                </p>
                <p className="text-[7px] text-muted uppercase tracking-wider font-bold truncate">
                  {currentUser?.role}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={logout}
            className={cn(
              "flex items-center text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all font-black uppercase",
              sidebarCollapsed ? "justify-center p-2 w-full" : "space-x-2 px-3 py-2 w-full text-[10px] tracking-wider"
            )}
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Salir</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative h-full">
        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div className={cn("flex-1 min-w-0 h-full flex flex-col scroll-touch", isPosPage ? "overflow-hidden p-0" : "overflow-y-auto p-4 md:p-6 pb-20 md:pb-12")}>
          {children}
        </div>
      </main>
    </div>
  );
}
