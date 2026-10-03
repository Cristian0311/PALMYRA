import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { useStore } from '../store/useStore';

export const TransferHistory = () => {
  const { transfers, products, branches, categories } = useStore(useShallow((state) => ({ transfers: state.transfers, products: state.products, branches: state.branches, categories: state.categories })));
  const sortedTransfers = [...transfers].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Historial de Traslados</h3>
        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{transfers.length} Registros</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Origen</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cantidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTransfers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <p className="text-sm font-bold text-slate-400">No hay traslados registrados.</p>
                </td>
              </tr>
            ) : sortedTransfers.map(t => {
                const product = products.find(p => p.id === t.productId);
                const fromBranch = branches.find(b => b.id === t.fromBranchId)?.name || 'Desconocida';
                const toBranch = branches.find(b => b.id === t.toBranchId)?.name || 'Desconocida';
                
                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {new Date(t.date).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-black text-slate-900 uppercase">{product?.name || 'Producto Eliminado'}</p>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase">
                      {fromBranch}
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase">
                      {toBranch}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="bg-slate-100 text-slate-900 px-2 py-1 rounded text-[10px] font-black">
                        {t.quantity} UNID.
                      </span>
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
