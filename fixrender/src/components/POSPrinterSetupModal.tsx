import React from 'react';
import { Bluetooth, Printer, Smartphone, Usb, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface POSPrinterSetupModalProps {
  connectedPrinterName: string | null;
  printerStatusMsg: string;
  isConnectingPrinter: boolean;
  onClose: () => void;
  onPairBluetooth: () => void | Promise<void>;
  onConnectUsb: () => void | Promise<void>;
  onPrinterConnectedChange: (name: string | null) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function POSPrinterSetupModal({
  connectedPrinterName,
  printerStatusMsg,
  isConnectingPrinter,
  onClose,
  onPairBluetooth,
  onConnectUsb,
  onPrinterConnectedChange,
  onSuccess,
  onError
}: POSPrinterSetupModalProps) {
  return (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-slate-100">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Impresora Térmica 58mm</h3>
            <p className="text-[10px] font-bold text-slate-400">Conexión directa Bluetooth, USB y RawBT</p>
          </div>
        </div>
        <button 
          onClick={() => onClose()}
          className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 flex items-center justify-center transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Current Status */}
        <div className={cn(
          "p-3 rounded-2xl border flex items-center justify-between",
          connectedPrinterName ? "bg-emerald-50/70 border-emerald-200 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-700"
        )}>
          <div className="flex items-center gap-2.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", connectedPrinterName ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estado actual</div>
              <div className="text-xs font-black truncate max-w-[170px]">{connectedPrinterName || "Sin conexión activa"}</div>
            </div>
          </div>
          {connectedPrinterName && (
            <button 
              onClick={async () => {
                const { disconnectPrinter, disconnectBluetoothPrinter } = await import('../lib/escpos');
                await disconnectPrinter();
                await disconnectBluetoothPrinter();
                onPrinterConnectedChange(null);
                onSuccess("Impresora desconectada");
                setTimeout(() => onSuccess(""), 2000);
              }}
              className="px-2.5 py-1 bg-white border border-rose-200 text-rose-600 rounded-lg text-[10px] font-black uppercase hover:bg-rose-50 transition-all"
            >
              Desconectar
            </button>
          )}
        </div>

        {printerStatusMsg && (
          <p className="text-[10px] font-bold text-indigo-600 text-center animate-pulse">{printerStatusMsg}</p>
        )}

        {/* Connection Actions */}
        <div className="space-y-2">
          <button
            type="button"
            disabled={isConnectingPrinter}
            onClick={onPairBluetooth}
            className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all shadow-md shadow-indigo-100 active:scale-95 disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <Bluetooth className="w-4 h-4 text-indigo-200" />
              <span>1. Vincular por Bluetooth</span>
            </div>
            <span className="text-[9px] bg-indigo-500/50 px-2 py-0.5 rounded-md text-indigo-100">BLE / Inalámbrico</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const { printThermalReceipt } = await import('../lib/escpos');
              await printThermalReceipt({
                lines: [
                  "CENTER|BOLD|MARÉ POS",
                  "CENTER|PRUEBA RAWBT ANDROID",
                  "---",
                  "Conexión exitosa con RawBT",
                  "Impresión térmica 58mm OK",
                  "---"
                ],
                width: '58mm',
                preferRawBT: true
              });
              onClose();
            }}
            className="w-full p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all shadow-md shadow-emerald-100 active:scale-95"
          >
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-emerald-200" />
              <span>2. Imprimir con App RawBT</span>
            </div>
            <span className="text-[9px] bg-emerald-500/50 px-2 py-0.5 rounded-md text-emerald-100">Android</span>
          </button>

          <button
            type="button"
            disabled={isConnectingPrinter}
            onClick={onConnectUsb}
            className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all active:scale-95 disabled:opacity-50 border border-slate-200"
          >
            <div className="flex items-center gap-2.5">
              <Usb className="w-4 h-4 text-slate-500" />
              <span>3. Conectar por Cable USB</span>
            </div>
            <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded-md text-slate-600">Cable OTG</span>
          </button>
        </div>

        {/* Test Ticket */}
        <div className="pt-2 border-t border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              const { printThermalReceipt } = await import('../lib/escpos');
              const printed = await printThermalReceipt({
                lines: [
                  "CENTER|BOLD|MARÉ POS",
                  "CENTER|TICKET DE PRUEBA 58MM",
                  "---",
                  `Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                  "Estado: Correcto",
                  "---",
                  "CENTER|Impresión Térmica OK"
                ],
                openDrawer: true,
                width: '58mm',
                onSuccess: (method) => {
                  onSuccess(`Prueba enviada (${method})`);
                  setTimeout(() => onSuccess(""), 2500);
                }
              });
              if (!printed) {
                onError("No hay impresora conectada");
                setTimeout(() => onError(""), 3000);
              }
            }}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Prueba
          </button>

          <button
            type="button"
            onClick={() => onClose()}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all active:scale-95"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
