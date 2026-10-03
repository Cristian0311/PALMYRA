import React from "react";
import {
  ArrowRight, BarChart3, Boxes, Check, ChevronDown, ChevronRight, Cloud,
  CreditCard, Gauge, Layers3, LockKeyhole, Menu, Package, ReceiptText,
  RefreshCw, ScanLine, ShieldCheck, ShoppingCart, Sparkles, Store, Users,
  WalletCards, X, Zap, Building2, Warehouse, UserRound, Network, Landmark,
  CircleCheck, Command, Globe2
} from "lucide-react";
import { Link } from "react-router-dom";
import { PALMYRA_PLANS } from "../config/saas";
import "../styles/landing.css";

type DemoType = "pos" | "inventory" | "cash" | "reports";

const features = [
  [ShoppingCart, "01 · Ventas", "Vende sin detenerte", "Un POS claro para carrito, cobro, caja y operación diaria, pensado para pantallas táctiles y equipos de escritorio."],
  [Boxes, "02 · Inventario", "Sabe qué tienes", "Consulta existencias, mínimos y movimientos desde el mismo contexto empresarial."],
  [Warehouse, "03 · Multi-almacén", "Controla cada ubicación", "Mantén almacenes y transferencias conectados para trabajar con una sola versión de la operación."],
  [Users, "04 · Equipo", "Da acceso con criterio", "Organiza personas, roles y responsabilidades sin convertir la administración en una tarea interminable."],
  [BarChart3, "05 · Decisiones", "Entiende tus números", "Convierte ventas y movimientos en reportes que ayudan a revisar el negocio con más claridad."],
  [Cloud, "06 · Continuidad", "Sigue operando", "La arquitectura offline-first mantiene preparada la experiencia para momentos sin conexión."]
] as const;

const audiences = [
  [Globe2, "Propietarios", "Una vista empresarial para saber qué ocurre sin perseguir información por varios sistemas."],
  [Command, "Gerentes", "Más control sobre almacenes, equipo, compras, clientes y movimientos."],
  [ShoppingCart, "Cajeros", "Un flujo de venta directo, visual y preparado para el ritmo del punto de venta."],
  [Boxes, "Inventario", "Existencias y movimientos con contexto de ubicación para reducir pasos y errores."]
] as const;

const faqs = [
  ["¿Qué incluye PALMYRA?", "PALMYRA concentra punto de venta, inventario, almacenes, equipo, clientes, proveedores y reportes dentro del espacio empresarial."],
  ["¿Puedo administrar varios almacenes?", "Sí. La cantidad máxima depende del plan contratado y la operación permanece dentro de la misma empresa."],
  ["¿PALMYRA funciona sin internet?", "La plataforma utiliza una estrategia offline-first para mantener la operación preparada y sincronizar al recuperar conectividad."],
  ["¿Cómo funcionan los usuarios y permisos?", "El modelo empresarial separa empresa, miembros, roles y permisos para organizar quién puede realizar cada operación."],
  ["¿Qué significa el límite de productos?", "El catálogo del plan se expresa en tipos de producto/SKUs registrados por la empresa, no en la cantidad de unidades físicas existentes."],
  ["¿Puedo cambiar de plan?", "La configuración actual contempla Starter, Growth y Pro. Los cambios deben respetar la capacidad del plan seleccionado."],
  ["¿El administrador cuenta como empleado?", "No. El límite de empleados se aplica a empleados; el administrador se gestiona como responsable de la empresa."]
] as const;

function useReveal() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.08, rootMargin: "0px 0px -50px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, className: visible ? "pl-reveal is-visible" : "pl-reveal" };
}

function CamelMark({ className = "h-8 w-10" }: { className?: string }) {
  return <img src="/palmyra-camel.svg" alt="" aria-hidden="true" className={className} />;
}

