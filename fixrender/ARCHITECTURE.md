# OmniSync POS — arquitectura estabilizada

## Regla principal

Las operaciones que cambian inventario tienen una sola autoridad por modo:

- **Online:** UI → RPC transaccional Supabase → commit → espejo local.
- **Offline:** UI → estado local + cola idempotente → RPC al recuperar conexión → reconciliación.

El cliente ya no realiza un descuento local y después otro descuento equivalente en el servidor para una misma venta.

## Operaciones críticas

| Operación | Autoridad | Idempotencia | Movimiento de inventario |
|---|---|---|---|
| Venta | `process_pos_transaction_v2` | ID de venta | `SALE` / `KIT_CONSUMPTION` |
| Anulación | `void_pos_transaction_v2` | ID de venta | `VOID_RETURN` / `KIT_RETURN` |
| Devolución | `complete_return_v2` | ID de devolución | `RETURN` / reemplazo de garantía |
| Transferencia | `process_inventory_transfer_v2` | `operation_id` | `TRANSFER_OUT` + `TRANSFER_IN` |
| Recepción proveedor | `receive_supplier_order_v2` | ID de orden | `PURCHASE` |
| Auditoría física | `complete_inventory_audit_v2` | ID de auditoría | `AUDIT` |
| Apertura caja | `open_cash_session_v2` | bloqueo por sucursal | — |
| Cierre caja | `close_cash_session_v2` | `session_id` | — |

## Inventario

`inventory` representa el estado actual. `inventory_movements` representa el historial de cambios. Las cantidades críticas se validan y bloquean en PostgreSQL antes de modificarse.

Las variantes se normalizan a `''` en vez de mezclar `NULL` y cadena vacía.

## Kits

Los productos kit conservan `kit_components`. Una venta de kit consume componentes; una anulación revierte componentes. El kit no se trata como una unidad de inventario independiente cuando sus componentes son los que realmente representan stock.

## Sincronización

Se eliminó el límite artificial de 500 ventas/movimientos y se usa paginación de 1000 registros. El estado local se conserva solo cuando existe una operación pendiente en la cola; no se reintroducen automáticamente registros antiguos que ya no existen en Supabase.

## Cola offline

Estados: `pending`, `failed`, `conflict`. Una operación con cinco fallos consecutivos deja de reintentarse indefinidamente y se marca para revisión. Las operaciones críticas conservan su identificador de operación.

## Sucursales

La sincronización identifica sucursales por ID, no por nombre. Esto evita que dos almacenes legítimos con el mismo nombre sean fusionados silenciosamente.

La migración genera `duplicate_branch_candidates` y `branch_usage_audit` para revisar duplicados antes de eliminar o migrar cualquiera.

## Organización

Se mantienen las páginas grandes existentes para minimizar el riesgo de una refactorización visual masiva, pero las responsabilidades críticas están separadas en:

- `src/services/supabaseSync.ts`: transporte/sincronización y RPC wrappers.
- `src/services/offlineSync.ts`: cola y reintentos.
- `src/store/useStore.ts`: estado de UI y espejo local.
- `SUPABASE_MIGRATION.sql`: única migración canónica de Supabase; `update-schema.sql` y `HOTFIX_OFFLINE_FIRST.sql` quedan deprecated para evitar drift.
- `scripts/integrity-smoke.mjs`: comprobaciones automatizadas de invariantes críticas.

La siguiente división natural de los archivos grandes sería extraer dominios de POS, Reportes y Store en módulos separados, pero se evita hacerlo durante esta reparación para no introducir cambios visuales o de comportamiento innecesarios.
