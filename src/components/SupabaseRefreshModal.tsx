import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RefreshCw, Database, CheckCircle2, AlertCircle, Sparkles, X, Package, Layers, Store, Users, ShoppingCart, CreditCard, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

interface SupabaseRefreshModalProps {
  buttonClassName?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'compact' | 'pos';
  label?: string;
}

export function SupabaseRefreshModal({ buttonClassName, variant = 'primary', label }: SupabaseRefreshModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncReport, setSyncReport] = useState<{
    success: boolean;
    message: string;
    counts?: Record<string, number>;
    errors?: string[];
  } | null>(null);

  const { syncWithSupabase, addNotification } = useStore(useShallow((state) => ({ syncWithSupabase: state.syncWithSupabase, addNotification: state.addNotification })));

  const handleExecuteRefresh = async () => {
    setIsLoading(true);
    setSyncReport(null);
    try {
      const result = await syncWithSupabase();
      if (result) {
        setSyncReport({
          success: result.success,
          message: result.message,
          counts: result.counts,
          errors: result.errors
        });
        if (result.success) {
          addNotification("Sistema reactualizado exitosamente desde Supabase", 'success');
        } else {
          addNotification("Resumen de sincronización generado con advertencias", 'warning');
        }
      } else {
        setSyncReport({
          success: false,
          message: "No se obtuvo respuesta de Supabase"
        });
      }
    } catch (err: any) {
      setSyncReport({
        success: false,
        message: err?.message || "Error al conectar con Supabase"
      });
    } finally {
      setIsLoading(false);
      setIsOpen(true);
    }
  };

  const buttonText = label || "Reactualizar Sistema desde Supabase";

  return (
    <>
      {variant === 'pos' ? (
        <button
          type="button"
          onClick={handleExecuteRefresh}
          disabled={isLoading}
          className={cn(
            "px-2.5 sm:px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-indigo-950/40 active:scale-95 border border-indigo-500/40 cursor-pointer disabled:opacity-50",
            buttonClassName
          )}
          title="Sincronizar y actualizar completamente todos los datos con Supabase real"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-indigo-200", isLoading && "animate-spin")} />
          <span>{isLoading ? "Cargando..." : "Reactualizar Datos"}</span>
        </button>
      ) : variant === 'compact' ? (
        <button
          type="button"
          onClick={handleExecuteRefresh}
          disabled={isLoading}
          className={cn(
            "px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-indigo-200 dark:border-indigo-800",
            buttonClassName
          )}
          title="Sincronizar y cargar información real de Supabase"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400", isLoading && "animate-spin")} />
          <span>{isLoading ? "Cargando..." : (label || "Reactualizar Supabase")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleExecuteRefresh}
          disabled={isLoading}
          className={cn(
            "px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-indigo-400/30",
            buttonClassName
          )}
        >
          <RefreshCw className={cn("w-4 h-4 text-indigo-100", isLoading && "animate-spin")} />
          <span>{isLoading ? "Obteniendo datos de Supabase..." : buttonText}</span>
        </button>
      )}

      {/* Modal de Confirmación y Resultados */}
      {isOpen && syncReport && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            {/* Header Modal */}
            <div className={cn(
              "p-6 text-white relative",
              syncReport.success ? "bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950" : "bg-gradient-to-r from-rose-900 to-slate-900"
            )}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                  syncReport.success ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                )}>
                  {syncReport.success ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight leading-none text-white">
                    {syncReport.success ? "Sistema Reactualizado" : "Sincronización Finalizada"}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">
                    Base de Datos Supabase en Vivo
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                  {syncReport.message}
                </p>
              </div>

              {syncReport.counts && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Registros Reales Sincronizados
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">Productos:</span>
                      </div>
                      <span className="font-black text-indigo-700 dark:text-indigo-300">{syncReport.counts.products || 0}</span>
                    </div>

                    <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">Stock/Inventario:</span>
                      </div>
                      <span className="font-black text-indigo-700 dark:text-indigo-300">{syncReport.counts.inventory || 0}</span>
                    </div>

                    <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">Sucursales:</span>
                      </div>
                      <span className="font-black text-indigo-700 dark:text-indigo-300">{syncReport.counts.branches || 0}</span>
                    </div>

                    <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">Usuarios/Personal:</span>
                      </div>
                      <span className="font-black text-indigo-700 dark:text-indigo-300">{syncReport.counts.users || 0}</span>
                    </div>

                    <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">Transacciones:</span>
                      </div>
                      <span className="font-black text-indigo-700 dark:text-indigo-300">{syncReport.counts.transactions || 0}</span>
                    </div>

                    <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">Tarjetas Bancarias:</span>
                      </div>
                      <span className="font-black text-indigo-700 dark:text-indigo-300">{syncReport.counts.bankCards || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {syncReport.errors && syncReport.errors.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
                  <p className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400">Observaciones de Tablas:</p>
                  <ul className="text-[10px] font-bold text-amber-700 dark:text-amber-300 list-disc pl-4 space-y-0.5">
                    {syncReport.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
              >
                Aceptar y Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
