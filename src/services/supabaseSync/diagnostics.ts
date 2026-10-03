import { getSupabase, getSupabaseCredentials } from '../../lib/supabase';
import { getActiveTenant } from '../tenant';
import { pullAllFromSupabase } from './pull';
import type { SyncResult } from './core';

export interface TableTestResult {
  table:string; label:string; status:'ok'|'warning'|'error'; message:string; count:number; canRead:boolean; canWrite:boolean;
}
export interface SupabaseDiagnosticReport {
  connected:boolean; url:string; companyId?:string; tables:TableTestResult[]; summary:string; timestamp:string;
}

const TABLES=[
  ['companies','Empresa'],['company_memberships','Membresía'],['warehouses','Almacenes'],['employees','Empleados'],
  ['employee_warehouse_access','Acceso a almacenes'],['categories','Categorías'],['products','Productos'],
  ['stock_balances','Stock'],['sales','Ventas'],['cash_sessions','Cajas/turnos'],['customers','Clientes'],
  ['suppliers','Proveedores'],['bank_accounts','Cuentas bancarias'],['company_catalogs','Configuración'],
  ['subscriptions','Suscripción'],['plans','Planes']
] as const;

export async function testSupabaseTables():Promise<SupabaseDiagnosticReport>{
  const supabase=getSupabase();const {url}=getSupabaseCredentials();
  if(!supabase)return {connected:false,url,tables:[],summary:'Cliente Supabase no configurado.',timestamp:new Date().toISOString()};
  try{
    const tenant=await getActiveTenant();
    const results:TableTestResult[]=[];
    for(const [table,label] of TABLES){
      try{
        let query:any=supabase.from(table).select('*',{count:'exact',head:false}).limit(5);
        if(['warehouses','employees','employee_warehouse_access','categories','products','stock_balances','sales','cash_sessions','customers','suppliers','bank_accounts','company_catalogs','subscriptions'].includes(table))query=query.eq('company_id',tenant.companyId);
        const {data,count,error}=await query;
        if(error)results.push({table,label,status:'error',message:error.message,count:0,canRead:false,canWrite:false});
        else results.push({table,label,status:'ok',message:'Lectura correcta.',count:count??data?.length??0,canRead:true,canWrite:false});
      }catch(e:any){results.push({table,label,status:'error',message:e?.message||String(e),count:0,canRead:false,canWrite:false});}
    }
    const ok=results.filter(x=>x.status==='ok').length;
    return {connected:true,url,companyId:tenant.companyId,tables:results,summary:ok+' de '+results.length+' recursos canónicos accesibles.',timestamp:new Date().toISOString()};
  }catch(e:any){return {connected:true,url,tables:[],summary:e?.message||'No hay empresa activa.',timestamp:new Date().toISOString()};}
}

export async function pushAllToSupabase(_isFull:boolean=false):Promise<{success:boolean;pushed:Record<string,number>;errors:string[]}>{
  try{
    const pulled=await pullAllFromSupabase();
    if(!pulled.result.success)return {success:false,pushed:{},errors:pulled.result.errors||[pulled.result.message]};
    return {success:true,pushed:pulled.result.counts||{},errors:[]};
  }catch(e:any){return {success:false,pushed:{},errors:[e?.message||String(e)]};}
}
