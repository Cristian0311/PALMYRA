import React from 'react';
import {
  ArrowRight, BarChart3, Boxes, Check, ChevronDown, ChevronRight, Cloud,
  CreditCard, Gauge, Menu, Package, ReceiptText, ShieldCheck, ShoppingCart,
  Sparkles, Store, Users, WalletCards, X, Zap, Building2, Warehouse,
  UserRound, Settings2, CircleCheck, Network, Landmark, Layers3, Mail
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
        <div className={`text-lg font-black tracking-[-.04em] ${dark ? 'text-white' : 'text-[#241622]'}`}>PALMYRA</div>
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
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [accountEmail, setAccountEmail] = React.useState('');
  const [accountPassword, setAccountPassword] = React.useState('');

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
          <div className="relative hidden items-center gap-2 md:flex">
            <button type="button" onClick={() => setAccountOpen(v => !v)} aria-expanded={accountOpen} className="inline-flex items-center gap-2 rounded-xl border border-[#dfcedc] bg-white px-4 py-2.5 text-sm font-black text-[#3c2a3a] shadow-sm hover:border-[#C65B87] hover:bg-[#FBF5F8]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0E7F3] text-[#6C4B70]"><UserRound className="h-3.5 w-3.5"/></span>
              Cuenta
              <ChevronDown className={accountOpen ? 'h-4 w-4 rotate-180' : 'h-4 w-4'}/>
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[320px] overflow-hidden rounded-[1.4rem] border border-[#e6d7e2] bg-white p-4 shadow-[0_24px_70px_rgba(56,30,56,.18)]">
                <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3EAF5] text-[#6C4B70]"><Mail className="h-4 w-4"/></div><div><div className="text-[9px] font-black uppercase tracking-[.16em] text-[#9B859B]">Acceso rápido</div><div className="text-sm font-black text-[#241622]">Entra a PALMYRA</div></div></div>
                <div className="mt-4 grid gap-2.5">
                  <input value={accountEmail} onChange={e => setAccountEmail(e.target.value)} type="email" autoComplete="email" placeholder="correo@empresa.com" className="h-11 w-full rounded-xl border border-[#e4d8e1] bg-[#FBF8FA] px-3 text-sm outline-none focus:border-[#C65B87] focus:ring-4 focus:ring-[#F4DCE7]"/>
                  <input value={accountPassword} onChange={e => setAccountPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="Contraseña" className="h-11 w-full rounded-xl border border-[#e4d8e1] bg-[#FBF8FA] px-3 text-sm outline-none focus:border-[#C65B87] focus:ring-4 focus:ring-[#F4DCE7]"/>
                  <Link to="/login" className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#5E3D62] px-4 text-sm font-black text-white hover:bg-[#4b304e]">Continuar <ArrowRight className="h-4 w-4"/></Link>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#eee5eb] pt-3 text-[11px]">
                  <span className="text-[#8c7a8d]">Primera vez aquí?</span>
                  <Link to="/signup" className="font-black text-[#B94E7D] hover:underline">Crear cuenta</Link>
                </div>
              </div>
            )}
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

        
        <section id="precios" className="relative overflow-hidden bg-[#241622] text-white">
          <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-[#C65B87]/18 blur-3xl"/>
          <div className="absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-[#9B83AE]/16 blur-3xl"/>
          <div className="relative mx-auto max-w-7xl px-5 py-18 lg:px-8 lg:py-20">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <div className="text-[10px] font-black uppercase tracking-[.22em] text-[#E7B1C7]">Planes PALMYRA</div>
                <h2 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">Elige capacidad. Mantén la misma operación.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">Cada plan define capacidad de almacenes, equipo y catálogo. La estructura del sistema permanece igual para que crecer no signifique aprender otra herramienta.</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.05] px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-white/50"><ShieldCheck className="h-4 w-4 text-[#E7B1C7]"/> Capacidades centralizadas</div>
            </div>
            <div className="mt-8 grid gap-3 lg:grid-cols-3">
              {PALMYRA_PLANS.map((plan, index) => (
                <article key={plan.code} className={index === 1 ? 'relative overflow-hidden rounded-[1.45rem] border border-[#C65B87]/70 bg-[#3A2639] p-5 shadow-[0_26px_60px_rgba(0,0,0,.18)]' : 'relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[.045] p-5'}>
                  {index === 1 && <div className="absolute right-4 top-4 rounded-lg bg-[#E7B1C7] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.14em] text-[#3b2437]">Más equilibrado</div>}
                  <div className="flex items-center gap-3">
                    <div className={index===0 ? 'flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1DDE7] text-[#74445C]' : index===1 ? 'flex h-10 w-10 items-center justify-center rounded-xl bg-[#C65B87]/20 text-[#F2C6D7]' : 'flex h-10 w-10 items-center justify-center rounded-xl bg-[#D8C7E2]/15 text-[#D8C7E2]'}>
                      <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">{index===0 ? <><path d="M8 8.5h16v15H8z" stroke="currentColor" strokeWidth="1.8" rx="3"/><path d="M11 12h10M11 16h7M11 20h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></> : index===1 ? <><path d="M5 13.5 16 7l11 6.5v8.8L16 27 5 22.3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M16 7v20M5 13.5l11 6 11-6" stroke="currentColor" strokeWidth="1.4"/></> : <><path d="M7 23.5V13l5-4 5 4v10.5M17 23.5V9l5 4v10.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M6 25h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></>}</svg>
                    </div>
                    <div><div className="text-[9px] font-black uppercase tracking-[.18em] text-white/35">0{index+1} · capacidad</div><h3 className="mt-0.5 text-xl font-black">{plan.name}</h3></div>
                  </div>
                  <div className="mt-5 flex items-end gap-1"><span className="text-4xl font-black tracking-[-.05em]">{'$'}{plan.price}</span><span className="pb-1 text-xs text-white/40">/mes</span></div>
                  <p className="mt-2 min-h-[48px] text-xs leading-5 text-white/50">{plan.description}</p>
                  <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-black/10">
                    {[
                      ['Almacenes', plan.warehouses, 'warehouse'],
                      ['Equipo', plan.employees, 'team'],
                      ['SKUs', plan.products, 'sku']
                    ].map(([label, value, icon], metricIndex) => <div key={String(label)} className={metricIndex>0 ? 'border-l border-white/10 px-2.5 py-3' : 'px-2.5 py-3'}>
                      <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.12em] text-white/35">
                        {icon==='warehouse' ? <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"><path d="M3 10 12 4l9 6v9H3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M8 21v-6h8v6" stroke="currentColor" strokeWidth="1.7"/></svg> : icon==='team' ? <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7"/><circle cx="17" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7"/><path d="M3.5 19c.4-3.3 2.4-5 5.5-5s5.1 1.7 5.5 5M14 19c.2-2.1 1.2-3.3 3-3.3 1.8 0 2.8 1.2 3 3.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg> : <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.7"/><path d="M8 9h8M8 13h5M8 17h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
                        {label}
                      </div>
                      <div className="mt-1 text-lg font-black text-white">{value}</div>
                    </div>)}
                  </div>
                  <div className="mt-4 grid gap-1.5">
                    {plan.features.map(feature => <div key={feature} className="flex items-start gap-2 text-xs text-white/65"><svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[#E7B1C7]" fill="none" aria-hidden="true"><path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{feature}</span></div>)}
                  </div>
                  <Link to={'/signup?plan=' + plan.code} className={index===1 ? 'mt-5 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#E7B1C7] px-4 text-xs font-black text-[#392535] hover:bg-white' : 'mt-5 flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-4 text-xs font-black text-white hover:border-[#E7B1C7] hover:bg-[#C65B87]'}>Comenzar con {plan.name}<ArrowRight className="h-3.5 w-3.5"/></Link>
                </article>
              ))}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[
                ['Sin cargos ocultos','La capacidad está descrita en cada plan.'],
                ['Escala sin rediseño','La empresa conserva la misma estructura.'],
                ['Acceso continuo','La plataforma permanece disponible para tu equipo.']
              ].map(([title, body], i) => <div key={title} className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[.025] px-3 py-3"><svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-[#E7B1C7]" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6"/><path d={i===0 ? "M8.5 12h7" : i===1 ? "M8.5 12.5 11 15l4.5-5" : "M12 8v8M8 12h8"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg><div><div className="text-[10px] font-black text-white/80">{title}</div><div className="mt-0.5 text-[10px] leading-5 text-white/35">{body}</div></div></div>)}
            </div>
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
