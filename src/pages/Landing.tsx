import React from 'react';
import {
  ArrowRight, BarChart3, Boxes, Check, ChevronDown, ChevronRight, Cloud,
  CreditCard, Gauge, Menu, Package, ReceiptText, ShieldCheck, ShoppingCart,
  Sparkles, Store, Users, WalletCards, X, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PALMYRA_PLANS } from '../config/saas';

const featureCards = [
  { icon: ShoppingCart, title: 'Punto de venta', text: 'Cobros rápidos, carrito inteligente, caja y ventas pensadas para la operación diaria.' },
  { icon: Package, title: 'Inventario', text: 'Controla productos, existencias, mínimos y movimientos sin perder visibilidad.' },
  { icon: Store, title: 'Multi-almacén', text: 'Administra tus ubicaciones desde un mismo espacio y mueve inventario cuando lo necesites.' },
  { icon: Users, title: 'Equipo y permisos', text: 'Gestiona empleados y accesos desde la cuenta administradora de tu empresa.' },
  { icon: BarChart3, title: 'Reportes', text: 'Convierte tus ventas y operación en información clara para tomar decisiones.' },
  { icon: Cloud, title: 'Offline-first', text: 'Continúa vendiendo cuando la conexión falle y sincroniza tus operaciones después.' },
];

const steps = [
  ['01', 'Crea tu cuenta', 'Registra tu correo y crea tu acceso administrador.'],
  ['02', 'Configura tu empresa', 'Elige tu plan, nombre comercial y datos básicos.'],
  ['03', 'Agrega tu operación', 'Crea tu primer almacén y tu primer empleado.'],
  ['04', 'Empieza a operar', 'Carga productos, abre caja y comienza a vender.'],
];

function CamelLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-[#24151f] text-white shadow-lg shadow-rose-200 ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}>
        <svg viewBox="0 0 64 64" className={compact ? 'h-6 w-6' : 'h-7 w-7'} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Camello PALMYRA">
          <path d="M9 45h8l2-15c1-8 6-12 12-12 4 0 7 2 9 5 2-7 6-10 11-10 6 0 9 5 8 11l-2 21h-7l1-14c.5-5-1-8-4-8-3 0-5 3-5 8l-1 14H31l1-14c.3-5-1.5-8-5-8-3 0-5 2-5 7l-2 15H9Z" fill="currentColor"/>
          <path d="M43 18c4 0 7 2 9 5l4-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="52" cy="17" r="1.4" fill="#f9a8d4"/>
          <path d="M14 49h7M35 49h7M49 49h7" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <div className="text-lg font-black tracking-[-.03em] text-[#24151f]">PALMYRA <span className="text-[#d94682]">POS</span></div>
        <div className="text-[9px] font-extrabold uppercase tracking-[.24em] text-[#b66a89]">Business platform</div>
      </div>
    </div>
  );
}

