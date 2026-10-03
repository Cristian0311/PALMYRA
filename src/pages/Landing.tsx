import React from 'react';
import {
  ArrowRight, BarChart3, Boxes, Check, ChevronDown, ChevronRight, Cloud,
  CreditCard, Gauge, Menu, Package, ReceiptText, ShieldCheck, ShoppingCart,
  Sparkles, Store, Users, WalletCards, X, Zap, Building2, Warehouse,
  UserRound, Settings2, CircleCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PALMYRA_PLANS } from '../config/saas';

const featureCards = [
  { icon: ShoppingCart, title: 'Punto de venta', eyebrow: 'Ventas', text: 'Cobros rápidos, caja, carrito y operaciones diarias en un flujo pensado para trabajar sin fricción.' },
  { icon: Package, title: 'Inventario', eyebrow: 'Stock', text: 'Productos, existencias, mínimos y movimientos visibles desde una sola operación.' },
  { icon: Store, title: 'Multi-almacén', eyebrow: 'Operación', text: 'Controla ubicaciones y transferencias manteniendo la información de tu empresa conectada.' },
  { icon: Users, title: 'Equipo y permisos', eyebrow: 'Personas', text: 'Administra empleados, accesos y responsabilidades desde el espacio empresarial.' },
  { icon: BarChart3, title: 'Reportes', eyebrow: 'Decisiones', text: 'Convierte ventas y operación en información clara para revisar el rendimiento.' },
  { icon: Cloud, title: 'Offline-first', eyebrow: 'Continuidad', text: 'Mantén la operación preparada para momentos sin conexión y sincroniza después.' },
];

const stepCards = [
  { icon: UserRound, number: '01', title: 'Crea tu cuenta', text: 'Registra el administrador y valida el acceso de tu empresa.' },
  { icon: Building2, number: '02', title: 'Crea tu empresa', text: 'Define nombre, plan y configuración base del espacio empresarial.' },
  { icon: Warehouse, number: '03', title: 'Configura tu operación', text: 'Crea el primer almacén y deja preparado tu equipo inicial.' },
  { icon: Zap, number: '04', title: 'Empieza a vender', text: 'Carga productos, abre caja y comienza a operar.' },
];

const planIcons = [WalletCards, Store, Gauge];

function CamelMark({ className = 'h-9 w-12' }: { className?: string }) {
  return <img src="/palmyra-camel.svg" alt="" aria-hidden="true" className={className} />;
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={dark ? 'flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#241622]' : 'flex h-11 w-11 items-center justify-center rounded-2xl bg-[#241622] text-white'}>
        <CamelMark className="h-7 w-9" />
      </div>
      <div>
        <div className={`text-lg font-black tracking-[-.04em] ${dark ? 'text-white' : 'text-[#241622]'}`}>PALMYRA <span className="text-[#C65B87]">POS</span></div>
        <div className={`text-[9px] font-extrabold uppercase tracking-[.22em] ${dark ? 'text-pink-200/60' : 'text-[#9B7E96]'}`}>Commerce OS</div>
      </div>
    </div>
  );
}

