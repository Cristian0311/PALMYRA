import React, { useState } from "react";
import { Shield, UserPlus, DollarSign, X, Eye, Calculator, Package, Clock, MapPin, Target, Edit2, Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";
import { User, CashRegisterSession, Transaction } from "../types";
import { InfoTooltip } from "../components/InfoTooltip";
import { cn } from "../lib/utils";

export default function Users() {
  const { users, transactions, getBaseCurrency, addUser, updateUser, deleteUser, cashSessions, branches, currencies, salarySettlements, updateSalarySettlement } = useStore();
  const baseCurrency = getBaseCurrency();
  const [showAddModal, setShowAddModal] = useState(false);
  const [auditingUser, setAuditingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<Partial<User>>({
    name: "",
    email: "",
    password: "",
    role: "employee",
    baseSalary: 0,
    salesGoal: 0,
    commissionRate: 0,
    phone: "",
    branchId: ""
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter(t => t.date.startsWith(todayStr) && t.status === 'completed');

  const formatMoney = (amount: number, code: string = baseCurrency.code) => {
    const symbol = currencies.find(c => c.code === code)?.symbol || baseCurrency.symbol;
    const formatted = amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUser(editingUser.id, formData);
    } else {
      addUser({
        ...formData,
        id: crypto.randomUUID()
      } as User);
    }
    setShowAddModal(false);
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "employee", baseSalary: 0, salesGoal: 0, commissionRate: 0, phone: "", branchId: "" });
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "employee", baseSalary: 0, salesGoal: 0, commissionRate: 0, phone: "", branchId: "" });
    setShowAddModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData(user);
    setShowAddModal(true);
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm("¿Está seguro de eliminar este empleado? Esta acción no se puede deshacer.")) {
      deleteUser(id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
            Empleados
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accesos y Comisiones</p>
        </div>
        <button 
          onClick={openAddModal} 
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Añadir Empleado
        </button>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empleado</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol / Sucursal</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salario (Día)</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Meta Ventas</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas Hoy</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comisión Hoy</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pago Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const userTx = todayTransactions.filter(t => t.userId === user.id);
                const totalVentas = userTx.reduce((sum, t) => sum + t.total, 0);
                
                const branchTx = user.role === 'employee' && user.branchId 
                  ? todayTransactions.filter(t => t.branchId === user.branchId)
                  : userTx;

                const comision = branchTx.reduce((sum, t) => {
                  const branchEmployees = users.filter(u => u.branchId === t.branchId && u.role === 'employee').length;
                  const splitFactor = branchEmployees > 0 ? branchEmployees : 1;

                  const txComission = t.items.reduce((itemSum, item) => {
                    const p = item.product;
                    let itemComm = 0;
                    if (p.commissionType === 'fixed') {
                      itemComm = (p.commissionValue || 0) * item.quantity;
                    } else {
                      itemComm = (p.price * ((p.commissionValue || 0) / 100)) * item.quantity;
                    }
                    // Si el usuario es empleado, obtiene su parte de la comisión de la sucursal
                    // Si es admin, obtiene su comisión completa de sus propias ventas
                    return itemSum + (user.role === 'employee' ? (itemComm / splitFactor) : itemComm);
                  }, 0);
                  return sum + txComission;
                }, 0);

                const pagoTotalHoy = (user.baseSalary || 0) + comision;
                const goalProgress = user.salesGoal && user.salesGoal > 0 ? (totalVentas / user.salesGoal) * 100 : 0;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs uppercase">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 uppercase tracking-tighter">{user.name}</span>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                          user.role === 'admin' ? "bg-slate-900 text-white" : "bg-blue-100 text-blue-700"
                        )}>
                          {user.role === 'employee' ? 'Empleado' : 'Admin'}
                        </span>
                        {user.branchId && (
                          <span className="text-[7px] font-black text-indigo-500 uppercase flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" />
                            {branches.find(b => b.id === user.branchId)?.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900 text-xs">
                      {formatMoney(user.baseSalary || 0)}
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase">{formatMoney(user.salesGoal || 0)}</span>
                          <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-1000",
                                goalProgress >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                              )}
                              style={{ width: `${Math.min(goalProgress, 100)}%` }}
                            />
                          </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900 text-xs">{formatMoney(totalVentas)}</td>
                    <td className="px-6 py-4 font-black text-emerald-600 text-xs">{formatMoney(comision)}</td>
                    <td className="px-6 py-4 font-black text-indigo-600 text-xs">
                      {formatMoney(pagoTotalHoy)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setAuditingUser(user)}
                          title="Auditoría"
                          className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-100 shadow-sm"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditUser(user)}
                          title="Editar"
                          className="p-2 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-slate-100 shadow-sm"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {user.role !== 'admin' && (
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            title="Eliminar"
                            className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-100 shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {auditingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 border border-white/20 flex flex-col max-h-[90vh]">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Reportes de {auditingUser.name}</h3>
                  <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-tight">Auditoría de turnos y ventas</p>
                </div>
              </div>
              <button onClick={() => setAuditingUser(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <DollarSign className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Historial de Liquidaciones</h4>
                </div>
                {salarySettlements.filter(s => s.userId === auditingUser.id).length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No hay liquidaciones registradas</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {salarySettlements
                      .filter(s => s.userId === auditingUser.id)
                      .map(settlement => (
                        <div key={settlement.id} className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between hover:border-indigo-100 transition-colors group">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => updateSalarySettlement(settlement.id, { status: settlement.status === 'paid' ? 'waiting' : 'paid' })}
                              className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105",
                                settlement.status === 'paid' ? "bg-emerald-50 text-emerald-600" : 
                                settlement.status === 'cancelled' ? "bg-rose-50 text-rose-600" : 
                                settlement.status === 'waiting' ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                              )}
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">
                                {formatMoney(settlement.total)}
                              </p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">
                                {new Date(settlement.date).toLocaleDateString()} • {settlement.status}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Sueldo + Comis</p>
                            <p className="text-[9px] font-bold text-slate-500">
                              {formatMoney(settlement.baseSalary)} + {formatMoney(settlement.commissions)}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Historial de Turnos</h4>
                </div>
                {cashSessions.filter(s => s.userId === auditingUser.id).length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No hay turnos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cashSessions
                      .filter(s => s.userId === auditingUser.id)
                      .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
                      .map(session => (
                        <div key={session.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                          <div className="bg-slate-50 p-4 flex justify-between items-center">
                            <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Turno #{session.id.slice(-6)}</p>
                              <p className="text-[8px] font-black text-slate-400 uppercase">
                                {new Date(session.openedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                              session.status === 'open' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                            )}>
                              {session.status === 'open' ? 'Abierto' : 'Cerrado'}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">{editingUser ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
              <button onClick={() => {
                setShowAddModal(false);
                setEditingUser(null);
              }} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar max-h-[70vh]">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Completo</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email / Usuario</label>
                    <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</label>
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contraseña</label>
                  <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rol</label>
                    <select required value={formData.role} onChange={e => {
                      const role = e.target.value as 'admin'|'employee';
                      setFormData({...formData, role});
                    }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold">
                      <option value="employee">Empleado</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sucursal</label>
                    <select required={formData.role === 'employee'} value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold">
                      {formData.role === 'admin' && <option value="">Todas las sucursales</option>}
                      {formData.role === 'employee' && <option value="">Seleccione una sucursal</option>}
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Salario (Día)
                      </label>
                      <input type="number" required value={formData.baseSalary} onChange={e => setFormData({...formData, baseSalary: parseFloat(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Target className="w-3 h-3" /> Meta Ventas
                      </label>
                      <input type="number" required value={formData.salesGoal} onChange={e => setFormData({...formData, salesGoal: parseFloat(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold" />
                    </div>
                  </div>
              </div>
              
              <button type="submit" className="w-full mt-6 bg-indigo-600 text-white font-black uppercase tracking-widest py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 active:scale-95 text-[10px]">
                {editingUser ? 'Actualizar Empleado' : 'Guardar Empleado'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
