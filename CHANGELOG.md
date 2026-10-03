# CHANGELOG — OmniSync POS estable

## Estabilización integral

- Corregido el doble descuento de inventario en ventas online.
- Ventas online confirmadas por RPC antes de actualizar el espejo local.
- Ventas offline conservan el mismo ID para reintentos idempotentes.
- Eliminado el fallback de venta que hacía `upsert` directo y podía omitir el movimiento de stock.
- Kits soportan consumo real de componentes en servidor.
- Anulación de venta usa RPC y revierte los movimientos originales, incluidos componentes de kits.
- Devoluciones validan acumulado contra lo realmente vendido.
- Garantías ya no descuentan incorrectamente el producto devuelto; un reemplazo se descuenta explícitamente cuando existe.
- Transferencias usan operación idempotente y transacción server-side.
- Recepción de proveedores solo aplica stock en transición `PENDING → RECEIVED`.
- Auditorías de inventario solo se completan una vez y el servidor calcula `actual - esperado`.
- Apertura de caja protegida contra dos turnos abiertos en la misma sucursal.
- Cierre de caja evita liquidaciones de salario duplicadas.
- Inventario normaliza variantes y consolida duplicados lógicos conservando la suma de cantidades.
- Añadido historial `inventory_movements`.
- Añadida columna persistente `products.kit_components`.
- Eliminada la sustitución silenciosa de sucursales/categorías/IDs inválidos en `safeUpsert`.
- Eliminado el borrado físico de transacciones desde `deleteTransactionFromSupabase`.
- Eliminado el límite de 500 registros para transacciones, bancos y turnos mediante paginación.
- Sincronización de transacciones/cajas/devoluciones deja de resucitar registros locales que no están en Supabase salvo operaciones pendientes reales.
- La caché del dispositivo ya no borra la cola offline ni el respaldo local de ventas al ejecutar un hard reset.
- Los pagos bancarios de una venta se registran después de confirmar la venta.
- Añadidas vistas de diagnóstico de sucursales duplicadas y uso por sucursal.

## Validación

- Los 37 archivos TypeScript/TSX fueron analizados por parser de TypeScript sin errores de sintaxis.
- `scripts/integrity-smoke.mjs` pasa todas las invariantes críticas.
- La compilación completa no pudo ejecutarse en este entorno porque las dependencias del proyecto no están instaladas y el entorno no tiene acceso al registro npm. El código sí fue sometido a comprobación sintáctica independiente.

## Restauración offline-first — 2026-09-26
- Persistencia principal migrada a IndexedDB con escrituras agrupadas.
- Cola offline serializada y protegida contra sobrescrituras concurrentes.
- Bootstrap POS ligero por sucursal.
- Realtime reducido a inventario/transacciones y actualización directa del caché de inventario.
- Ajustes de inventario convertidos a operaciones idempotentes.
- Reconciliación de inventario protegida contra cambios remotos.
- RPC de ventas agregada por SKU/variante y locks deterministas.
- Bulk "Guardar Datos Maestros" dejó de sobrescribir stock y ventas.
- Recuperación de ventas desde backup usa RPC idempotente.
- POS usa selectores shallow para reducir renders globales.