function ProductWindow({ type }: { type: 'dashboard' | 'pos' | 'inventory' }) {
  if (type === 'pos') {
    return (
      <div className="overflow-hidden rounded-[1.8rem] border border-white/80 bg-white shadow-[0_24px_70px_rgba(109,36,72,.16)]">
        <div className="flex items-center justify-between border-b border-[#f3e5eb] px-4 py-3">
          <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5E6EE] text-[#C65B87]"><ShoppingCart className="h-4 w-4"/></div><div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">PALMYRA</div><div className="text-xs font-black">Nueva venta</div></div></div>
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-600">Caja abierta</span>
        </div>
        <div className="grid grid-cols-1 gap-3 bg-[#FBF7FA] p-4 sm:grid-cols-[1.35fr_.65fr]">
          <div className="grid grid-cols-2 gap-2">
            {['Café premium','Pan artesanal','Agua mineral','Detergente'].map((name, i) => (
              <div key={name} className="rounded-xl border border-[#f1e5ea] bg-white p-2.5">
                <div className="h-14 rounded-lg bg-gradient-to-br from-[#F5E6EE] via-[#fce6ef] to-[#f3cadb]"/>
                <div className="mt-2 text-[10px] font-black text-slate-700">{name}</div>
                <div className="mt-1 text-[10px] font-black text-[#C65B87]">{[8,4,2,7][i].toFixed(2)} USD</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-[#241622] p-4 text-white">
            <div className="text-[8px] font-bold uppercase tracking-[.18em] text-white/45">Resumen</div>
            <div className="mt-5 space-y-2 text-[10px] text-white/65"><div className="flex justify-between"><span>4 productos</span><span>$21.00</span></div><div className="flex justify-between"><span>Impuestos</span><span>$1.68</span></div></div>
            <div className="mt-7 border-t border-white/10 pt-4"><div className="text-[8px] uppercase text-white/45">Total</div><div className="text-2xl font-black">$22.68</div></div>
            <div className="mt-4 rounded-xl bg-[#C65B87] py-2.5 text-center text-[10px] font-black">Cobrar ahora</div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'inventory') {
    return (
      <div className="overflow-hidden rounded-[1.8rem] border border-white/80 bg-white shadow-[0_24px_70px_rgba(109,36,72,.14)]">
        <div className="flex items-center justify-between border-b border-[#f3e5eb] px-4 py-3"><div><div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Inventario</div><div className="text-xs font-black">Almacén principal</div></div><span className="rounded-xl bg-[#F5E6EE] px-3 py-2 text-[9px] font-black text-[#C65B87]">+ Producto</span></div>
        <div className="space-y-2 bg-[#FBF7FA] p-4">
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
    <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white p-4 shadow-[0_30px_85px_rgba(109,36,72,.18)]">
      <div className="mb-3 flex items-center justify-between"><div><div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dashboard</div><div className="text-xs font-black">Resumen de tu empresa</div></div><div className="rounded-xl bg-[#F5E6EE] px-3 py-2 text-[9px] font-black text-[#C65B87]">Hoy</div></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#241622] p-4 text-white"><div className="text-[8px] uppercase tracking-[.18em] text-white/45">Ventas</div><div className="mt-2 text-2xl font-black">$18,430</div><div className="mt-1 text-[9px] font-bold text-pink-300">+12.8%</div></div>
        <div className="rounded-2xl bg-[#F5E6EE] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-[#9B7E96]">Productos</div><div className="mt-2 text-2xl font-black">128</div><div className="mt-1 text-[9px] font-bold text-[#C65B87]">32 activos hoy</div></div>
        <div className="rounded-2xl bg-[#EEE7F2] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-[#9B7E96]">Operación</div><div className="mt-2 text-2xl font-black">98%</div><div className="mt-1 text-[9px] font-bold text-emerald-600">estable</div></div>
      </div>
      <div className="mt-3 rounded-2xl bg-[#FBF7FA] p-5"><div className="text-[8px] font-extrabold uppercase tracking-[.18em] text-slate-400">Rendimiento semanal</div><div className="mt-5 flex h-28 items-end gap-2">{[38,60,46,72,54,84,96].map((v,i)=><div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-[#C65B87] to-[#f5b4ca]" style={{height: v + '%'}}/>)}</div></div>
    </div>
  );
}

export default function Landing() {
  const [mobileMenu, setMobileMenu] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  React.useEffect(() => {
    const root = document.documentElement, body = document.body, appRoot = document.getElementById('root');
    root.classList.add('palmyra-landing-active'); body.classList.add('palmyra-landing-active'); appRoot?.classList.add('palmyra-landing-active');
    return () => { root.classList.remove('palmyra-landing-active'); body.classList.remove('palmyra-landing-active'); appRoot?.classList.remove('palmyra-landing-active'); };
  }, []);

  return (
    <div className="palmyra-landing-page min-h-screen overflow-x-hidden bg-[#FAF6F2] text-[#241622]">
      <header className="sticky top-0 z-50 border-b border-[#E9DCE7] bg-[#FAF6F2]/95 shadow-[0_8px_28px_rgba(53,27,42,.05)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8">
          <Link to="/landing" aria-label="PALMYRA"><Brand /></Link>
          <nav className="hidden items-center gap-7 text-sm font-extrabold text-slate-600 lg:flex">
            <a href="#funciones" className="transition hover:text-[#C65B87]">Funciones</a>
            <a href="#producto" className="transition hover:text-[#C65B87]">Producto</a>
            <a href="#como-funciona" className="transition hover:text-[#C65B87]">Cómo funciona</a>
            <a href="#precios" className="transition hover:text-[#C65B87]">Planes</a>
            <a href="#faq" className="transition hover:text-[#C65B87]">FAQ</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-[#F5E6EE]">Iniciar sesión</Link>
            <Link to="/signup" className="rounded-xl bg-[#241622] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[#241622]/15 hover:bg-[#4b2438]">Crear cuenta <ArrowRight className="ml-1 inline h-4 w-4"/></Link>
          </div>
          <button className="rounded-xl p-2 hover:bg-[#F5E6EE] md:hidden" onClick={() => setMobileMenu(v => !v)} aria-label={mobileMenu ? 'Cerrar menú' : 'Abrir menú'}>{mobileMenu ? <X/> : <Menu/>}</button>
        </div>
        {mobileMenu && <div className="border-t border-[#E9DCE7] bg-[#FAF6F2] px-5 py-4 md:hidden"><div className="grid gap-1 text-sm font-bold"><a className="rounded-xl px-3 py-2.5 hover:bg-white" href="#funciones" onClick={() => setMobileMenu(false)}>Funciones</a><a className="rounded-xl px-3 py-2.5 hover:bg-white" href="#producto" onClick={() => setMobileMenu(false)}>Producto</a><a className="rounded-xl px-3 py-2.5 hover:bg-white" href="#precios" onClick={() => setMobileMenu(false)}>Planes</a><a className="rounded-xl px-3 py-2.5 hover:bg-white" href="#faq" onClick={() => setMobileMenu(false)}>FAQ</a><Link to="/login" className="rounded-xl px-3 py-2.5">Iniciar sesión</Link><Link to="/signup" className="mt-2 rounded-xl bg-[#C65B87] px-4 py-3 text-center font-black text-white">Crear cuenta</Link></div></div>}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[#f4e5eb]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(228,112,153,.20),transparent_34%),radial-gradient(circle_at_8%_65%,rgba(251,215,229,.45),transparent_30%)]"/>
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 sm:pt-18 lg:grid-cols-[.88fr_1.12fr] lg:px-8 lg:pb-28 lg:pt-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#edc9d7] bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-[.12em] text-[#c94d78] shadow-sm"><Sparkles className="h-3.5 w-3.5"/> Gestión empresarial, simplificada</div>
              <h1 className="mt-7 max-w-3xl text-[3.25rem] font-black leading-[.96] tracking-[-.06em] sm:text-6xl lg:text-[5.35rem]">Una operación más clara.<br/><span className="bg-gradient-to-r from-[#b83f6c] via-[#C65B87] to-[#ed9ebc] bg-clip-text text-transparent">Un negocio más fuerte.</span></h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">PALMYRA reúne ventas, inventario, almacenes, clientes, equipo y reportes en un espacio empresarial diseñado para crecer contigo.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#C65B87] px-6 py-4 text-sm font-black text-white shadow-xl shadow-[#C65B87]/25 hover:bg-[#c44775]">Crear mi cuenta <ArrowRight className="h-4 w-4"/></Link><a href="#producto" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e8d4de] bg-white px-6 py-4 text-sm font-black text-slate-700 hover:border-[#C65B87]">Explorar PALMYRA <ChevronRight className="h-4 w-4"/></a></div>
              <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-5 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500"><span className="inline-flex items-center gap-2"><CircleCheck className="h-4 w-4 text-[#C65B87]"/> Multi-almacén</span><span className="inline-flex items-center gap-2"><CircleCheck className="h-4 w-4 text-[#C65B87]"/> Offline-first</span><span className="inline-flex items-center gap-2"><CircleCheck className="h-4 w-4 text-[#C65B87]"/> Por empresa</span></div>
            </div>
            <div className="relative mx-auto w-full max-w-2xl">
              <div className="absolute -inset-8 rounded-[3.5rem] bg-gradient-to-br from-[#f6c8d9] via-[#fbe8ef] to-transparent blur-2xl"/>
              <div className="relative rotate-[.7deg]"><ProductWindow type="dashboard"/></div>
              <div className="absolute -bottom-9 -left-8 hidden w-[44%] md:block"><ProductWindow type="inventory"/></div>
              <div className="absolute -right-5 -top-7 hidden rounded-2xl border border-white bg-white p-3 shadow-xl sm:block"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5E6EE] text-[#C65B87]"><Gauge className="h-4 w-4"/></div><div><div className="text-[8px] font-black uppercase tracking-widest text-slate-400">Estado</div><div className="text-[10px] font-black">Operación bajo control</div></div></div></div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#f0dfe7] bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-2 sm:grid-cols-4 lg:px-8">
            {[['$10','plan inicial / mes'],['50','SKUs en Starter'],['7','almacenes en Pro'],['24/7','acceso a la plataforma']].map(([value,label]) => <div key={label} className="border-r border-[#f0dfe7] px-4 py-6 text-center last:border-r-0"><div className="text-2xl font-black tracking-tight">{value}</div><div className="mt-1 text-[9px] font-extrabold uppercase tracking-[.1em] text-[#9B7E96]">{label}</div></div>)}
          </div>
        </section>
        <section id="palmyra" className="relative overflow-hidden bg-[#241622] text-white">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#C65B87]/20 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#A99ABF]/15 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:py-24">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-3 shadow-[0_30px_90px_rgba(0,0,0,.28)]">
              <div className="relative overflow-hidden rounded-[1.6rem]">
                <img src="https://upload.wikimedia.org/wikipedia/commons/e/e4/Palmyra%2C_Syria%2C_The_Great_Colonnade.jpg" alt="Gran Columnata de la antigua Palmira, Siria" loading="lazy" className="h-[350px] w-full object-cover sm:h-[450px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#241622]/75 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5"><div className="text-[9px] font-black uppercase tracking-[.22em] text-[#E7B1C7]">PALMYRA · SYRIA</div><div className="mt-1 text-2xl font-black">Gran Columnata</div></div>
              </div>
              <div className="flex items-center justify-between px-2 pb-1 pt-4 text-[10px]"><span className="text-white/45">Fotografía de Vyacheslav Argenberg</span><a href="https://commons.wikimedia.org/wiki/File:Palmyra,_Syria,_The_Great_Colonnade.jpg" target="_blank" rel="noreferrer" className="font-bold text-[#E7B1C7]">Ver licencia ↗</a></div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.22em] text-[#E7B1C7]">El significado de la marca</div>
              <h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">PALMYRA no es un nombre al azar.</h2>
              <p className="mt-5 text-base leading-7 text-white/65 sm:text-lg">La antigua Palmira fue un oasis del desierto sirio y un punto estratégico de intercambio. UNESCO la describe como un cruce de civilizaciones y una ciudad conectada con las rutas que unían Persia, India y China con el mundo romano. El Metropolitan Museum of Art también destaca su papel en las rutas comerciales y su mezcla cultural.</p>
              <div className="mt-8 grid gap-3">
                <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.045] p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C65B87]/15 text-[#E7B1C7]"><Network className="h-4 w-4"/></div><div><div className="font-black">Conectar</div><div className="mt-1 text-sm leading-6 text-white/50">Rutas, personas y comercio en un mismo punto.</div></div></div>
                <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.045] p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#A99ABF]/15 text-[#CDBFE0]"><Landmark className="h-4 w-4"/></div><div><div className="font-black">Sostener</div><div className="mt-1 text-sm leading-6 text-white/50">Un oasis que permitía que las rutas atravesaran el desierto.</div></div></div>
                <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.045] p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D8B7CA]/15 text-[#E6CBD8]"><Layers3 className="h-4 w-4"/></div><div><div className="font-black">Integrar</div><div className="mt-1 text-sm leading-6 text-white/50">Una identidad formada por distintas culturas e influencias.</div></div></div>
              </div>
              <p className="mt-7 text-[10px] leading-5 text-white/30">Fuente histórica: UNESCO World Heritage Centre y The Metropolitan Museum of Art. La fotografía indicada se publica bajo CC BY 4.0.</p>
            </div>
          </div>
        </section>
        <section id="funciones" className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="max-w-2xl"><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#C65B87]">Una sola plataforma</div><h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">Todo lo importante, conectado.</h2><p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">Cada módulo comparte el mismo contexto empresarial para que tu equipo trabaje con menos pasos y más claridad.</p></div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{featureCards.map(({icon: Icon, title, eyebrow, text}, i) => <article key={title} className="group rounded-[1.6rem] border border-[#f0e2e8] bg-[#fffafd] p-6 transition duration-200 hover:-translate-y-1 hover:border-[#e5a9c0] hover:shadow-xl hover:shadow-[#C65B87]/10"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5E6EE] text-[#C65B87] transition group-hover:bg-[#C65B87] group-hover:text-white"><Icon className="h-5 w-5"/></div><span className="text-[9px] font-black uppercase tracking-[.16em] text-[#d5a0b5]">0{i + 1}</span></div><div className="mt-6 text-[9px] font-black uppercase tracking-[.14em] text-[#9B7E96]">{eyebrow}</div><h3 className="mt-1 text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div>
          </div>
        </section>

        <section id="producto" className="bg-[#f8eff3]">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
              <div><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#C65B87]">Experiencia de producto</div><h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">Diseñado para trabajar, no para complicar.</h2><p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">Una interfaz ordenada, visual y consistente para administradores y empleados en PC, tablet y móvil.</p><div className="mt-8 space-y-4">{[['Caja profesional','Vende y cobra con un flujo corto y visible.',ShoppingCart],['Inventario accionable','Detecta existencias y movimientos sin perder contexto.',Boxes],['Información útil','Consulta indicadores y reportes sin saltar entre sistemas.',BarChart3],['Continuidad','La arquitectura offline-first prepara la operación para cortes de conexión.',Cloud]].map(([title,text,Icon]) => <div key={title as string} className="flex gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#C65B87] shadow-sm"><Icon className="h-4 w-4"/></div><div><div className="font-black">{title as string}</div><div className="mt-1 text-sm leading-6 text-slate-600">{text as string}</div></div></div>)}</div></div>
              <div className="grid gap-5"><ProductWindow type="pos"/><div className="grid gap-5 sm:grid-cols-2"><ProductWindow type="inventory"/><div className="rounded-[1.8rem] bg-[#241622] p-6 text-white shadow-xl"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#C65B87]"><ReceiptText className="h-5 w-5"/></div><h3 className="mt-7 text-2xl font-black">Una fuente de verdad.</h3><p className="mt-3 text-sm leading-6 text-white/60">Ventas, stock, empleados, almacenes y reportes se organizan dentro de la misma empresa.</p><div className="mt-7 space-y-3 text-[10px] font-bold text-white/75"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-pink-300"/> Datos centralizados</div><div className="flex items-center gap-2"><Check className="h-4 w-4 text-pink-300"/> Permisos por rol</div><div className="flex items-center gap-2"><Check className="h-4 w-4 text-pink-300"/> Capacidades por plan</div></div></div></div></div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="max-w-2xl"><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#C65B87]">Registro y puesta en marcha</div><h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">Un flujo definido de principio a fin.</h2><p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">La cuenta se convierte en un espacio empresarial con plan, almacén y equipo inicial, sin pasos ambiguos.</p></div>
            <div className="mt-12 grid gap-4 md:grid-cols-4">{stepCards.map(({icon: Icon, number, title, text}, i) => <div key={number} className="relative rounded-[1.6rem] border border-[#f0e2e8] bg-[#fffafd] p-6"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5E6EE] text-[#C65B87]"><Icon className="h-4 w-4"/></div><span className="text-3xl font-black text-[#efc1d1]">{number}</span></div><h3 className="mt-6 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>{i < stepCards.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-white text-[#C65B87] md:block"/>}</div>)}</div>
          </div>
        </section>

        
        <section id="precios" className="bg-[#FAF6F2]">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="mx-auto max-w-3xl text-center"><div className="text-[10px] font-black uppercase tracking-[.22em] text-[#C65B87]">Arquitectura de precios</div><h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">Planes que se entienden en segundos.</h2><p className="mt-4 text-base leading-7 text-[#6A5D6B] sm:text-lg">Quitamos el exceso visual y convertimos los planes en una comparación empresarial limpia: precio, capacidad y acción.</p></div>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {PALMYRA_PLANS.map((plan, index) => (
                <article key={plan.code} className={index === 1 ? 'relative flex min-h-[520px] flex-col overflow-hidden rounded-[2rem] border border-[#D7B0C5] bg-[#2F1D2C] p-7 text-white shadow-[0_30px_80px_rgba(47,29,44,.20)]' : 'relative flex min-h-[520px] flex-col overflow-hidden rounded-[2rem] border border-[#E5D9E4] bg-white p-7 text-[#241622] shadow-[0_18px_50px_rgba(36,22,34,.06)]'}>
                  {index === 1 && <div className="absolute right-5 top-5 rounded-full bg-[#C65B87] px-3 py-1.5 text-[8px] font-black uppercase tracking-[.14em] text-white">Más capacidad</div>}
                  <div className="flex items-start justify-between gap-4"><div><div className={index === 1 ? 'text-[9px] font-black uppercase tracking-[.18em] text-[#E7B1C7]' : 'text-[9px] font-black uppercase tracking-[.18em] text-[#9A8297]'}>0{index + 1} · Plan</div><h3 className="mt-2 text-2xl font-black">{plan.name}</h3></div><div className={index === 0 ? 'flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5E6EE] text-[#C65B87]' : index === 1 ? 'flex h-11 w-11 items-center justify-center rounded-2xl bg-[#C65B87]/15 text-[#E7B1C7]' : 'flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEE7F2] text-[#725A80]'}>{index === 0 ? <Store className="h-5 w-5"/> : index === 1 ? <Gauge className="h-5 w-5"/> : <Boxes className="h-5 w-5"/>}</div></div>
                  <div className="mt-8 flex items-end gap-1"><span className="text-5xl font-black tracking-[-.05em]">{plan.price}</span><span className={index === 1 ? 'pb-2 text-sm text-white/45' : 'pb-2 text-sm text-[#8B788A]'}>/mes</span></div>
                  <p className={index === 1 ? 'mt-3 min-h-[72px] text-sm leading-6 text-white/55' : 'mt-3 min-h-[72px] text-sm leading-6 text-[#6C5E6C]'}>{plan.description}</p>
                  <div className={index === 1 ? 'my-5 grid grid-cols-3 border-y border-white/10 py-4' : 'my-5 grid grid-cols-3 border-y border-[#EEE6ED] py-4'}>
                    <div><div className={index === 1 ? 'text-[8px] uppercase tracking-widest text-white/35' : 'text-[8px] uppercase tracking-widest text-[#9A8297]'}>Almacenes</div><div className="mt-1 text-xl font-black">{plan.warehouses}</div></div>
                    <div className={index === 1 ? 'border-x border-white/10 px-3' : 'border-x border-[#EEE6ED] px-3'}><div className={index === 1 ? 'text-[8px] uppercase tracking-widest text-white/35' : 'text-[8px] uppercase tracking-widest text-[#9A8297]'}>Equipo</div><div className="mt-1 text-xl font-black">{plan.employees}</div></div>
                    <div className="pl-3"><div className={index === 1 ? 'text-[8px] uppercase tracking-widest text-white/35' : 'text-[8px] uppercase tracking-widest text-[#9A8297]'}>SKUs</div><div className="mt-1 text-xl font-black">{plan.products}</div></div>
                  </div>
                  <div className="space-y-2.5">{'{'}plan.features.map(feature => <div key={feature} className={index === 1 ? 'flex gap-2 text-sm text-white/75' : 'flex gap-2 text-sm text-[#514452]'}><Check className={index === 1 ? 'mt-0.5 h-4 w-4 shrink-0 text-[#E7B1C7]' : 'mt-0.5 h-4 w-4 shrink-0 text-[#C65B87]'}/><span>{'{'}feature{'}'}</span></div>)}</div>
                  <Link to={'/signup?plan=' + plan.code} className={index === 1 ? 'mt-auto flex items-center justify-center gap-2 rounded-xl bg-[#C65B87] px-4 py-3.5 text-sm font-black text-white' : 'mt-auto flex items-center justify-center gap-2 rounded-xl bg-[#241622] px-4 py-3.5 text-sm font-black text-white'}>Elegir {plan.name}<ArrowRight className="h-4 w-4"/></Link>
                </article>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#9A8297]"><span>Precio centralizado</span><span>•</span><span>Límites sincronizados</span><span>•</span><span>Sin datos duplicados</span></div>
          </div>
        </section>

        <section className="bg-[#f8eff3]">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8"><div className="grid gap-4 sm:grid-cols-3">{[['Seguridad empresarial', 'Datos y accesos organizados alrededor de tu empresa.', ShieldCheck], ['Operación consistente', 'Mismo lenguaje visual y mismos flujos en todos los módulos.', Settings2], ['Listo para crecer', 'Los planes definen capacidades sin cambiar la estructura del negocio.', Zap]].map(([title,text,Icon]) => <div key={title as string} className="rounded-[1.6rem] bg-white p-6"><Icon className="h-5 w-5 text-[#C65B87]"/><h3 className="mt-5 font-black">{title as string}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text as string}</p></div>)}</div></div>
        </section>

        <section id="faq" className="bg-white">
          <div className="mx-auto max-w-4xl px-5 py-20 lg:px-8 lg:py-24"><div className="text-center"><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#C65B87]">Preguntas frecuentes</div><h2 className="mt-3 text-4xl font-black tracking-[-.05em]">Sin letra pequeña en el flujo.</h2></div><div className="mt-10 space-y-3">{[['¿El límite de productos cuenta unidades físicas?','No. El límite de los planes se refiere a tipos de producto/SKUs registrados por la empresa.'],['¿Puedo manejar varios almacenes?','Sí. El número máximo depende del plan y la operación permanece dentro de la misma empresa.'],['¿Puedo trabajar sin internet?','PALMYRA utiliza una estrategia offline-first para conservar la operación y sincronizar cuando vuelve la conexión.'],['¿Puedo cambiar de plan?','Sí, siempre que la operación existente pueda cumplir los límites y capacidades del plan seleccionado.'],['¿El administrador cuenta como empleado?','No. Los límites de empleados se aplican a empleados; el administrador se gestiona por separado.']].map(([q,a],i) => <button key={q} type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full rounded-2xl border border-[#f0e2e8] bg-[#fffafd] p-5 text-left hover:border-[#e4afc4]"><div className="flex items-center justify-between gap-5"><span className="font-black">{q}</span><ChevronDown className={openFaq === i ? 'h-5 w-5 rotate-180 text-[#C65B87]' : 'h-5 w-5 text-slate-400'}/></div>{openFaq === i && <p className="mt-3 max-w-3xl pr-8 text-sm leading-6 text-slate-600">{a}</p>}</button>)}</div></div>
        </section>

        <section className="bg-gradient-to-br from-[#C65B87] to-[#b33f6b]">
          <div className="mx-auto max-w-5xl px-5 py-20 text-center lg:px-8"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 text-white"><CamelMark className="h-10 w-12"/></div><h2 className="mt-7 text-4xl font-black tracking-[-.05em] text-white sm:text-5xl">Ordena tu operación con PALMYRA.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/80">Crea la cuenta, configura tu empresa y lleva ventas e inventario a un mismo lugar.</p><Link to="/signup" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-[#b33f6b] shadow-xl">Crear mi cuenta <ArrowRight className="h-4 w-4"/></Link></div>
        </section>
      </main>

      <footer className="bg-[#241622] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8"><div><Brand dark/><p className="mt-4 max-w-sm text-sm leading-6 text-white/45">PALMYRA reúne ventas, inventario, almacenes y equipos en una plataforma SaaS para empresas.</p></div><div><div className="text-[10px] font-black uppercase tracking-widest text-pink-300">Producto</div><div className="mt-4 grid gap-2 text-sm text-white/60"><a href="#funciones">Funciones</a><a href="#producto">Producto</a><a href="#precios">Planes</a><a href="#faq">Preguntas frecuentes</a></div></div><div><div className="text-[10px] font-black uppercase tracking-widest text-pink-300">Cuenta</div><div className="mt-4 grid gap-2 text-sm text-white/60"><Link to="/login">Iniciar sesión</Link><Link to="/signup">Crear cuenta</Link></div></div></div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-[10px] text-white/35">© {new Date().getFullYear()} PALMYRA · Commerce OS</div>
      </footer>
    </div>
  );
}
