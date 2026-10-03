import React from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, ChevronLeft, UserPlus, Warehouse, Sparkles, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createCompanyOnboarding, loadSaaSContext } from '../services/saas';
import { PALMYRA_PLANS, type PlanCode } from '../config/saas';
import { useStore } from '../store/useStore';

const steps=['Empresa','Almacén','Empleado','Listo'];

export default function Onboarding(){
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const picked=params.get('plan');
  const defaultPlan=(PALMYRA_PLANS.some(p=>p.code===picked)?picked:'starter') as PlanCode;
  const [step,setStep]=React.useState(0);
  const [plan,setPlan]=React.useState<PlanCode>(defaultPlan);
  const [companyName,setCompanyName]=React.useState('');
  const [warehouseName,setWarehouseName]=React.useState('Almacén principal');
  const [employeeName,setEmployeeName]=React.useState('');
  const [employeeCode,setEmployeeCode]=React.useState('EMP-001');
  const [loading,setLoading]=React.useState(false);
  const [error,setError]=React.useState('');
  const [done,setDone]=React.useState(false);

  const goNext=()=>{
    setError('');
    if(step===0){if(companyName.trim().length<2)return setError('Escribe el nombre de la empresa.');setStep(1);return;}
    if(step===1){if(warehouseName.trim().length<2)return setError('Escribe el nombre del almacén.');setStep(2);return;}
    if(step===2){if(employeeName.trim().length<2)return setError('Escribe el nombre del primer empleado.');void finish();}
  };

  const finish=async()=>{
    setLoading(true);setError('');
    try{
      const result=await createCompanyOnboarding({name:companyName,warehouseName,employeeName:employeeName.trim(),employeeCode:employeeCode.trim().toUpperCase()||undefined,planCode:plan});
      const ctx=await loadSaaSContext();
      if(!ctx) throw new Error('La empresa se creó, pero no pudimos actualizar tu sesión.');
      useStore.setState({currentUser:ctx.user,currentBranchId:ctx.warehouseIds[0]||result.warehouse_id});
      window.dispatchEvent(new Event('palmyra:company-ready'));
      setDone(true);setStep(3);
    }catch(err:any){
      const raw=String(err?.message||'No se pudo completar la configuración.');
      setError(raw.replaceAll('_',' '));
    }finally{setLoading(false);}
  };

  if(done)return <div className="min-h-screen bg-[#FAF6F2] px-5 py-10"><div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] bg-[#241622] p-8 text-center text-white shadow-2xl shadow-[#C65B87]/15 sm:p-12"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#C65B87]"><Check size={36}/></div><div className="mt-7 text-[10px] font-black uppercase tracking-[.2em] text-pink-300">PALMYRA</div><h1 className="mt-3 text-4xl font-black">Tu empresa está lista.</h1><p className="mx-auto mt-4 max-w-xl text-white/60">La empresa, el almacén y tu primer empleado ya están configurados. Tu siguiente paso es entrar al panel.</p><button onClick={()=>navigate('/',{replace:true})} className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#C65B87] px-6 py-4 font-black">Entrar a PALMYRA <ArrowRight size={18}/></button></div></div>;

  const currentPlan=PALMYRA_PLANS.find(p=>p.code===plan) || PALMYRA_PLANS[0];

  return <div className="min-h-screen bg-[#FAF6F2] px-5 py-7 text-slate-900">
    <div className="mx-auto flex max-w-6xl items-center justify-between"><Link to="/landing" className="inline-flex items-center gap-2 text-sm font-black text-slate-600"><ArrowLeft size={16}/> PALMYRA</Link><div className="text-xs font-black text-slate-400">Configuración empresarial</div></div>
    <div className="mx-auto max-w-6xl py-8 lg:py-12">
      <div className="mb-7 grid gap-2 sm:grid-cols-4">{steps.map((label,i)=><div key={label} className={i<=step?'rounded-2xl border border-[#D9B2C5] bg-[#F5E6EE] p-3':'rounded-2xl border border-slate-200 bg-white p-3'}><div className="flex items-center gap-2"><div className={i<=step?'flex h-8 w-8 items-center justify-center rounded-xl bg-[#C65B87] text-xs font-black text-white':'flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-400'}>{i<step?<Check size={15}/>:i+1}</div><span className={i<=step?'text-xs font-black text-[#241622]':'text-xs font-bold text-slate-400'}>{label}</span></div></div>)}</div>
      <div className="grid gap-6 lg:grid-cols-[1fr_.34fr]">
        <div className="rounded-[2rem] border border-[#f0dce5] bg-white p-7 shadow-xl shadow-[#C65B87]/10 sm:p-10">
          {error&&<div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
          {step===0&&<div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5E6EE] text-[#C65B87]"><Building2/></div><div className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-[#b77a94]">Paso 1 · Empresa</div><h1 className="mt-2 text-3xl font-black">Crea tu espacio empresarial</h1><p className="mt-2 max-w-xl text-slate-500">Este será el espacio donde vivirán ventas, inventario, almacenes, usuarios y reportes.</p><label className="mt-8 grid gap-2 text-sm font-bold">Nombre de la empresa<input autoFocus value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Ej. Comercial Martínez" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-[#C65B87] focus:ring-4 focus:ring-[#f8dce6]"/></label><div className="mt-7"><div className="mb-3 text-sm font-black">Selecciona el plan</div><div className="grid gap-3 md:grid-cols-3">{PALMYRA_PLANS.map(p=><button type="button" key={p.code} onClick={()=>setPlan(p.code)} className={plan===p.code?'rounded-2xl border-2 border-[#C65B87] bg-[#F5E6EE] p-4 text-left':'rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-[#efb7ca]'}><div className="flex items-center justify-between"><span className="font-black">{p.name}</span>{plan===p.code&&<Check size={17} className="text-[#C65B87]"/>}</div><div className="mt-1 text-2xl font-black">{'$'+p.price}<span className="text-xs font-semibold text-slate-400">/mes</span></div><div className="mt-2 text-[11px] leading-5 text-slate-500">{p.warehouses} almacén{p.warehouses>1?'es':''} · {p.employees} empleados · {p.products} SKUs</div></button>)}</div></div></div>}
          {step===1&&<div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5E6EE] text-[#C65B87]"><Warehouse/></div><div className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-[#b77a94]">Paso 2 · Operación</div><h1 className="mt-2 text-3xl font-black">Configura tu primer almacén</h1><p className="mt-2 max-w-xl text-slate-500">PALMYRA crea este almacén como punto inicial de tu operación.</p><label className="mt-8 grid gap-2 text-sm font-bold">Nombre del almacén<input autoFocus value={warehouseName} onChange={e=>setWarehouseName(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-[#C65B87] focus:ring-4 focus:ring-[#f8dce6]"/></label><div className="mt-5 flex gap-3 rounded-2xl bg-[#F5E6EE] p-4 text-sm text-[#7f3654]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><span>Podrás agregar más almacenes después, respetando el límite del plan.</span></div></div>}
          {step===2&&<div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5E6EE] text-[#C65B87]"><UserPlus/></div><div className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-[#b77a94]">Paso 3 · Equipo</div><h1 className="mt-2 text-3xl font-black">Agrega tu primer empleado</h1><p className="mt-2 max-w-xl text-slate-500">El administrador no cuenta dentro del límite de empleados del plan.</p><div className="mt-8 grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Nombre del empleado<input autoFocus value={employeeName} onChange={e=>setEmployeeName(e.target.value)} placeholder="Ej. Carlos Pérez" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-[#C65B87] focus:ring-4 focus:ring-[#f8dce6]"/></label><label className="grid gap-2 text-sm font-bold">Código<input value={employeeCode} onChange={e=>setEmployeeCode(e.target.value.toUpperCase())} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono outline-none focus:border-[#C65B87] focus:ring-4 focus:ring-[#f8dce6]"/></label></div><div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">El empleado inicial queda vinculado a esta empresa y a su operación.</div></div>}
          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" disabled={loading||step===0} onClick={()=>setStep(s=>Math.max(0,s-1))} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3.5 font-black text-slate-600 disabled:opacity-40"><ChevronLeft size={17}/> Atrás</button><button type="button" onClick={goNext} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#C65B87] px-6 py-3.5 font-black text-white shadow-lg shadow-[#C65B87]/20 disabled:opacity-60">{loading?<><Sparkles className="animate-pulse"/>Creando empresa...</>:<>{step===2?'Crear empresa y entrar':'Continuar'}<ArrowRight size={17}/></>}</button></div>
        </div>
        <aside className="h-fit rounded-[2rem] bg-[#241622] p-6 text-white lg:sticky lg:top-24"><div className="text-[9px] font-black uppercase tracking-[.18em] text-pink-300">Plan activo</div><div className="mt-2 text-2xl font-black">{currentPlan.name}</div><div className="mt-1 text-3xl font-black">{'$'+currentPlan.price}<span className="text-xs font-medium text-white/40"> / mes</span></div><div className="mt-6 space-y-3">{currentPlan.features.slice(0,5).map(f=><div key={f} className="flex gap-2 text-xs text-white/70"><Check size={14} className="mt-0.5 shrink-0 text-pink-300"/>{f}</div>)}</div></aside>
      </div>
    </div>
  </div>;
}