function Brand({ dark = false }: { dark?: boolean }) {
  return <div className="flex items-center gap-3">
    <span className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${dark ? "bg-white text-[#211824]" : "bg-[#211824] text-white"}`}><CamelMark className="h-7 w-9" /></span>
    <span><span className={`block text-[17px] font-black tracking-[-.05em] ${dark ? "text-white" : "text-[#211824]"}`}>PALMYRA</span><span className={`block text-[8px] font-extrabold uppercase tracking-[.22em] ${dark ? "text-white/45" : "text-[#88758B]"}`}>Commerce OS</span></span>
  </div>;
}

function SectionTitle({ eyebrow, title, body, center = false }: { eyebrow: string; title: string; body: string; center?: boolean }) {
  return <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
    <div className={`pl-eyebrow ${center ? "justify-center" : ""} text-[#7957D6] `}><span className="pl-kicker-dot" />{eyebrow}</div>
    <h2 className="pl-display mt-4 text-4xl font-black leading-[1.02] text-[#211824] sm:text-5xl">{title}</h2>
    <p className={center ? "mx-auto mt-5 max-w-2xl text-base leading-7 text-[#706675] sm:text-lg" : "mt-5 max-w-2xl text-base leading-7 text-[#706675] sm:text-lg"}>{body}</p>
  </div>;
}

function DemoHeader({ label, title }: { label: string; title: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[#eee9f0] px-4 py-3 sm:px-5">
    <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1ecf7] text-[#6f52b5]"><Command className="h-4 w-4" /></span><div><div className="text-[8px] font-extrabold uppercase tracking-[.17em] text-[#9b91a0]">PALMYRA · {label}</div><div className="text-xs font-black text-[#211824]">{title}</div></div></div>
    <span className="rounded-full bg-[#edf8f3] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.1em] text-[#198a66]">Vista de demostración</span>
  </div>;
}

function POSDemo() {
  const items = [["Café premium","8.00"],["Pan artesanal","4.00"],["Agua mineral","2.00"],["Detergente","7.00"]];
  return <div className="overflow-hidden rounded-[22px] bg-white">
    <DemoHeader label="POS" title="Nueva venta" />
    <div className="grid gap-4 bg-[#faf8fb] p-4 sm:grid-cols-[1.45fr_.8fr] sm:p-5">
      <div><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold text-[#8e8491]">Catálogo de ejemplo</span><div className="flex gap-2"><span className="rounded-lg border border-[#e5dfea] bg-white px-2 py-1 text-[9px] font-bold">Buscar</span><span className="rounded-lg bg-[#211824] px-2 py-1 text-[9px] font-bold text-white">Todos</span></div></div>
        <div className="grid grid-cols-2 gap-2.5">{items.map(([name,price]) => <div key={name} className="rounded-2xl border border-[#e8e0eb] bg-white p-2.5"><div className="h-16 rounded-xl bg-gradient-to-br from-[#f1eaf7] via-[#f6edf4] to-[#ead8ef]" /><div className="mt-2 text-[10px] font-black">{name}</div><div className="mt-1 text-[10px] font-bold text-[#7957d6]">{price} USD</div></div>)}</div>
      </div>
      <div className="rounded-[18px] bg-[#211824] p-4 text-white"><div className="text-[8px] font-extrabold uppercase tracking-[.18em] text-white/45">Resumen de ejemplo</div><div className="mt-4 space-y-2 text-[10px] text-white/60"><div className="flex justify-between"><span>4 productos</span><span>$21.00</span></div><div className="flex justify-between"><span>Impuestos</span><span>Configurados</span></div></div><div className="mt-6 border-t border-white/10 pt-4"><div className="text-[8px] uppercase text-white/35">Total</div><div className="mt-1 text-2xl font-black">$21.00</div></div><button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7957d6] py-2.5 text-[10px] font-black">Cobrar <ArrowRight className="h-3.5 w-3.5"/></button></div>
    </div>
  </div>;
}

function InventoryDemo() {
  const rows = [["Café premium 500g","CAF-500","124","Normal"],["Pan artesanal","PAN-001","18","Bajo"],["Agua mineral 1.5L","AGU-15","260","Normal"],["Detergente líquido","DET-750","9","Crítico"]];
  return <div className="overflow-hidden rounded-[22px] bg-white">
    <DemoHeader label="Inventario" title="Almacén principal" />
    <div className="space-y-2 bg-[#faf8fb] p-4 sm:p-5">{rows.map(([name,sku,qty,status]) => <div key={sku} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border border-[#e9e2ec] bg-white px-3 py-3"><div><div className="text-[10px] font-black">{name}</div><div className="mt-0.5 text-[8px] text-[#9a929d]">{sku}</div></div><div className="text-xs font-black">{qty}</div><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${status === "Normal" ? "bg-[#edf8f3] text-[#198a66]" : status === "Bajo" ? "bg-[#fff4df] text-[#a8741e]" : "bg-[#fff0f2] text-[#c64c60]"}`}>{status}</span></div>)}</div>
  </div>;
}

function CashDemo() {
  const items = [["Ventas del turno","$1,284.00",WalletCards],["Pagos registrados","36",CreditCard],["Revisión","Preparada",ShieldCheck]] as const;
  return <div className="overflow-hidden rounded-[22px] bg-white">
    <DemoHeader label="Caja" title="Sesión de caja" />
    <div className="grid gap-3 bg-[#faf8fb] p-4 sm:grid-cols-2 sm:p-5"><div className="rounded-[18px] bg-[#211824] p-5 text-white"><div className="text-[8px] font-extrabold uppercase tracking-[.18em] text-white/45">Estado de ejemplo</div><div className="mt-2 text-2xl font-black">Caja abierta</div><div className="mt-2 text-xs text-white/55">Inicio · 08:00 · Turno mañana</div><div className="mt-7 rounded-2xl border border-white/10 bg-white/[.045] p-4"><div className="text-[8px] uppercase text-white/40">Saldo inicial</div><div className="mt-1 text-xl font-black">$250.00</div></div></div>
      <div className="grid gap-2.5">{items.map(([label,value,Icon]) => <div key={label} className="flex items-center justify-between rounded-2xl border border-[#e9e2ec] bg-white p-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eee8f8] text-[#6f52b5]"><Icon className="h-4 w-4"/></span><div><div className="text-[9px] font-bold text-[#938a97]">{label}</div><div className="text-sm font-black">{value}</div></div></div><ChevronRight className="h-4 w-4 text-[#aea5b2]"/></div>)}</div>
    </div>
  </div>;
}

function ReportsDemo() {
  const bars = [36,53,44,67,55,78,63];
  return <div className="overflow-hidden rounded-[22px] bg-white">
    <DemoHeader label="Reportes" title="Rendimiento de ejemplo" />
    <div className="bg-[#faf8fb] p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-3">{[["Ventas","$12,480",ArrowRight],["Productos","128",Package],["Actividad","Estable",Gauge]].map(([label,value,Icon]) => <div key={String(label)} className="rounded-2xl border border-[#e8e1eb] bg-white p-4"><div className="flex items-center justify-between"><span className="text-[8px] font-extrabold uppercase tracking-[.14em] text-[#a098a3]">{String(label)}</span>{React.createElement(Icon as React.ElementType,{className:"h-4 w-4 text-[#7957d6]"})}</div><div className="mt-2 text-xl font-black">{String(value)}</div></div>)}</div>
      <div className="mt-3 rounded-2xl border border-[#e8e1eb] bg-white p-4"><div className="flex items-center justify-between"><span className="text-[9px] font-extrabold uppercase tracking-[.15em] text-[#9a929d]">Serie de ejemplo</span><span className="text-[9px] font-bold text-[#7957d6]">7 periodos</span></div><div className="mt-5 flex h-28 items-end gap-2">{bars.map((v,i)=><span key={i} className="pl-chart-bar flex-1 rounded-t-lg bg-gradient-to-t from-[#6f52b5] to-[#c8b9e2]" style={{height:`${v}%`}}/>)}</div><div className="mt-2 grid grid-cols-7 text-center text-[8px] text-[#a29aa6]">{["L","M","X","J","V","S","D"].map(d=><span key={d}>{d}</span>)}</div></div>
    </div>
  </div>;
}

function ProductDemo() {
  const [active,setActive] = React.useState<DemoType>("pos");
  const tabs: [DemoType,string,React.ElementType][] = [["pos","Punto de venta",ShoppingCart],["inventory","Inventario",Boxes],["cash","Caja",WalletCards],["reports","Reportes",BarChart3]];
  const demo: Record<DemoType,React.ReactNode> = { pos:<POSDemo/>, inventory:<InventoryDemo/>, cash:<CashDemo/>, reports:<ReportsDemo/> };
  return <div className="pl-demo-shell overflow-hidden rounded-[28px]"><div className="flex gap-2 overflow-x-auto border-b border-[#eee9f0] bg-[#fcfbfd] p-3 sm:justify-center">{tabs.map(([id,label,Icon])=><button key={id} type="button" onClick={()=>setActive(id)} data-active={active===id} className="pl-demo-tab inline-flex min-w-max items-center gap-2 rounded-xl border border-[#e6dfeb] bg-white px-3.5 py-2 text-[10px] font-extrabold text-[#615766]" aria-pressed={active===id}><Icon className="h-3.5 w-3.5"/>{label}</button>)}</div><div className="p-3 sm:p-5">{demo[active]}</div></div>;
}

function Landing() {
  const [mobileMenu,setMobileMenu] = React.useState(false);
  const [openFaq,setOpenFaq] = React.useState<number|null>(0);
  const reveals = {
    hero:useReveal(), features:useReveal(), product:useReveal(), people:useReveal(),
    security:useReveal(), story:useReveal(), steps:useReveal(), pricing:useReveal(), faq:useReveal()
  };

  React.useEffect(()=>{
    document.documentElement.classList.add("palmyra-landing-active");
    document.body.classList.add("palmyra-landing-active");
    document.getElementById("root")?.classList.add("palmyra-landing-active");
    return ()=>{
      document.documentElement.classList.remove("palmyra-landing-active");
      document.body.classList.remove("palmyra-landing-active");
      document.getElementById("root")?.classList.remove("palmyra-landing-active");
    };
  },[]);

  return <div className="min-h-screen overflow-x-hidden bg-[#fbf8f5] text-[#211824]">
    <header className="sticky top-0 z-50 border-b border-[#eadfea] bg-[#fbf8f5]/95">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-3.5 sm:px-7 lg:px-10">
        <Link to="/landing" aria-label="PALMYRA"><Brand/></Link>
        <nav className="hidden items-center gap-7 text-sm font-bold text-[#605765] lg:flex" aria-label="Navegación principal">
          {[["Producto","#producto"],["Funciones","#funciones"],["Operación","#operacion"],["Planes","#precios"],["FAQ","#faq"]].map(([label,href])=><a key={href} href={href} className="hover:text-[#6f52b5]">{label}</a>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex"><Link to="/login" className="rounded-xl px-3.5 py-2.5 text-sm font-black text-[#514854] hover:bg-white">Iniciar sesión</Link><Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#211824] px-4 py-2.5 text-sm font-black text-white hover:bg-[#35223d]">Crear cuenta<ArrowRight className="h-4 w-4"/></Link></div>
        <button type="button" className="rounded-xl border border-[#e5dce8] bg-white p-2.5 md:hidden" onClick={()=>setMobileMenu(v=>!v)} aria-label={mobileMenu?"Cerrar menú":"Abrir menú"} aria-expanded={mobileMenu}>{mobileMenu?<X className="h-5 w-5"/>:<Menu className="h-5 w-5"/>}</button>
      </div>
      {mobileMenu && <div className="border-t border-[#eadfea] bg-[#fbf8f5] px-5 py-4 md:hidden"><div className="grid gap-1">{[["Producto","#producto"],["Funciones","#funciones"],["Operación","#operacion"],["Planes","#precios"],["FAQ","#faq"]].map(([label,href])=><a key={href} href={href} onClick={()=>setMobileMenu(false)} className="rounded-xl px-3 py-3 text-sm font-bold hover:bg-white">{label}</a>)}<div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#eadfea] pt-3"><Link to="/login" className="rounded-xl border border-[#e2d8e6] bg-white px-3 py-3 text-center text-sm font-black">Entrar</Link><Link to="/signup" className="rounded-xl bg-[#211824] px-3 py-3 text-center text-sm font-black text-white">Crear cuenta</Link></div></div></div>}
    </header>

    <main>
      <section className="relative overflow-hidden border-b border-[#eee5f0]">
        <div className="pl-grid-bg pointer-events-none absolute inset-0 opacity-80"/><div className="pl-hero-glow pointer-events-none absolute inset-0"/>
        <div className="relative mx-auto grid max-w-[1320px] gap-12 px-5 pb-20 pt-12 sm:px-7 sm:pt-16 lg:grid-cols-[.83fr_1.17fr] lg:items-center lg:px-10 lg:pb-28 lg:pt-20">
          <div ref={reveals.hero.ref} className={reveals.hero.className}>
            <div className="pl-eyebrow text-[#6f52b5]"><span className="pl-kicker-dot"/>POS · INVENTARIO · OPERACIÓN EMPRESARIAL</div>
            <h1 className="pl-display mt-6 max-w-4xl text-[3.35rem] font-black leading-[.92] sm:text-6xl lg:text-[5.85rem]">Controla tu negocio<br/><span className="bg-gradient-to-r from-[#6f52b5] via-[#7957d6] to-[#c26d9f] bg-clip-text text-transparent">desde un solo lugar.</span></h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-[#706675] sm:text-lg sm:leading-8">PALMYRA conecta ventas, caja, inventario, almacenes, clientes, equipo y reportes en una plataforma empresarial diseñada para la operación diaria.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#6f52b5] px-6 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(111,82,181,.24)] hover:bg-[#5f43a7]">Crear cuenta<ArrowRight className="h-4 w-4"/></Link><a href="#producto" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dfd4e4] bg-white px-6 py-4 text-sm font-black text-[#453c49] hover:border-[#b7a7cc]">Ver el producto<ChevronRight className="h-4 w-4"/></a></div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-[10px] font-extrabold uppercase tracking-[.11em] text-[#837987]">{["Multialmacén","Offline-first","Por empresa","PWA"].map(item=><span key={item} className="inline-flex items-center gap-2"><CircleCheck className="h-4 w-4 text-[#6f52b5]"/>{item}</span>)}</div>
          </div>

          <div className="relative mx-auto w-full max-w-[760px]">
            <div className="pointer-events-none absolute -inset-7 rounded-[40px] bg-[radial-gradient(circle_at_50%_35%,rgba(121,87,214,.18),transparent_58%)] blur-2xl"/>
            <div className="relative pl-border-gradient rounded-[30px] bg-white/70 p-2"><div className="overflow-hidden rounded-[24px] bg-white">
              <div className="flex items-center gap-2 border-b border-[#ede7f0] bg-[#fcfbfd] px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-[#d5cbd9]"/><span className="h-2.5 w-2.5 rounded-full bg-[#d5cbd9]"/><span className="h-2.5 w-2.5 rounded-full bg-[#d5cbd9]"/><span className="ml-2 rounded-lg bg-[#f0ebf5] px-2.5 py-1 text-[8px] font-bold text-[#7e7381]">PALMYRA · Demo</span></div>
              <div className="grid grid-cols-[70px_1fr] sm:grid-cols-[180px_1fr]"><aside className="hidden border-r border-[#efe9f1] bg-[#fbfafc] p-3 sm:block"><div className="flex items-center gap-2 rounded-xl bg-[#211824] px-2 py-2 text-white"><CamelMark className="h-4 w-5"/><span className="text-[9px] font-black">PALMYRA</span></div><div className="mt-4 space-y-2 text-[8px] font-bold text-[#8e8592]">{["Inicio","POS","Inventario","Almacenes","Equipo","Reportes"].map((item,i)=><div key={item} className={i===1?"rounded-xl bg-[#eee8f8] px-2.5 py-2 text-[#6f52b5]":"px-2.5 py-2"}>{item}</div>)}</div></aside>
                <div className="bg-[#faf8fb] p-3 sm:p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-[8px] font-extrabold uppercase tracking-[.18em] text-[#9c929f]">Punto de venta</div><div className="mt-1 text-base font-black sm:text-xl">Nueva venta</div></div><div className="flex items-center gap-2"><span className="rounded-full bg-[#edf8f3] px-2.5 py-1.5 text-[8px] font-black text-[#198a66]">Caja abierta</span><span className="rounded-xl bg-white px-2 py-2 text-[8px] font-bold text-[#796f7d]">Ejemplo</span></div></div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_.68fr]"><div className="grid grid-cols-2 gap-2">{["Café premium","Pan artesanal","Agua mineral","Detergente"].map((name,i)=><div key={name} className="rounded-2xl border border-[#eae3ec] bg-white p-2.5"><div className="h-14 rounded-xl bg-gradient-to-br from-[#eee7f7] via-[#f6edf4] to-[#eadcf2]"/><div className="mt-2 text-[9px] font-black">{name}</div><div className="mt-1 text-[9px] font-bold text-[#6f52b5]">{[8,4,2,7][i].toFixed(2)} USD</div></div>)}</div>
                    <div className="rounded-[20px] bg-[#211824] p-4 text-white"><div className="text-[8px] uppercase tracking-[.17em] text-white/40">Resumen de ejemplo</div><div className="mt-5 space-y-2 text-[9px] text-white/55"><div className="flex justify-between"><span>4 productos</span><span>$21.00</span></div><div className="flex justify-between"><span>Impuestos</span><span>Configurados</span></div></div><div className="mt-6 border-t border-white/10 pt-4"><div className="text-[8px] uppercase text-white/35">Total</div><div className="mt-1 text-2xl font-black">$21.00</div></div><div className="mt-4 rounded-xl bg-[#7957d6] py-2.5 text-center text-[9px] font-black">Cobrar</div></div>
                  </div>
                </div></div>
            </div></div>
            <div className="pl-orbit absolute -left-5 -bottom-8 hidden w-[43%] rounded-[22px] border border-white bg-white p-2 shadow-[0_22px_50px_rgba(53,34,61,.15)] sm:block"><InventoryDemo/></div>
            <div className="pl-orbit pl-orbit-delay absolute -right-4 -top-8 hidden rounded-2xl border border-white bg-white p-3 shadow-[0_18px_45px_rgba(53,34,61,.12)] md:block"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eee8f8] text-[#6f52b5]"><Gauge className="h-4 w-4"/></span><div><div className="text-[8px] font-extrabold uppercase tracking-[.16em] text-[#9d939f]">Continuidad</div><div className="text-[10px] font-black">Operación preparada</div></div></div></div>
          </div>
        </div>
      </section>

      <section aria-label="Capacidades de PALMYRA" className="overflow-hidden border-b border-[#ece5ef] bg-white"><div className="py-3"><div className="pl-marquee" aria-hidden="true">{["Multiempresa","Multialmacén","Offline-first","PWA","Roles y permisos","Ventas + inventario"].concat(["Multiempresa","Multialmacén","Offline-first","PWA","Roles y permisos","Ventas + inventario"]).map((item,i)=><span key={item+i} className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8d828f]"><span className="h-1.5 w-1.5 rounded-full bg-[#a85fba]"/>{item}</span>)}</div></div></section>

      <section id="funciones" className="bg-white"><div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-7 lg:px-10 lg:py-28"><div ref={reveals.features.ref} className={reveals.features.className}><SectionTitle eyebrow="Una plataforma, varios trabajos" title="La operación completa cabe en un sistema coherente." body="Cada módulo resuelve una tarea distinta, pero todos comparten el mismo contexto empresarial."/></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">{features.map(([Icon,eyebrow,title,body],i)=><article key={title} className={`pl-card rounded-[24px] p-6 lg:p-7 ${i===0?"lg:col-span-7":i===1?"lg:col-span-5":"lg:col-span-4"}`}><div className="flex items-start justify-between gap-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eee8f8] text-[#6f52b5]"><Icon className="h-5 w-5"/></span><span className="pl-eyebrow text-[#a096a4]">{eyebrow}</span></div><h3 className="mt-8 text-2xl font-black tracking-[-.035em]">{title}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-[#706675]">{body}</p><div className="mt-7 h-1 rounded-full bg-[#f0ebf3]"><div className={i%2===0?"h-full w-[72%] rounded-full bg-gradient-to-r from-[#6f52b5] to-[#c8b9e2]":"h-full w-[58%] rounded-full bg-gradient-to-r from-[#a85fba] to-[#e8c2d3]"}/></div></article>)}</div></div></section>

      <section id="producto" className="bg-[#f2edf7]"><div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-7 lg:px-10 lg:py-28"><div ref={reveals.product.ref} className={reveals.product.className}><SectionTitle center eyebrow="Producto en movimiento" title="Mira cómo se organiza la operación antes de entrar." body="Una muestra interactiva de los flujos que forman el núcleo de PALMYRA. Los datos visibles aquí son demostrativos."/></div><div className="mt-12"><ProductDemo/></div><div className="mx-auto mt-5 flex max-w-4xl items-center justify-center gap-2 text-center text-[10px] leading-5 text-[#827887]"><Sparkles className="h-3.5 w-3.5 shrink-0 text-[#7957d6]"/>Los importes, nombres y métricas de esta demo son ejemplos y no representan actividad de clientes.</div></div></section>

      <section id="operacion" className="bg-white"><div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-7 lg:px-10 lg:py-28"><div ref={reveals.people.ref} className={reveals.people.className}><SectionTitle eyebrow="Diseñado para cada rol" title="La misma plataforma. Distintas responsabilidades." body="PALMYRA presenta la información y las herramientas que cada persona necesita para ejecutar su parte de la operación."/></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{audiences.map(([Icon,title,body])=><article key={title} className="pl-card rounded-[22px] p-5 sm:p-6"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eee8f8] text-[#6f52b5]"><Icon className="h-5 w-5"/></span><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-[#706675]">{body}</p></article>)}</div></div></section>

      <section className="bg-[#211824] text-white"><div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-7 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:px-10 lg:py-28"><div ref={reveals.security.ref} className={reveals.security.className}><div className="pl-eyebrow text-[#c8b9e2]"><span className="pl-kicker-dot"/>Arquitectura empresarial</div><h2 className="pl-display mt-4 text-4xl font-black leading-[1.02] sm:text-5xl">Cada empresa tiene su propio contexto.</h2><p className="mt-5 max-w-xl text-base leading-7 text-white/58 sm:text-lg">El modelo de PALMYRA organiza la operación alrededor de la empresa: miembros, roles, permisos, almacenes y registros.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{[[Building2,"Empresa","Un espacio de trabajo independiente."],[Users,"Miembros","Personas vinculadas a la empresa."],[ShieldCheck,"Roles","Responsabilidades organizadas."],[LockKeyhole,"Auditoría","Registros para revisar operaciones."]].map(([Icon,title,body])=>{const I=Icon as React.ElementType;return <div key={String(title)} className="rounded-2xl border border-white/9 bg-white/[.045] p-4"><I className="h-4 w-4 text-[#c8b9e2]"/><div className="mt-4 text-sm font-black">{String(title)}</div><div className="mt-1 text-xs leading-5 text-white/40">{String(body)}</div></div>})}</div></div><div className="relative"><div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(121,87,214,.28),transparent_68%)] blur-2xl"/><div className="pl-glass relative overflow-hidden rounded-[28px] p-6 text-[#211824] sm:p-8"><div className="flex items-center justify-between"><div><div className="text-[8px] font-extrabold uppercase tracking-[.18em] text-[#968b9d]">Mapa de contexto</div><div className="mt-1 text-lg font-black">Empresa → operación</div></div><Network className="h-5 w-5 text-[#7957d6]"/></div><div className="mt-7 space-y-3">{[["Empresa","PALMYRA","El espacio empresarial"],["Acceso","Roles + permisos","Quién puede hacer qué"],["Operación","Almacenes + POS","Dónde y cómo se trabaja"],["Registro","Actividad + auditoría","Qué ocurrió y cuándo"]].map(([a,b,c],i)=><div key={a} className="flex items-center gap-3 rounded-2xl border border-[#e8dfeb] bg-white/70 p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#eee8f8] text-[#6f52b5] text-[10px] font-black">0{i+1}</span><div><div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#a198a4]">{a}</div><div className="text-sm font-black">{b}</div><div className="text-[10px] text-[#847a88]">{c}</div></div></div>)}</div></div></div></div></section>

      <section id="palmyra" className="bg-[#fbf8f5]"><div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-7 lg:px-10 lg:py-28"><div ref={reveals.story.ref} className={reveals.story.className}><div className="grid gap-10 lg:grid-cols-[.95fr_1.05fr] lg:items-center"><div className="overflow-hidden rounded-[30px] border border-[#e9e0eb] bg-white p-2 shadow-[0_26px_65px_rgba(53,34,61,.10)]"><div className="relative overflow-hidden rounded-[24px]"><img src="https://upload.wikimedia.org/wikipedia/commons/e/e4/Palmyra%2C_Syria%2C_The_Great_Colonnade.jpg" alt="Gran Columnata de la antigua Palmira, Siria" loading="lazy" className="h-[330px] w-full object-cover sm:h-[450px]"/><div className="absolute inset-0 bg-gradient-to-t from-[#211824]/80 via-transparent to-transparent"/><div className="absolute bottom-5 left-5 text-white"><div className="text-[8px] font-extrabold uppercase tracking-[.2em] text-[#e8c2d3]">PALMYRA · SYRIA</div><div className="mt-1 text-2xl font-black">Gran Columnata</div></div></div><div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-3 text-[9px] text-[#918795]"><span>Fotografía de Vyacheslav Argenberg</span><a href="https://commons.wikimedia.org/wiki/File:Palmyra,_Syria,_The_Great_Colonnade.jpg" target="_blank" rel="noreferrer" className="font-bold text-[#6f52b5]">Ver licencia ↗</a></div></div><div><div className="pl-eyebrow text-[#a85fba]"><span className="pl-kicker-dot"/>Por qué PALMYRA</div><h2 className="pl-display mt-4 text-4xl font-black leading-[1.02] sm:text-5xl">Una marca inspirada en conectar mundos.</h2><p className="mt-5 text-base leading-7 text-[#706675] sm:text-lg">La antigua Palmira fue un punto de intercambio entre rutas, culturas y comercio. Esa idea inspira el nombre: un lugar donde información, personas y operaciones pueden encontrarse en un mismo sistema.</p><div className="mt-7 grid gap-3">{[[Network,"Conectar","Unir piezas que antes vivían separadas."],[Landmark,"Sostener","Mantener la operación disponible y clara."],[Layers3,"Integrar","Hacer que módulos diferentes trabajen como uno."]].map(([Icon,title,body])=><div key={String(title)} className="flex gap-3 rounded-2xl border border-[#e9e1eb] bg-white p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eee8f8] text-[#6f52b5]"><Icon className="h-4 w-4"/></span><div><div className="font-black">{String(title)}</div><div className="mt-1 text-sm leading-6 text-[#756c79]">{String(body)}</div></div></div>)}</div><p className="mt-6 text-[9px] leading-5 text-[#9b919e]">Contexto histórico: UNESCO World Heritage Centre y The Metropolitan Museum of Art. Fotografía bajo CC BY 4.0.</p></div></div></div></div></section>

      <section id="como-funciona" className="bg-white"><div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-7 lg:px-10 lg:py-28"><div ref={reveals.steps.ref} className={reveals.steps.className}><SectionTitle center eyebrow="De cuenta a operación" title="Empieza con un flujo corto y definido." body="La estructura de alta convierte la cuenta en un espacio empresarial y deja lista la base para operar."/></div><div className="mt-12 grid gap-4 md:grid-cols-4">{[[UserRound,"01","Crea tu cuenta","Registra el responsable y valida el acceso."],[Building2,"02","Crea tu empresa","Define el espacio empresarial y su capacidad."],[Warehouse,"03","Configura","Prepara almacenes, catálogo y equipo inicial."],[Zap,"04","Opera","Entra al POS y comienza a trabajar."]].map(([Icon,number,title,body],i)=><article key={String(number)} className="relative rounded-[24px] border border-[#e8e0eb] bg-[#fbf9fc] p-6"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eee8f8] text-[#6f52b5]"><Icon className="h-4 w-4"/></span><span className="text-4xl font-black text-[#d9cee4]">{String(number)}</span></div><h3 className="mt-6 text-lg font-black">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[#706675]">{String(body)}</p>{i<3&&<ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-white text-[#7957d6] md:block"/>}</article>)}</div></div></section>

      <section id="precios" className="bg-[#211824] text-white"><div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-7 lg:px-10 lg:py-28"><div ref={reveals.pricing.ref} className={reveals.pricing.className}><div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div className="max-w-3xl"><div className="pl-eyebrow text-[#c8b9e2]"><span className="pl-kicker-dot"/>Planes actuales</div><h2 className="pl-display mt-4 text-4xl font-black leading-[1.02] sm:text-5xl">Más capacidad, sin cambiar de sistema.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">Los planes actuales de PALMYRA definen capacidad de almacenes, equipo y catálogo. La experiencia base permanece dentro de la misma plataforma.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.05] px-4 py-3 text-[9px] font-extrabold uppercase tracking-[.14em] text-white/45">Precios según configuración actual</div></div><div className="mt-10 grid gap-4 lg:grid-cols-3">{PALMYRA_PLANS.map((plan,index)=><article key={plan.code} className={`rounded-[26px] border p-6 ${index===1?"border-[#7957d6]/70 bg-[#30233a]":"border-white/10 bg-white/[.045]"}`}><div className="flex items-center justify-between gap-4"><div><div className="text-[9px] font-extrabold uppercase tracking-[.18em] text-white/35">0{index+1} · capacidad</div><h3 className="mt-1 text-2xl font-black">{plan.name}</h3></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.12em] text-white/45">{index===0?"Inicio":index===1?"Mayor capacidad":"Escala"}</span></div><div className="mt-7 flex items-end gap-1"><span className="pl-display text-5xl font-black">${plan.price}</span><span className="pb-1.5 text-xs text-white/35">/mes</span></div><p className="mt-3 min-h-[44px] text-sm leading-6 text-white/50">{plan.description}</p><div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-black/10">{[["Almacenes",plan.warehouses],["Equipo",plan.employees],["SKUs",plan.products]].map(([label,value],i)=><div key={String(label)} className={i?"border-l border-white/10 px-3 py-3":"px-3 py-3"}><div className="text-[8px] font-extrabold uppercase tracking-[.1em] text-white/30">{String(label)}</div><div className="mt-1 text-lg font-black">{String(value)}</div></div>)}</div><div className="mt-5 space-y-2">{plan.features.slice(0,5).map(feature=><div key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-white/65"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[.08] text-[#c8b9e2]"><Check className="h-3 w-3"/></span><span>{feature}</span></div>)}</div><Link to={`/signup?plan=${plan.code}`} className={index===1?"mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#c8b9e2] px-4 text-xs font-black text-[#35223d] hover:bg-white":"mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[.04] px-4 text-xs font-black text-white hover:border-[#c8b9e2] hover:bg-[#6f52b5]"}>Elegir {plan.name}<ArrowRight className="h-4 w-4"/></Link></article>)}</div></div></div></section>

      <section className="bg-[#f2edf7]"><div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-7 lg:px-10 lg:py-20"><div className="grid gap-4 md:grid-cols-3">{[[ShieldCheck,"Seguridad por estructura","Empresa, roles, permisos y registros forman parte del modelo operativo."],[RefreshCw,"Continuidad operativa","La experiencia está preparada para trabajar con una arquitectura offline-first."],[Zap,"Escala por capacidad","Los planes ajustan capacidad de operación sin cambiar el núcleo del sistema."]].map(([Icon,title,body])=><article key={String(title)} className="rounded-[24px] border border-[#e7deea] bg-white p-6"><Icon className="h-5 w-5 text-[#6f52b5]"/><h3 className="mt-5 font-black">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[#706675]">{String(body)}</p></article>)}</div></div></section>

      <section id="faq" className="bg-white"><div className="mx-auto max-w-4xl px-5 py-20 sm:px-7 lg:px-10 lg:py-28"><div ref={reveals.faq.ref} className={reveals.faq.className}><SectionTitle center eyebrow="Preguntas frecuentes" title="Las respuestas importantes, antes de registrarte." body="Información clara sobre capacidades, operación, catálogo y estructura empresarial."/></div><div className="mt-10 space-y-3">{faqs.map(([question,answer],i)=>{const open=openFaq===i;return <div key={question} className="rounded-2xl border border-[#e9e1ec] bg-[#fcfbfd]"><button type="button" className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left" onClick={()=>setOpenFaq(open?null:i)} aria-expanded={open}><span className="text-sm font-black sm:text-base">{question}</span><ChevronDown className={`h-5 w-5 shrink-0 text-[#8f8494] ${open?"rotate-180 text-[#6f52b5]":""}`}/></button>{open&&<div className="px-5 pb-5 text-sm leading-6 text-[#706675]">{answer}</div>}</div>})}</div></div></section>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#6f52b5] via-[#7957d6] to-[#a85fba] text-white"><div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"/><div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#e8c2d3]/15 blur-3xl"/><div className="relative mx-auto max-w-[1000px] px-5 py-20 text-center sm:px-7 lg:px-10 lg:py-24"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/20 bg-white/10"><CamelMark className="h-10 w-12"/></span><h2 className="pl-display mx-auto mt-7 max-w-3xl text-4xl font-black leading-[1.02] sm:text-5xl">Pon ventas, inventario y operación en el mismo lugar.</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">Crea tu cuenta y recorre el flujo de PALMYRA hasta convertirlo en el espacio de trabajo de tu empresa.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-[#4f3c71]">Crear cuenta<ArrowRight className="h-4 w-4"/></Link><Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-4 text-sm font-black text-white">Iniciar sesión</Link></div></div></section>
    </main>

    <footer className="bg-[#211824] text-white"><div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-12 sm:px-7 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-10 lg:py-16"><div><Brand dark/><p className="mt-5 max-w-sm text-sm leading-6 text-white/42">PALMYRA es una plataforma SaaS para ventas, inventario y operación empresarial.</p><div className="mt-5 flex flex-wrap gap-2 text-[9px] font-extrabold uppercase tracking-[.12em] text-white/35"><span className="rounded-full border border-white/10 px-2.5 py-1.5">PWA</span><span className="rounded-full border border-white/10 px-2.5 py-1.5">Offline-first</span><span className="rounded-full border border-white/10 px-2.5 py-1.5">Multiempresa</span></div></div><div><div className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#c8b9e2]">Producto</div><div className="mt-4 grid gap-2 text-sm text-white/55"><a href="#producto">Demo</a><a href="#funciones">Funciones</a><a href="#precios">Planes</a><a href="#faq">FAQ</a></div></div><div><div className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#c8b9e2]">Cuenta</div><div className="mt-4 grid gap-2 text-sm text-white/55"><Link to="/login">Iniciar sesión</Link><Link to="/signup">Crear cuenta</Link></div></div><div><div className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#c8b9e2]">Empresa</div><div className="mt-4 grid gap-2 text-sm text-white/55"><a href="#operacion">Cómo opera</a><a href="#como-funciona">Primeros pasos</a><a href="#palmyra">Origen del nombre</a></div></div></div><div className="border-t border-white/10 px-5 py-5 text-center text-[9px] text-white/30">© {new Date().getFullYear()} PALMYRA · Commerce OS</div></footer>
  </div>;
}

export default Landing;
