import React, { useState } from 'react';
import { FileText, Search, Plus, Filter, FileCheck, CheckCircle2, Copy, HelpCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatMoney } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { InfoTooltip } from '../components/InfoTooltip';

export default function Quotes() {
  const { quotes, currentUser, customers, getBaseCurrency } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'converted' | 'expired'>('all');
  const navigate = useNavigate();

  const baseCurrency = getBaseCurrency();

  const filteredQuotes = quotes.filter(quote => {
    const customer = customers.find(c => c.id === quote.customerId);
    const matchesSearch = 
      quote.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer?.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleConvertToSale = (quote: any) => {
    navigate(`/pos?loadQuote=${quote.id}`);
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <FileText className="w-8 h-8 text-indigo-600" />
                Cotizaciones
              </h1>
              <InfoTooltip text="Crea y gestiona presupuestos para tus clientes. Las cotizaciones pueden convertirse en ventas reales desde el Punto de Venta." position="bottom" />
            </div>
          
          <button 
            onClick={() => navigate('/pos?mode=quote')}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Nueva Cotización
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por ID o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            {['all', 'pending', 'converted', 'expired'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                  statusFilter === status 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status === 'all' ? 'Todas' : 
                 status === 'pending' ? 'Pendientes' : 
                 status === 'converted' ? 'Convertidas' : 'Expiradas'}
              </button>
            ))}
          </div>
        </div>

        {/* Quote List */}
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Cotización</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Total</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map((quote) => {
                  const customer = customers.find(c => c.id === quote.customerId);
                  return (
                    <tr key={quote.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{quote.id.slice(0, 8).toUpperCase()}</p>
                            <p className="text-xs text-slate-500">{quote.items.length} artículos</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-medium text-slate-900">{customer?.name || 'Consumidor Final'}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-slate-600">
                          {new Date(quote.date).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          quote.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          quote.status === 'converted' ? 'bg-green-100 text-green-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {quote.status === 'pending' && 'Pendiente'}
                          {quote.status === 'converted' && 'Convertida'}
                          {quote.status === 'expired' && 'Expirada'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <p className="text-sm font-black text-slate-900">
                          {formatMoney(quote.total, baseCurrency.symbol)}
                        </p>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleConvertToSale(quote)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Cargar en TPV"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredQuotes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500">
                      No se encontraron cotizaciones.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
