import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Server, 
  Database, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Terminal,
  Cpu,
  Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type SetupStep = 'master-auth' | 'server-config' | 'db-config' | 'admin-account' | 'finalizing';

export default function Setup() {
  const [step, setStep] = useState<SetupStep>('master-auth');
  const [masterPassword, setMasterPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState({
    supabaseUrl: '',
    supabaseKey: '',
    renderUrl: '',
    companyName: '',
    adminEmail: '',
    adminPassword: ''
  });
  const navigate = useNavigate();

  const handleMasterAuth = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/verify-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword })
      });
      const data = await res.json();
      if (data.success) {
        setStep('server-config');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setIsVerifying(false);
    }
  };

  const [installResult, setInstallResult] = useState<any>(null);

  const handleInitialize = async () => {
    setStep('finalizing');
    setIsVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          masterPassword,
          ...config 
        })
      });
      const data = await res.json();
      if (data.success) {
        setInstallResult(data);
        // Step to show results
      } else {
        setError(data.error);
        setStep('db-config');
      }
    } catch (err) {
      setError('Error durante la inicialización');
      setStep('db-config');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* ... background elements ... */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight uppercase">Nexus Installer</h1>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">System Architect Tool v1.0</p>
            </div>
          </div>
          <div className="hidden sm:flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className={`w-8 h-1 rounded-full transition-all duration-500 ${
                  (step === 'master-auth' && i === 1) ||
                  (step === 'server-config' && i === 2) ||
                  (step === 'db-config' && i === 3) ||
                  (step === 'admin-account' && i === 4) ||
                  (step === 'finalizing' || installResult)
                    ? 'bg-indigo-500' : 'bg-slate-800'
                }`} 
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 min-h-[400px] flex flex-col">
          <AnimatePresence mode="wait">
            {installResult ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8 py-4"
              >
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500/20">
                    <CheckCircle2 className="text-emerald-500 w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">¡Instalación Exitosa!</h2>
                  <p className="text-slate-400 text-sm">{installResult.message}</p>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Resumen del Despliegue</h3>
                  <div className="grid gap-3">
                    {installResult.summary.map((item: string, idx: number) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={idx} 
                        className="flex items-center gap-3 text-slate-300 text-sm"
                      >
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        {item}
                      </motion.div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => navigate('/login')}
                  className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  Ir al Panel de Control
                  <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            ) : step === 'master-auth' ? (
              <motion.div 
                key="master"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="text-slate-400 w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Autenticación de Arquitecto</h2>
                  <p className="text-slate-400 text-sm">Ingresa la clave maestra del sistema Nexus para comenzar la configuración.</p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input 
                      type="password"
                      placeholder="••••••••••••"
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 text-white pl-12 pr-4 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600 font-mono"
                      onKeyDown={(e) => e.key === 'Enter' && handleMasterAuth()}
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-rose-400 bg-rose-400/10 p-4 rounded-xl border border-rose-400/20">
                      <AlertCircle className="w-5 h-5" />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}
                  <button 
                    onClick={handleMasterAuth}
                    disabled={isVerifying || !masterPassword}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                  >
                    {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                    Acceder al Wizard
                  </button>
                </div>
              </motion.div>
            ) : step === 'server-config' ? (
              <motion.div 
                key="server"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                    <Server className="text-indigo-400 w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Configuración del Servidor</h2>
                    <p className="text-slate-400 text-sm">Detalles de la instancia de Render o VPS.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nombre de la Empresa</label>
                    <input 
                      type="text"
                      placeholder="Ej: Nexus Corporativo"
                      value={config.companyName}
                      onChange={(e) => setConfig({...config, companyName: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">URL de Despliegue (Render/VPS)</label>
                    <input 
                      type="text"
                      placeholder="https://nexus-crm.onrender.com"
                      value={config.renderUrl}
                      onChange={(e) => setConfig({...config, renderUrl: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setStep('master-auth')}
                      className="flex-1 border border-slate-700 text-slate-400 font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all"
                    >
                      Atrás
                    </button>
                    <button 
                      disabled={!config.companyName || !config.renderUrl}
                      onClick={() => setStep('db-config')}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : step === 'db-config' ? (
              <motion.div 
                key="db"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <Database className="text-emerald-400 w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Infraestructura de Datos</h2>
                    <p className="text-slate-400 text-sm">Conecta tu instancia de Supabase o PostgreSQL.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Supabase URL</label>
                    <input 
                      type="text"
                      placeholder="https://xxx.supabase.co"
                      value={config.supabaseUrl}
                      onChange={(e) => setConfig({...config, supabaseUrl: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Supabase Anon Key</label>
                    <input 
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                      value={config.supabaseKey}
                      onChange={(e) => setConfig({...config, supabaseKey: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setStep('server-config')}
                      className="flex-1 border border-slate-700 text-slate-400 font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all"
                    >
                      Atrás
                    </button>
                    <button 
                      disabled={!config.supabaseUrl || !config.supabaseKey}
                      onClick={() => setStep('admin-account')}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                    >
                      Validar y Continuar
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : step === 'admin-account' ? (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                    <UserPlus className="text-amber-400 w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Admin de la Empresa</h2>
                    <p className="text-slate-400 text-sm">Crea el primer usuario con rol Administrador para el cliente.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Email del Admin</label>
                    <input 
                      type="email"
                      placeholder="admin@empresa.com"
                      value={config.adminEmail}
                      onChange={(e) => setConfig({...config, adminEmail: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Contraseña Inicial</label>
                    <input 
                      type="password"
                      placeholder="••••••••"
                      value={config.adminPassword}
                      onChange={(e) => setConfig({...config, adminPassword: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setStep('db-config')}
                      className="flex-1 border border-slate-700 text-slate-400 font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all"
                    >
                      Atrás
                    </button>
                    <button 
                      disabled={!config.adminEmail || !config.adminPassword}
                      onClick={handleInitialize}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
                    >
                      Finalizar Instalación
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="final"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center space-y-6 py-10"
              >
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"
                  />
                  <Terminal className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white">Instalando Nexus System</h2>
                  <p className="text-slate-400 text-sm max-w-sm">
                    Estamos configurando las tablas de la base de datos, creando el admin inicial y vinculando los servicios cloud. No cierres esta ventana.
                  </p>
                </div>
                <div className="w-full max-w-xs bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3 }}
                    className="h-full bg-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono uppercase tracking-[0.2em]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Ejecutando script_migracion_v1.sql
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Info */}
        <div className="px-8 py-4 bg-slate-900/80 border-t border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Entorno Seguro SSL/TLS</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            BUILD_ID: 2026.07.02_REV3
          </div>
        </div>
      </motion.div>
    </div>
  );
}
