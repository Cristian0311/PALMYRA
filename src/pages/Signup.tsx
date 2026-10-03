import React from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Mail, ShieldCheck, Sparkles, Store, UserPlus, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signUpSaaSAccount, loadSaaSContext } from '../services/saas';
import { getPlan } from '../config/saas';
import { useStore } from '../store/useStore';

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selectedPlan = getPlan(params.get('plan'));
  const [fullName,setFullName] = React.useState('');
  const [email,setEmail] = React.useState('');
  const [password,setPassword] = React.useState('');
  const [confirm,setConfirm] = React.useState('');
  const [accepted,setAccepted] = React.useState(false);
  const [showPassword,setShowPassword] = React.useState(false);
  const [showConfirm,setShowConfirm] = React.useState(false);
  const [loading,setLoading] = React.useState(false);
  const [error,setError] = React.useState('');
  const [message,setMessage] = React.useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (fullName.trim().length < 2) return setError('Escribe tu nombre completo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Escribe un correo electrónico válido.');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return setError('Usa al menos una mayúscula, una minúscula y un número.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    if (!accepted) return setError('Acepta los términos para continuar.');
    setLoading(true);
    try {
      const {data,error} = await signUpSaaSAccount(fullName, normalizedEmail, password);
      if (error) throw error;
      if (data.session && data.user) {
        const ctx = await loadSaaSContext();
        if (!ctx) throw new Error('La cuenta se creó, pero no pudimos cargar el acceso empresarial. Intenta iniciar sesión.');
        useStore.setState({ currentUser: ctx.user, currentBranchId: ctx.warehouseIds[0] || '' });
        window.dispatchEvent(new Event('palmyra:auth-ready'));
        navigate(ctx.companyId ? '/' : '/onboarding?plan=' + selectedPlan.code,{replace:true});
      } else {
        setMessage('Tu cuenta fue creada. Revisa el correo para confirmar tu acceso y luego inicia sesión para configurar tu empresa.');
      }
    } catch(err:any) {
      const raw = String(err?.message || 'No se pudo crear la cuenta.');
      setError(raw.replace('User already registered','Este correo ya está registrado. Inicia sesión o utiliza otro correo.'));
    } finally { setLoading(false); }
  };

  return <div className="min-h-screen bg-[#fff9fc] px-5 py-7 text-slate-900">
    <div className="mx-auto flex max-w-6xl items-center justify-between"><Link to="/landing" className="inline-flex items-center gap-2 text-sm font-black text-slate-600"><ArrowLeft size={16}/> Volver al sitio</Link><Link to="/login" className="text-sm font-black text-[#d45683]">Ya tengo cuenta</Link></div>
    <div className="mx-auto grid max-w-6xl gap-7 py-8 lg:grid-cols-[.8fr_1.2fr] lg:py-14">
      <aside className="rounded-[2rem] bg-[#351b2a] p-7 text-white shadow-2xl shadow-[#d45683]/15 sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#351b2a]"><Store className="h-5 w-5"/></div>
        <div className="mt-7 text-[10px] font-black uppercase tracking-[.2em] text-pink-300">Plan seleccionado</div>
        <h1 className="mt-2 text-4xl font-black">{selectedPlan.name}</h1>
        <div className="mt-2 flex items-end gap-1"><span className="text-5xl font-black">{'$'+selectedPlan.price}</span><span className="pb-2 text-white/45">/mes</span></div>
        <p className="mt-4 text-sm leading-6 text-white/60">{selectedPlan.description}</p>
        <div className="mt-7 grid gap-3">{selectedPlan.features.map(feature => <div key={feature} className="flex items-start gap-2 text-sm text-white/80"><Check size={16} className="mt-0.5 shrink-0 text-pink-300"/>{feature}</div>)}</div>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-pink-300"/><div><div className="font-black">Espacio empresarial</div><div className="mt-1 text-xs leading-5 text-white/50">Después del alta configurarás empresa, almacén y equipo inicial.</div></div></div></div>
      </aside>

      <form onSubmit={submit} className="rounded-[2rem] border border-[#f0dce5] bg-white p-7 shadow-xl shadow-[#d45683]/10 sm:p-10">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f5] text-[#d45683]"><UserPlus/></div><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-[#b77a94]">Paso 1 de 2</div><h2 className="mt-1 text-3xl font-black">Crea tu cuenta</h2></div></div>
        <p className="mt-3 text-sm leading-6 text-slate-500">Primero creamos el acceso administrador. Después configurarás tu empresa y operación.</p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
        {message && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}
        <div className="mt-7 grid gap-5">
          <label className="grid gap-2 text-sm font-bold">Nombre completo<input required value={fullName} onChange={e=>setFullName(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-[#d45683] focus:ring-4 focus:ring-[#f8dce6]" placeholder="Ej. Ana Martínez" autoComplete="name" disabled={loading}/></label>
          <label className="grid gap-2 text-sm font-bold">Correo electrónico<div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 outline-none focus:border-[#d45683] focus:ring-4 focus:ring-[#f8dce6]" placeholder="tu@empresa.com" autoComplete="email" disabled={loading}/></div></label>
          <label className="grid gap-2 text-sm font-bold">Contraseña<div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input required type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 outline-none focus:border-[#d45683] focus:ring-4 focus:ring-[#f8dce6]" placeholder="Mínimo 8 caracteres" autoComplete="new-password" disabled={loading}/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400" aria-label={showPassword?'Ocultar contraseña':'Mostrar contraseña'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div><span className="text-[11px] font-medium text-slate-400">Usa mayúscula, minúscula y número.</span></label>
          <label className="grid gap-2 text-sm font-bold">Confirmar contraseña<div className="relative"><input required type={showConfirm?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-12 outline-none focus:border-[#d45683] focus:ring-4 focus:ring-[#f8dce6]" autoComplete="new-password" disabled={loading}/><button type="button" onClick={()=>setShowConfirm(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400" aria-label={showConfirm?'Ocultar confirmación':'Mostrar confirmación'}>{showConfirm?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
          <label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[#d45683]" disabled={loading}/><span>Acepto los términos de servicio y entiendo que la cuenta se administrará como una empresa independiente.</span></label>
        </div>
        <button disabled={loading} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d45683] px-5 py-4 font-black text-white shadow-lg shadow-[#d45683]/20 disabled:cursor-not-allowed disabled:opacity-60">{loading?<><Sparkles className="animate-pulse"/>Creando acceso...</>:<>Continuar a configuración<ArrowRight size={17}/></>}</button>
      </form>
    </div>
  </div>;
}
