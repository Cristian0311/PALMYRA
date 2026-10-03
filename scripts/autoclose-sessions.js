import { createClient } from '@supabase/supabase-js';

// Reemplazar con credenciales de entorno o pasarlas por consola
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mszojsqwilfqqcaycxch.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zem9qc3F3aWxmcXFjYXljeGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzkzODksImV4cCI6MjA5ODQxNTM4OX0.BSdhqmNwEMT5exDnu7H_gY_TSLSgzy1Cs4V2V2gSnvc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function autoCloseOldSessions() {
  console.log("Iniciando revisión de cajas abiertas...");
  try {
    const today = new Date().toDateString();
    
    // 1. Obtener cajas abiertas
    const { data: openSessions, error: sessionErr } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('status', 'open');
      
    if (sessionErr) throw sessionErr;
    
    const oldSessions = openSessions.filter(s => new Date(s.opened_at).toDateString() !== today);
    
    if (oldSessions.length === 0) {
      console.log("No hay cajas antiguas abiertas para cerrar.");
      return;
    }
    
    console.log(`Se encontraron ${oldSessions.length} caja(s) de días anteriores abiertas.`);

    // 2. Obtener datos necesarios
    const { data: settings } = await supabase.from('settings').select('*').eq('id', 'global').single();
    const currencies = settings?.currencies || [];
    const baseCurrency = currencies.find(c => c.isBase) || { code: 'CUP', rateToBase: 1 };
    
    for (const session of oldSessions) {
      console.log(`\nProcesando cierre de caja: ${session.id} (Abierta el: ${session.opened_at})`);
      
      // Obtener transacciones de la caja
      const { data: txs } = await supabase
        .from('transactions')
        .select('*, transaction_payments(*), transaction_items(*)')
        .eq('branch_id', session.branch_id)
        .eq('user_id', session.user_id)
        .gte('date', session.opened_at);
        
      // Obtener movimientos de la caja
      const { data: movements } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('session_id', session.id);
        
      // Calcular saldo esperado
      let expected = [
        { currencyCode: baseCurrency.code, amount: Number(session.opening_balance) || 0, exchangeRate: 1, method: 'cash' }
      ];
      
      const sessionTxs = txs || [];
      
      for (const tx of sessionTxs) {
        for (const p of tx.transaction_payments) {
          const exItem = expected.find(e => e.currencyCode === p.currency_code && e.method === p.method);
          if (exItem) {
            exItem.amount += Number(p.amount);
          } else {
            expected.push({ currencyCode: p.currency_code, amount: Number(p.amount), exchangeRate: Number(p.exchange_rate), method: p.method });
          }
        }
      }
      
      const sessionMovements = movements || [];
      for (const m of sessionMovements) {
        const exItem = expected.find(e => e.currencyCode === m.currency_code && e.method === 'cash');
        const multiplier = m.type === 'income' ? 1 : -1;
        if (exItem) {
          exItem.amount += (Number(m.amount) * multiplier);
        } else {
          const currency = currencies.find(c => c.code === m.currency_code);
          expected.push({ currencyCode: m.currency_code, amount: Number(m.amount) * multiplier, exchangeRate: currency?.rateToBase || 1, method: 'cash' });
        }
      }

      // Actualizar a estado cerrado en Supabase
      const { error: updateErr } = await supabase
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', session.id);
        
      if (updateErr) {
        console.error(`Error cerrando sesión ${session.id}:`, updateErr);
      } else {
        console.log(`✅ Caja ${session.id} cerrada automáticamente con éxito.`);
      }
    }
    
    console.log("\nProceso finalizado.");
    
  } catch (error) {
    console.error("Error crítico en script:", error);
  }
}

autoCloseOldSessions();
