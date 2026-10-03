import { getSupabase } from '../../lib/supabase';
import { getActiveTenant } from '../tenant';
import { normalizeSemanticText } from '../../utils/textUtils';

export async function cleanupCloudDuplicates() {
  const supabase=getSupabase();
  if(!supabase)return {success:false,message:'Supabase no configurado'};
  try{
    const {companyId}=await getActiveTenant();
    const report={deletedBranches:0,deletedCategories:0,deletedProducts:0};

    const {data:warehouses,error:we}=await supabase.from('warehouses').select('id,name,created_at').eq('company_id',companyId).order('created_at',{ascending:true});
    if(we)throw we;
    const seenW=new Map<string,string>();
    for(const w of warehouses||[]){
      const key=normalizeSemanticText(w.name);
      if(seenW.has(key)){
        const hasSales=(await supabase.from('sales').select('id',{head:true,count:'exact'}).eq('warehouse_id',w.id).eq('company_id',companyId)).count||0;
        const hasStock=(await supabase.from('stock_balances').select('warehouse_id',{head:true,count:'exact'}).eq('warehouse_id',w.id).eq('company_id',companyId)).count||0;
        if(hasSales===0&&hasStock===0){
          const {error}=await supabase.from('warehouses').update({active:false}).eq('id',w.id).eq('company_id',companyId);
          if(error)throw error;
          report.deletedBranches++;
        }
      }else seenW.set(key,w.id);
    }

    const {data:cats,error:ce}=await supabase.from('categories').select('id,name,created_at').eq('company_id',companyId).eq('active',true).order('created_at',{ascending:true});
    if(ce)throw ce;
    const seenC=new Map<string,string>();
    for(const cat of cats||[]){
      const key=normalizeSemanticText(cat.name);
      if(seenC.has(key)){
        const count=(await supabase.from('products').select('id',{head:true,count:'exact'}).eq('category_id',cat.id).eq('company_id',companyId).neq('status','archived')).count||0;
        if(count===0){
          const {error}=await supabase.from('categories').update({active:false}).eq('id',cat.id).eq('company_id',companyId);
          if(error)throw error;
          report.deletedCategories++;
        }
      }else seenC.set(key,cat.id);
    }

    const {data:products,error:pe}=await supabase.from('products').select('id,name,sku,created_at').eq('company_id',companyId).neq('status','archived').order('created_at',{ascending:true});
    if(pe)throw pe;
    const seenSku=new Map<string,string>(); const seenName=new Map<string,string>();
    for(const p of products||[]){
      const sku=p.sku?normalizeSemanticText(p.sku):'';
      const name=normalizeSemanticText(p.name);
      const duplicate=(sku&&seenSku.has(sku))||seenName.has(name);
      if(duplicate){
        const stock=(await supabase.from('stock_balances').select('warehouse_id',{head:true,count:'exact'}).eq('product_id',p.id).eq('company_id',companyId)).count||0;
        const sales=(await supabase.from('sale_items').select('id',{head:true,count:'exact'}).eq('product_id',p.id)).count||0;
        if(stock===0&&sales===0){
          const {error}=await supabase.from('products').update({status:'archived'}).eq('id',p.id).eq('company_id',companyId);
          if(error)throw error;
          report.deletedProducts++;
        }
      }else{
        if(sku)seenSku.set(sku,p.id);
        seenName.set(name,p.id);
      }
    }
    return {success:true,report};
  }catch(error:any){
    return {success:false,error:error?.message||String(error)};
  }
}
