import type { SupabaseClient } from '@supabase/supabase-js';

export interface SyncResult {
  success: boolean;
  message: string;
  counts?: Record<string, number>;
  errors?: string[];
}

export async function fetchAllRows(
  supabase: SupabaseClient,
  table: string,
  orderColumn: string = 'created_at',
  pageSize: number = 1000
): Promise<any[]> {
  const rows:any[] = [];
  for(let from=0;;from+=pageSize){
    const {data,error}=await supabase.from(table).select('*').order(orderColumn,{ascending:false}).range(from,from+pageSize-1);
    if(error)throw error;
    if(!data?.length)break;
    rows.push(...data);
    if(data.length<pageSize)break;
  }
  return rows;
}

export async function safeUpsert(
  supabase: SupabaseClient,
  table: string,
  row: Record<string, any>,
  options?: {onConflict?: string; ignoreDuplicates?: boolean}
): Promise<{data:any;error:any}> {
  return supabase.from(table).upsert(row,options as any);
}

export async function safeUpsertMany(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, any>[],
  options?: {onConflict?: string; ignoreDuplicates?: boolean}
): Promise<{success:boolean;error?:any;errors?:string[];processed?:number;failed?:number}> {
  if(!rows.length)return {success:true,processed:0,failed:0};
  const {error}=await supabase.from(table).upsert(rows,options as any);
  if(!error)return {success:true,processed:rows.length,failed:0};
  return {success:false,error,errors:[error.message||String(error)],processed:0,failed:rows.length};
}
