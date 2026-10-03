# Flujo E2E de prueba — Cola Offline Fase 18

## Objetivo
Validar el ciclo crítico del POS:

**offline → crear venta → persistir cola → reconectar → enviar → confirmar Supabase → repetir sincronización → no duplicar → inventario correcto**.

También se incluyen pruebas de transferencia e IDN.

## Resultado ejecutado

### 1. Venta offline / posterior sincronización
- Operación de prueba: `E2E-OFFLINE-20260926-004`
- Producto: `Cocina Electrica`
- Sucursal: `VENTA ELIER`
- Stock inicial: `3`
- RPC de sincronización: `process_pos_transaction_v2`
- Primera ejecución: `success=true`
- Stock después: `2`
- Delta: `-1`
- Transacciones creadas: `1`
- Reintento con el mismo ID: `already_existed=true`
- Stock después del reintento: no vuelve a bajar
- La transacción completa fue ejecutada dentro de `BEGIN ... ROLLBACK`, por lo que no modificó datos reales.

### 2. Transferencia offline / posterior sincronización
- Operación: `E2E-OFFLINE-TRANSFER-001`
- Origen: `VENTA ELIER`
- Destino: `VENTA WENDY`
- Producto: `Cocina Electrica`
- Primera ejecución: `success=true`
- Origen: `3 → 2`
- Destino: se creó/recibió `1`
- Reintento: `already_existed=true`
- Movimientos registrados: `2`
- Prueba revertida con `ROLLBACK`.

### 3. Liquidación IDN
- Operación: `E2E-IDN-SETTLEMENT-002`
- La transacción con `notes='LIQUIDACION_IDN'` se registra sin consumir inventario.
- Stock: `3 → 3`
- Transacciones: `1`
- Prueba revertida con `ROLLBACK`.

## Validación adicional de cierre de turno
`close_cash_session_v2` fue comprobado como idempotente:
- segunda ejecución sobre un turno ya cerrado devuelve `already_closed=true`;
- no crea otra liquidación;
- no usa la columna inexistente `discrepancy_deduction`.

## Prueba física pendiente
El ciclo que requiere navegador/dispositivo real debe ejecutarse en tablet:

1. Abrir POS online.
2. Abrir turno.
3. Anotar stock del producto.
4. Desactivar Wi-Fi/datos.
5. Realizar una venta.
6. Verificar que la venta aparece en cola y que el stock local baja una sola vez.
7. Cerrar/reabrir la app sin conexión y verificar que la cola permanece.
8. Restaurar internet.
9. Ejecutar sincronización automática o manual según configuración.
10. Verificar cola = 0.
11. Verificar en Supabase que existe exactamente una transacción.
12. Verificar inventario remoto: stock inicial - cantidad vendida.
13. Recargar la aplicación y sincronizar nuevamente.
14. Confirmar que no se crea una segunda transacción ni se descuenta inventario otra vez.
15. Repetir con vendedor IDN.
16. Repetir con una transferencia origen → destino.
17. Probar cierre de turno offline → reconexión y comprobar una sola liquidación.

## Criterio de aprobación
El flujo se considera aprobado si cada operación cumple simultáneamente:
- sobrevive a la pérdida de red;
- permanece en IndexedDB/localStorage hasta confirmación;
- se confirma en Supabase antes de retirarse de la cola;
- puede reintentarse sin duplicar datos ni movimientos;
- deja inventario coherente;
- después de recargar la aplicación, la cola conserva o refleja correctamente su estado.
