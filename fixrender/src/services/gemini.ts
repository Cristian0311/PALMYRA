export async function getBusinessSummaryAI(data: {
  salesToday: number;
  txCountToday: number;
  lowStockCount: number;
  topCategories: { name: string; value: number }[];
  baseCurrency: string;
}) {
  try {
    const response = await fetch('/api/ai-business-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.success) {
      return result.summary;
    } else {
      console.error("AI Error:", result.error);
      return "No se pudo generar el análisis por IA en este momento.";
    }
  } catch (error) {
    console.error("AI Error:", error);
    return "No se pudo generar el análisis por IA en este momento.";
  }
}
