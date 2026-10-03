/**
 * Normaliza una cadena de texto para comparación semántica:
 * - Elimina acentos y diacríticos (ej: almacén -> almacen)
 * - Convierte a minúsculas
 * - Elimina espacios en blanco superfluos al inicio, final y entre palabras
 */
export function normalizeSemanticText(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Comprueba si dos cadenas son semánticamente equivalentes
 */
export function areSemanticallyEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeSemanticText(a) === normalizeSemanticText(b);
}
