# Optimización catálogo POS — Fase 4

## Objetivo
Aislar el catálogo/búsqueda de productos del render del carrito y pago.

## Cambios
- Se extrajo `POSCatalog` a `src/components/POSCatalog.tsx`.
- `POSCatalog` usa `React.memo`.
- El catálogo obtiene directamente del store `products`, `categories`, `inventory`, `currentBranchId` y `addToCart`.
- Búsqueda, debounce, categoría y mapa de stock viven dentro del catálogo.
- `POS.tsx` ya no mantiene el estado de búsqueda/categoría ni recalcula `filteredProducts` durante cambios del carrito.
- Los callbacks que recibe el catálogo son estables mediante `useCallback`, evitando invalidar `React.memo` en cada render del POS.
- La selección de un producto configurable sigue delegada al POS para conservar el modal existente.
- El lector físico, pagos y lógica de venta offline no fueron alterados.

## Efecto esperado
Cambios frecuentes en `cart` y pagos pueden volver a renderizar el POS padre, pero `POSCatalog` puede omitir ese render mientras no cambien sus propias suscripciones ni sus props.

## Verificación
- Se ejecutó TypeScript globalmente para detectar errores de sintaxis/semántica. El entorno no tiene `node_modules`, por lo que el resultado contiene errores de módulos faltantes y no constituye un build válido.
- El error `salarySettlements` ya estaba presente en la Fase 3 y no fue introducido por esta fase.
- Se debe ejecutar `npm ci` y después `npm run build` en un entorno con dependencias disponibles.
