import React, { useState, useEffect } from "react";
import { QrCode, Store, ExternalLink, Settings2, Smartphone, Save, Info, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";
import WebStoreAdmin from "../components/WebStoreAdmin";

export default function Catalog() {
  const { catalogConfig, updateCatalogConfig } = useStore();
  const [configForm, setConfigForm] = useState(catalogConfig);
  const [hostAddress, setHostAddress] = useState("");

  useEffect(() => {
    // Only set it once on mount
    setHostAddress(window.location.host);
  }, []);

  const shopUrl = `${window.location.protocol}//${hostAddress}/shop`;

  const handleSaveConfig = () => {
    updateCatalogConfig(configForm);
    alert("Configuración de la tienda web guardada exitosamente.");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <header>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
          Tienda Web (Administración)
        </h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Portal para clientes, código QR y diseño
        </p>
      </header>

      <WebStoreAdmin />

      {/* Alerta de Red Local */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 items-start">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-black text-emerald-900 uppercase tracking-widest mb-1">Acceso a la Tienda en Línea</h4>
          <p className="text-xs font-bold text-emerald-700/80">
            Tu tienda está alojada en la nube de Render con base de datos en Supabase. 
            Cualquier persona con acceso a internet puede entrar desde su computadora o celular a la URL de tu tienda.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* Lado Izquierdo: QR y Acceso */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="bg-slate-50 p-6 rounded-3xl mb-6 border border-slate-100">
              <QRCodeSVG value={shopUrl} size={200} />
            </div>

            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">
              QR de la Tienda
            </h3>
            <p className="text-slate-500 text-xs font-bold mb-6 max-w-xs mx-auto">
              Los clientes pueden escanear este código o usar el enlace web para ver los productos.
            </p>

            <div className="w-full text-left space-y-2 mb-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enlace de Acceso (URL)</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={hostAddress}
                  onChange={(e) => setHostAddress(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-100 outline-none"
                  placeholder="ej. misistema.com"
                />
              </div>
            </div>

            <a
              href={shopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir Tienda Web
            </a>
          </div>

          <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Store className="w-32 h-32" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest mb-4 relative z-10">
              ¿Cómo funciona?
            </h3>
            <ul className="space-y-4 relative z-10">
              <li className="flex items-start gap-3">
                <div className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                <p className="text-indigo-50 text-[11px] font-bold">El cliente escanea el QR o entra al enlace web.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                <p className="text-indigo-50 text-[11px] font-bold">Navega el catálogo según la disponibilidad de la sucursal seleccionada.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                <p className="text-indigo-50 text-[11px] font-bold">Arma su pedido y se genera un código QR de su orden.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">4</div>
                <p className="text-indigo-50 text-[11px] font-bold">Escaneas su QR en el POS y el carrito se llena al instante.</p>
              </li>
            </ul>
          </div>
        </div>

        {/* Lado Derecho: Configuración */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Personalizar Tienda</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ajusta los colores y el contenido</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Mensaje del Banner (Hero)</label>
              <textarea 
                value={configForm.bannerText}
                onChange={(e) => setConfigForm({...configForm, bannerText: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-100 outline-none resize-none h-20"
                placeholder="Ej. ¡Bienvenidos a nuestra tienda virtual!"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Número de WhatsApp</label>
                <input 
                  type="text" 
                  value={configForm.whatsappNumber}
                  onChange={(e) => setConfigForm({...configForm, whatsappNumber: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-100 outline-none"
                  placeholder="+5351234567"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Color Principal (Tema)</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={configForm.themeColor}
                    onChange={(e) => setConfigForm({...configForm, themeColor: e.target.value})}
                    className="w-12 h-10 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                  />
                  <input 
                    type="text" 
                    value={configForm.themeColor}
                    onChange={(e) => setConfigForm({...configForm, themeColor: e.target.value})}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-100 outline-none"
                    placeholder="#4f46e5"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <input 
                type="checkbox" 
                id="showPrices"
                checked={configForm.showPrices}
                onChange={(e) => setConfigForm({...configForm, showPrices: e.target.checked})}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
              />
              <div>
                <label htmlFor="showPrices" className="text-[11px] font-black text-slate-900 uppercase tracking-widest cursor-pointer select-none">Mostrar Precios</label>
                <p className="text-[9px] font-bold text-slate-500">Si está desactivado, el cliente solo armará el pedido sin ver los precios.</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Sucursales Visibles en el Catálogo</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {useStore.getState().branches.map(branch => (
                  <div 
                    key={branch.id}
                    onClick={() => {
                      const current = configForm.visibleBranches || [];
                      const exists = current.includes(branch.id);
                      const next = exists 
                        ? current.filter(id => id !== branch.id)
                        : [...current, branch.id];
                      setConfigForm({...configForm, visibleBranches: next});
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                      (configForm.visibleBranches || []).includes(branch.id)
                        ? "bg-indigo-50 border-indigo-200"
                        : "bg-white border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded flex items-center justify-center border transition-colors",
                      (configForm.visibleBranches || []).includes(branch.id)
                        ? "bg-indigo-600 border-indigo-600"
                        : "bg-white border-slate-300"
                    )}>
                      {(configForm.visibleBranches || []).includes(branch.id) && (
                        <Check className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{branch.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={handleSaveConfig}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 mt-4"
            >
              <Save className="w-4 h-4" />
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