function ProductWindow({ type }: { type: 'dashboard' | 'pos' | 'inventory' }) {
  if (type === 'pos') {
    return (
      <div className="overflow-hidden rounded-[1.7rem] border border-white/80 bg-white shadow-[0_25px_70px_rgba(124,45,78,.18)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2"><div className="h-7 w-7 rounded-lg bg-rose-100"/><div><div className="text-[9px] font-black text-slate-400">PALMYRA POS</div><div className="text-xs font-black">Nueva venta</div></div></div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-600">Caja abierta</span>
        </div>
        <div className="grid grid-cols-[1.35fr_.65fr] gap-3 bg-[#fbf8fa] p-4">
          <div className="grid grid-cols-2 gap-2">
            {['Café premium','Pan artesanal','Agua mineral','Detergente'].map((name, i) => (
              <div key={name} className="rounded-xl border border-slate-100 bg-white p-2.5">
                <div className="h-16 rounded-lg bg-gradient-to-br from-rose-50 via-pink-50 to-[#f5d7e4]"/>
                <div className="mt-2 text-[10px] font-black text-slate-700">{name}</div>
                <div className="mt-1 text-[10px] font-black text-[#d94682]">{[8,4,2,7][i].toFixed(2)} USD</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-[#24151f] p-4 text-white">
            <div className="text-[8px] font-bold uppercase tracking-[.18em] text-white/45">Resumen</div>
            <div className="mt-5 space-y-2 text-[10px] text-white/65"><div className="flex justify-between"><span>4 productos</span><span>$21.00</span></div><div className="flex justify-between"><span>Impuestos</span><span>$1.68</span></div></div>
            <div className="mt-7 border-t border-white/10 pt-4"><div className="text-[8px] uppercase text-white/45">Total</div><div className="text-2xl font-black">$22.68</div></div>
            <div className="mt-4 rounded-xl bg-[#d94682] py-2.5 text-center text-[10px] font-black">Cobrar ahora</div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'inventory') {
    return (
      <div className="overflow-hidden rounded-[1.7rem] border border-white/80 bg-white shadow-[0_25px_70px_rgba(124,45,78,.15)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Inventario</div><div className="text-xs font-black">Almacén principal</div></div><span className="rounded-xl bg-[#fff0f5] px-3 py-2 text-[9px] font-black text-[#d94682]">+ Producto</span></div>
        <div className="space-y-2 bg-[#fbf8fa] p-4">
          {[['Café premium 500g','CAF-500','124','Normal'],['Pan artesanal','PAN-001','18','Bajo'],['Agua mineral 1.5L','AGU-15','260','Normal'],['Detergente líquido','DET-750','9','Crítico']].map(([name, sku, qty, status]) => (
            <div key={sku} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl bg-white px-3 py-3 shadow-sm">
              <div><div className="text-[10px] font-black text-slate-800">{name}</div><div className="text-[8px] text-slate-400">{sku}</div></div>
              <div className="text-xs font-black">{qty}</div>
              <span className={status === 'Normal' ? 'rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-600' : status === 'Bajo' ? 'rounded-full bg-amber-50 px-2 py-1 text-[8px] font-bold text-amber-600' : 'rounded-full bg-rose-50 px-2 py-1 text-[8px] font-bold text-rose-600'}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-white/80 bg-white p-4 shadow-[0_30px_80px_rgba(124,45,78,.18)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#24151f] p-5 text-white"><div className="text-[8px] uppercase tracking-[.18em] text-white/45">Ventas del mes</div><div className="mt-2 text-3xl font-black">$18,430</div><div className="mt-2 text-[9px] font-bold text-pink-300">+12.8% vs. mes anterior</div></div>
        <div className="rounded-2xl bg-[#fff0f5] p-5"><div className="text-[8px] uppercase tracking-[.18em] text-[#b66a89]">Productos</div><div className="mt-2 text-3xl font-black text-slate-900">128</div><div className="mt-2 text-[9px] font-bold text-[#d94682]">32 con movimiento hoy</div></div>
      </div>
      <div className="mt-3 rounded-2xl bg-[#fbf8fa] p-5"><div className="text-[8px] font-extrabold uppercase tracking-[.18em] text-slate-400">Rendimiento semanal</div><div className="mt-5 flex h-28 items-end gap-2">{[38,60,46,72,54,84,96].map((v,i)=><div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-[#d94682] to-[#f7b7d0]" style={{height: v + '%'}}/>)}</div></div>
    </div>
  );
}

export default function Landing() {
  const [mobileMenu, setMobileMenu] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  React.useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById('root');
    root.classList.add('palmyra-landing-active');
    body.classList.add('palmyra-landing-active');
    appRoot?.classList.add('palmyra-landing-active');
    return () => {
      root.classList.remove('palmyra-landing-active');
      body.classList.remove('palmyra-landing-active');
      appRoot?.classList.remove('palmyra-landing-active');
    };
  }, []);

  return (
    <div className="palmyra-landing-shell min-h-screen overflow-x-hidden bg-[#fff9fc] text-[#24151f]">
      <header className="sticky top-0 z-50 border-b border-[#f2dce6] bg-[#fff9fc]/95 shadow-[0_8px_30px_rgba(36,21,31,.05)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/" aria-label="PALMYRA POS"><CamelLogo/></Link>
          <nav className="hidden items-center gap-7 text-sm font-extrabold text-slate-600 lg:flex">
            <a href="#funciones" className="hover:text-[#d94682]">Funciones</a>
            <a href="#producto" className="hover:text-[#d94682]">Producto</a>
            <a href="#como-funciona" className="hover:text-[#d94682]">Cómo funciona</a>
            <a href="#precios" className="hover:text-[#d94682]">Precios</a>
            <a href="#faq" className="hover:text-[#d94682]">FAQ</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-[#fff0f5]">Iniciar sesión</Link>
            <Link to="/signup" className="rounded-xl bg-[#24151f] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[#24151f]/15 hover:bg-[#3a202f]">Crear cuenta <ArrowRight className="ml-1 inline h-4 w-4"/></Link>
          </div>
          <button className="rounded-xl p-2 hover:bg-[#fff0f5] md:hidden" onClick={() => setMobileMenu(v => !v)} aria-label="Abrir menú">{mobileMenu ? <X/> : <Menu/>}</button>
        </div>
        {mobileMenu && <div className="border-t border-[#f2dce6] bg-[#fff9fc] px-5 py-4 md:hidden"><div className="grid gap-2 text-sm font-bold"><a href="#funciones" onClick={() => setMobileMenu(false)}>Funciones</a><a href="#producto" onClick={() => setMobileMenu(false)}>Producto</a><a href="#precios" onClick={() => setMobileMenu(false)}>Precios</a><Link to="/login">Iniciar sesión</Link><Link to="/signup" className="mt-2 rounded-xl bg-[#d94682] px-4 py-3 text-center font-black text-white">Crear cuenta</Link></div></div>}
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(244,114,182,.18),transparent_34%),radial-gradient(circle_at_10%_50%,rgba(251,207,232,.35),transparent_30%)]"/>
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:pb-32 lg:pt-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#f0cddd] bg-white px-3.5 py-2 text-[11px] font-black text-[#c33d74] shadow-sm"><Sparkles className="h-3.5 w-3.5"/> Plataforma SaaS para negocios en crecimiento</div>
              <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[.98] tracking-[-.055em] sm:text-6xl lg:text-[5.2rem]">Controla tu negocio.<br/><span className="bg-gradient-to-r from-[#c33d74] via-[#e65b92] to-[#ef9fc0] bg-clip-text text-transparent">Crece con PALMYRA.</span></h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">Ventas, inventario, almacenes, clientes, equipo y reportes en una sola plataforma. PALMYRA POS convierte la operación diaria en una experiencia clara, rápida y profesional.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d94682] px-6 py-4 text-sm font-black text-white shadow-xl shadow-[#d94682]/25 hover:bg-[#c63b72]">Crear mi cuenta <ArrowRight className="h-4 w-4"/></Link>
                <a href="#producto" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ead4df] bg-white px-6 py-4 text-sm font-black text-slate-700 hover:border-[#d94682]">Ver el producto <ChevronRight className="h-4 w-4"/></a>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-bold text-slate-500"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#d94682]"/> Multi-almacén</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#d94682]"/> Modo offline</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#d94682]"/> Datos por empresa</span></div>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-[#f8c7dc] via-[#fbe9f1] to-transparent blur-2xl"/>
              <div className="relative rotate-[1deg]"><ProductWindow type="dashboard"/></div>
              <div className="absolute -bottom-8 -left-8 hidden w-[42%] sm:block"><ProductWindow type="inventory"/></div>
              <div className="absolute -right-7 -top-8 hidden w-[40%] sm:block"><div className="rounded-2xl border border-white bg-white p-3 shadow-xl"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fff0f5] text-[#d94682]"><Gauge className="h-4 w-4"/></div><div><div className="text-[8px] font-black text-slate-400">ESTADO</div><div className="text-[10px] font-black">Todo bajo control</div></div></div></div></div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#f1dfe7] bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-[#f1dfe7] px-5 py-7 sm:grid-cols-4 lg:px-8">
            {[['$10','desde / mes'],['50','SKUs en Starter'],['7','almacenes en Pro'],['24/7','operación online']].map(([value,label]) => <div key={label} className="px-4 text-center"><div className="text-2xl font-black tracking-tight text-[#24151f]">{value}</div><div className="mt-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#b66a89]">{label}</div></div>)}
          </div>
        </section>

        <section id="funciones" className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <div className="mx-auto max-w-2xl text-center"><div className="text-[11px] font-black uppercase tracking-[.2em] text-[#d94682]">Todo conectado</div><h2 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">Una plataforma para toda tu operación.</h2><p className="mt-5 text-lg leading-8 text-slate-600">Menos sistemas separados. Menos información perdida. Más control sobre lo que sucede en tu empresa.</p></div>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{featureCards.map(({icon: Icon, title, text}, i) => <div key={title} className="group rounded-[1.7rem] border border-[#f0e2e8] bg-[#fffafd] p-7 transition hover:-translate-y-1 hover:border-[#edb4ca] hover:shadow-xl hover:shadow-[#d94682]/10"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f5] text-[#d94682] group-hover:bg-[#d94682] group-hover:text-white"><Icon className="h-5 w-5"/></div><div className="mt-7 text-[10px] font-black text-[#d9a0b7]">0{i + 1}</div><h3 className="mt-1 text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div>
          </div>
        </section>

        <section id="producto" className="bg-[#fbf4f8]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <div className="grid gap-14 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
              <div><div className="text-[11px] font-black uppercase tracking-[.2em] text-[#d94682]">Producto</div><h2 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">Hecho para verse bien y trabajar mejor.</h2><p className="mt-5 text-lg leading-8 text-slate-600">Una interfaz limpia para que administradores y empleados puedan aprender el sistema rápidamente, desde computadora o tablet.</p><div className="mt-8 space-y-5">{[['Caja profesional','Vende, cobra y consulta el estado de tu caja desde el mismo flujo.',ShoppingCart],['Inventario claro','Consulta existencias, mínimos y movimientos por almacén.',Boxes],['Reportes útiles','Mira ventas, productos y rendimiento sin navegar entre herramientas.',BarChart3],['Operación continua','PALMYRA conserva una experiencia offline-first para momentos sin conexión.',Cloud]].map(([title,text,Icon]) => <div key={title as string} className="flex gap-4"><div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#d94682] shadow-sm"><Icon className="h-4 w-4"/></div><div><div className="font-black">{title as string}</div><div className="mt-1 text-sm leading-6 text-slate-600">{text as string}</div></div></div>)}</div></div>
              <div className="grid gap-5"><ProductWindow type="pos"/><div className="grid gap-5 sm:grid-cols-2"><ProductWindow type="inventory"/><div className="rounded-[1.7rem] bg-[#24151f] p-6 text-white shadow-xl"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d94682]"><ReceiptText className="h-5 w-5"/></div><div className="mt-7 text-2xl font-black">Todo queda conectado.</div><p className="mt-3 text-sm leading-6 text-white/60">Ventas, stock, empleados, almacenes y reportes trabajan sobre la misma operación empresarial.</p><div className="mt-7 space-y-3 text-[10px] font-bold text-white/75"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-pink-300"/> Información centralizada</div><div className="flex items-center gap-2"><Check className="h-4 w-4 text-pink-300"/> Espacio por empresa</div><div className="flex items-center gap-2"><Check className="h-4 w-4 text-pink-300"/> Escalable por plan</div></div></div></div></div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8"><div className="max-w-2xl"><div className="text-[11px] font-black uppercase tracking-[.2em] text-[#d94682]">Onboarding</div><h2 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">De cuenta nueva a negocio operativo.</h2><p className="mt-5 text-lg leading-8 text-slate-600">El registro está pensado para una empresa, no solo para crear un usuario aislado.</p></div><div className="mt-14 grid gap-4 md:grid-cols-4">{steps.map(([number,title,text]) => <div key={number} className="relative rounded-[1.7rem] border border-[#f0e2e8] bg-[#fffafd] p-6"><div className="text-4xl font-black text-[#f1bfd2]">{number}</div><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div></div>
        </section>

        <section id="precios" className="bg-[#24151f] text-white">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <div className="mx-auto max-w-3xl text-center"><div className="text-[11px] font-black uppercase tracking-[.2em] text-pink-300">Planes transparentes</div><h2 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">Elige el tamaño de tu operación.</h2><p className="mt-5 text-lg leading-8 text-white/60">El límite de productos cuenta tipos de producto/SKUs de la empresa, no unidades físicas en inventario.</p></div>
            <div className="mt-14 grid gap-5 lg:grid-cols-3">{PALMYRA_PLANS.map(plan => <div key={plan.code} className={plan.code === 'growth' ? 'relative rounded-[2rem] border-2 border-[#e56b99] bg-white p-7 text-[#24151f] shadow-[0_25px_70px_rgba(217,70,130,.2)]' : 'rounded-[2rem] border border-white/10 bg-white/[.06] p-7'}>{plan.code === 'growth' && <div className="absolute -top-3 left-6 rounded-full bg-[#d94682] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white">Más elegido</div>}<div className="flex items-center justify-between"><div className="text-xl font-black">{plan.name}</div><span className="rounded-xl bg-[#fff0f5] px-2.5 py-1 text-[9px] font-black text-[#d94682]">{plan.warehouses} almacén{plan.warehouses > 1 ? 'es' : ''}</span></div><div className="mt-6 flex items-end gap-1"><span className="text-5xl font-black">{'$' + plan.price}</span><span className="pb-2 text-sm opacity-60">/mes</span></div><p className="mt-3 min-h-[48px] text-sm leading-6 opacity-70">{plan.description}</p><div className="mt-7 space-y-3">{plan.features.map(f => <div key={f} className="flex gap-2 text-sm"><Check className={plan.code === 'growth' ? 'h-4 w-4 shrink-0 text-[#d94682]' : 'h-4 w-4 shrink-0 text-pink-300'}/><span>{f}</span></div>)}</div><Link to={'/signup?plan=' + plan.code} className={plan.code === 'growth' ? 'mt-8 flex items-center justify-center gap-2 rounded-2xl bg-[#d94682] px-4 py-3.5 text-sm font-black text-white' : 'mt-8 flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-black text-[#24151f]'}>Elegir {plan.name}<ArrowRight className="h-4 w-4"/></Link></div>)}</div>
          </div>
        </section>

        <section className="bg-[#fbf4f8]">
          <div className="mx-auto max-w-5xl px-5 py-24 lg:px-8"><div className="grid gap-5 sm:grid-cols-3"><div className="rounded-[1.7rem] bg-white p-7"><ShieldCheck className="h-6 w-6 text-[#d94682]"/><h3 className="mt-5 font-black">Espacio empresarial</h3><p className="mt-2 text-sm leading-6 text-slate-600">Tu operación se organiza alrededor de tu empresa y sus almacenes.</p></div><div className="rounded-[1.7rem] bg-white p-7"><WalletCards className="h-6 w-6 text-[#d94682]"/><h3 className="mt-5 font-black">Precios simples</h3><p className="mt-2 text-sm leading-6 text-slate-600">Tres planes claros para crecer sin una estructura de precios complicada.</p></div><div className="rounded-[1.7rem] bg-white p-7"><Zap className="h-6 w-6 text-[#d94682]"/><h3 className="mt-5 font-black">Operación rápida</h3><p className="mt-2 text-sm leading-6 text-slate-600">La experiencia está diseñada para minimizar pasos durante el trabajo.</p></div></div></div>
        </section>

        <section id="faq" className="bg-white">
          <div className="mx-auto max-w-4xl px-5 py-24 lg:px-8"><div className="text-center"><div className="text-[11px] font-black uppercase tracking-[.2em] text-[#d94682]">Preguntas frecuentes</div><h2 className="mt-3 text-4xl font-black tracking-[-.04em]">Todo claro antes de empezar.</h2></div><div className="mt-10 space-y-3">{[['¿El límite de productos cuenta las unidades físicas?','No. Cuenta los tipos de producto/SKUs registrados por la empresa, independientemente de cuántas unidades haya en cada almacén.'],['¿Puedo manejar varios almacenes?','Sí. El máximo depende del plan contratado y toda la operación permanece dentro de la empresa.'],['¿Puedo vender sin internet?','PALMYRA está diseñado con una estrategia offline-first para conservar la operación y sincronizar cuando la conexión vuelve.'],['¿Puedo cambiar de plan?','La plataforma contempla planes con límites diferentes. El cambio debe respetar los límites del nuevo plan.'],['¿El administrador cuenta como empleado?','No. Los límites de empleados de los planes se aplican a los empleados; el administrador de la empresa se gestiona por separado.']].map(([q,a],i) => <button key={q} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full rounded-2xl border border-[#f0e2e8] bg-[#fffafd] p-5 text-left hover:border-[#eab4c9]"><div className="flex items-center justify-between gap-5"><span className="font-black">{q}</span><ChevronDown className={openFaq === i ? 'h-5 w-5 rotate-180 text-[#d94682]' : 'h-5 w-5 text-slate-400'}/></div>{openFaq === i && <p className="mt-3 max-w-3xl pr-8 text-sm leading-6 text-slate-600">{a}</p>}</button>)}</div></div>
        </section>

        <section className="bg-gradient-to-br from-[#d94682] to-[#b73568]">
          <div className="mx-auto max-w-5xl px-5 py-20 text-center lg:px-8"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white"><CamelLogo compact/></div><h2 className="mt-7 text-4xl font-black tracking-[-.04em] text-white sm:text-5xl">Tu negocio merece una operación más simple.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/80">Crea tu cuenta, configura tu empresa y empieza a trabajar con PALMYRA POS.</p><Link to="/signup" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-[#b73568] shadow-xl">Crear mi cuenta <ArrowRight className="h-4 w-4"/></Link></div>
        </section>
      </main>

      <footer className="bg-[#24151f] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div><CamelLogo/><p className="mt-4 max-w-sm text-sm leading-6 text-white/45">PALMYRA POS es una plataforma SaaS para administrar ventas, inventario, almacenes y equipos desde un solo lugar.</p></div>
          <div><div className="text-[10px] font-black uppercase tracking-widest text-pink-300">Producto</div><div className="mt-4 grid gap-2 text-sm text-white/60"><a href="#funciones">Funciones</a><a href="#producto">Producto</a><a href="#precios">Precios</a><a href="#faq">Preguntas frecuentes</a></div></div>
          <div><div className="text-[10px] font-black uppercase tracking-widest text-pink-300">Cuenta</div><div className="mt-4 grid gap-2 text-sm text-white/60"><Link to="/login">Iniciar sesión</Link><Link to="/signup">Crear cuenta</Link></div></div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-[10px] text-white/35">© {new Date().getFullYear()} PALMYRA POS · Business platform</div>
      </footer>
    </div>
  );
}
