import { useState } from "react";
import { QrCode, Copy, Check, Store } from "lucide-react";
import QRCode from "qrcode";
import { useStore } from "../store/useStore";

export default function WebStoreAdmin() {
  const [copied, setCopied] = useState(false);
  const shopUrl = `${window.location.origin}/shop`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shopUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = async () => {
    const dataUrl = await QRCode.toDataURL(shopUrl, { width: 300 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "tienda-web-qr.png";
    link.click();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
      <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
          <Store className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Tienda Web</h3>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Administración de Catálogo Digital</p>
        </div>
      </div>

      <div className="space-y-4 text-xs">
        <p className="text-slate-600">
          Tu tienda web está activa en <code className="bg-slate-100 px-1 rounded">{shopUrl}</code>.
          Comparte este enlace con tus clientes para que puedan ver el inventario y realizar pedidos.
        </p>
        
        <div className="flex gap-2">
          <button 
            onClick={copyToClipboard}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold uppercase tracking-widest transition-all"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiado!" : "Copiar Enlace"}
          </button>
          <button 
            onClick={downloadQR}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold uppercase tracking-widest transition-all"
          >
            <QrCode className="w-3 h-3" />
            Descargar QR
          </button>
        </div>
      </div>
    </div>
  );
}
