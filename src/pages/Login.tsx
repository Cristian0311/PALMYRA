import React from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck, Store } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { loadSaaSContext, signInSaaSAccount } from '../services/saas';

export default function Login() {
  const navigate = useNavigate();
  const [email,setEmail]=React.useState('');
  const [password,setPassword]=React.useState('');
  const [loading,setLoading]=React.useState(false);
  const [error,setError]=React.useState('');

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const {data,error}=await signInSaaSAccount(email,password);
      if(error) throw error;
      const ctx=await loadSaaSContext();
      if(!ctx || !data.user) throw new Error('No se pudo cargar tu cuenta empresarial.');
      useStore.setState({currentUser:ctx.user,currentBranchId:ctx.warehouseIds[0]||''});
      navigate(ctx.companyId?'/':'/onboarding',{replace:true});
    } catch(err:any) {
      setError(err?.message||'Correo o contraseña incorrectos.');
    } finally { setLoading(false); }
  };

  return <div className="min-h-screen bg-[#fff8fb] px-5 py-8 text-slate-900">
    <div className="mx-auto max-w-5xl"><Link to="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-600"><ArrowLeft size={16}/> PALMYRA POS</Link>
      <div className="mx-auto grid max-w-5xl gap-8 py-10 lg:grid-cols-[.85fr_1.15fr] lg:py-20">
        <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl shadow-rose-200/40">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500"><Store/></div>
          <div className="mt-8 text-sm font-black uppercase tracking-[.2em] text-rose-300">PALMYRA POS</div>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Tu negocio, bajo control.</h1>
          <p className="mt-4 text-sm leading-7 text-white/60">Accede a ventas, inventario, almacenes, clientes y reportes desde tu espacio empresarial.</p>
          <div className="mt-8 grid gap-3 text-sm text-white/75"><div className="flex gap-2"><ShieldCheck size={17} className="text-rose-300"/> Datos separados por empresa</div><div className="flex gap-2"><ShieldCheck size={17} className="text-rose-300"/> Capacidades controladas por plan</div><div className="flex gap-2"><ShieldCheck size={17} className="text-rose-300"/> Acceso para tu equipo</div></div>
          <Link to="/signup" className="mt-10 inline-flex items-center gap-2 text-sm font-black text-rose-300">Crear una cuenta <ArrowRight size={16}/></Link>
        </div>
        <form onSubmit={submit} className="rounded-[2rem] border border-rose-100 bg-white p-7 shadow-xl shadow-rose-100/50 sm:p-10">
          <h2 className="text-3xl font-black">Iniciar sesión</h2><p className="mt-2 text-sm text-slate-500">Entra a tu cuenta de PALMYRA POS.</p>
          {error&&<div className="mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700"><ShieldCheck size={17} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
          <div className="mt-7 grid gap-5">
            <label className="grid gap-2 text-sm font-bold">Correo electrónico<div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100" placeholder="tu@empresa.com"/></div></label>
            <label className="grid gap-2 text-sm font-bold">Contraseña<div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100" placeholder="Tu contraseña"/></div></label>
          </div>
          <button disabled={loading} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-4 font-black text-white shadow-lg shadow-rose-200 disabled:opacity-60">{loading?'Entrando...':'Entrar a PALMYRA'}<ArrowRight size={17}/></button>
          <p className="mt-6 text-center text-sm text-slate-500">¿Aún no tienes cuenta? <Link className="font-black text-rose-600" to="/signup">Crear cuenta</Link></p>
        </form>
      </div>
    </div>
  </div>;
}
