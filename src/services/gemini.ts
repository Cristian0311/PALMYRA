export async function getBusinessSummaryAI(data: {
  salesToday: number;
  txCountToday: number;
  lowStockCount: number;
  topCategories: { name: string; value: number }[];
  baseCurrency: string;
}) {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ai-business-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    if (!response.ok) {
      console.error('AI Error: HTTP', response.status, raw.slice(0, 500));
      return 'No se pudo generar el análisis por IA en este momento.';
    }

    if (!contentType.toLowerCase().includes('application/json')) {
      console.error('AI Error: respuesta no JSON', raw.slice(0, 500));
      return 'El servicio de análisis por IA no está disponible todavía.';
    }

    let result: { success?: boolean; summary?: string; error?: string };
    try {
      result = JSON.parse(raw);
    } catch (parseError) {
      console.error('AI Error: JSON inválido', parseError);
      return 'El servicio de análisis por IA devolvió una respuesta inválida.';
    }

    if (result.success) {
      return result.summary || 'Análisis de IA completado sin resumen.';
    }

    console.error('AI Error:', result.error);
    return 'No se pudo generar el análisis por IA en este momento.';
  } catch (error) {
    console.error('AI Error:', error);
    return 'No se pudo generar el análisis por IA en este momento.';
  }
}
