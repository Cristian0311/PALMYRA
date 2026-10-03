# Sistema de Punto de Venta (POS) y Gestión Integral - Arquitectura Completa y Hoja de Ruta

Este documento detalla la estructura completa, módulos faltantes, arquitectura técnica y la hoja de ruta paso a paso para construir el sistema OmniPOS, inspirado en Loyverse pero adaptado para web, móvil, PC y con capacidades offline avanzadas.

## 1. El Catálogo QR Offline (PWA) - Arquitectura Detallada

El requerimiento clave es que el cliente escanee un QR y pueda ver el catálogo sin internet. Esto se logra convirtiendo la vista del cliente en una **PWA (Progressive Web App)** con capacidades "Offline-First".

### Flujo Técnico:
1. **Primer Escaneo (Requiere Internet mínimo):** El cliente escanea el QR en su mesa o en la entrada. Se carga la página web (Ej: `omnipos.com/catalog/sucursal-1`).
2. **Instalación Silenciosa (Service Workers):** En segundo plano, un `Service Worker` descarga y guarda en la caché del navegador los archivos estructurales (HTML, CSS, JS, imágenes base).
3. **Almacenamiento de Datos (IndexedDB):** El catálogo de productos (nombres, precios, fotos, descripciones) se guarda en la base de datos local del navegador (`IndexedDB`).
4. **Desconexión (Offline):** Si el cliente pierde la conexión o pone modo avión, la PWA intercepta las peticiones de red y sirve los datos directamente desde la caché y `IndexedDB`. La navegación es instantánea.
5. **Pedidos desde la Mesa (Opcional):** Si el cliente arma un pedido sin internet, este se guarda en IndexedDB en una "Cola de sincronización". En cuanto recupera el internet, el Service Worker empuja el pedido al sistema POS del cajero.

## 2. Módulos Faltantes por Implementar (Estructura Completa)

Actualmente tenemos el esqueleto básico (Dashboard, POS, Inventario, Usuarios, Catálogo). Falta definir e implementar los siguientes módulos críticos:

### 2.1. Gestión de Caja y Turnos (Cash Management)
*   Apertura y Cierre de caja (Arqueo).
*   Registro de ingresos y egresos de efectivo (Pagos a proveedores menores, cambio/sencillo).
*   Manejo de diferencias de caja (Sobrantes/Faltantes).

### 2.2. Reportes y Analíticas (Business Intelligence)
*   Ventas por hora, día, semana, mes.
*   Productos más vendidos y menos rentables.
*   Márgenes de ganancia (Costo vs. Precio de Venta).
*   Reporte de ventas por empleado/cajero.
*   Reporte de impuestos recaudados.

### 2.3. Clientes y Fidelización (CRM)
*   Base de datos de clientes (Nombre, Email, Teléfono, Cumpleaños).
*   Historial de compras por cliente.
*   **Programa de Puntos:** Configuración de cuántos puntos se ganan por dólar/peso gastado y cómo se canjean.
*   Saldos a favor (Crédito en tienda).

### 2.4. Integración de Hardware
*   **Impresoras Térmicas:** Compatibilidad mediante WebBluetooth / WebUSB / WebHID o red local (ESC/POS) para imprimir tickets automáticamente.
*   **Lectores de Códigos de Barras:** Emulación de teclado en el POS para escaneo rápido.
*   **Cajones de Dinero:** Apertura automática al procesar pago en efectivo.

### 2.5. Facturación Electrónica e Impuestos
*   Cálculo de impuestos múltiples (IVA, IEPS, etc.) aplicables por producto o por ticket.
*   Módulo conectable para emitir facturas electrónicas según el país (con validación ante el ente fiscal de manera asíncrona).

### 2.6. Configuración Avanzada del Negocio
*   Configuración del recibo/ticket (Logo, mensaje de despedida, pie de página).
*   Gestión de métodos de pago (Efectivo, Tarjeta, Transferencia, Vales).
*   Gestión de variantes de producto (Tallas, Colores) y modificadores (Sin cebolla, Extra queso).

## 3. Arquitectura de Base de Datos (Estructura Relacional Ideal)

Para que el sistema sea robusto, la base de datos (Ej. PostgreSQL) debe estructurarse de la siguiente manera:

*   **`Empresas/Comercios`:** (Tenant) ID, Nombre, Configuración global.
*   **`Sucursales`:** ID, Empresa_ID, Nombre, Dirección, Zona Horaria.
*   **`Usuarios (Empleados)`:** ID, Nombre, Email, PIN de acceso al POS.
*   **`Roles_Permisos`:** Relación granular (Ej. El usuario X es "Gerente" en Sucursal A y no tiene acceso a Sucursal B).
*   **`Categorias` y `Productos`:** ID, Nombre, Precio_Base, Costo, Tipo (Físico, Servicio, Compuesto/Receta).
*   **`Variantes_Modificadores`:** Opciones extra de los productos.
*   **`Inventario_Stock`:** Producto_ID, Sucursal_ID, Cantidad_Disponible, Cantidad_Minima.
*   **`Traslados_Inventario`:** Origen_ID, Destino_ID, Estado (Pendiente, Enviado, Recibido), Items.
*   **`Ventas (Tickets)`:** ID, Sucursal_ID, Cajero_ID, Total, Impuestos, Metodo_Pago, Fecha.
*   **`Ventas_Items`:** Relación del ticket con los productos vendidos.
*   **`Clientes`:** ID, Nombre, Puntos_Acumulados.

## 4. Stack Tecnológico Seleccionado

*   **Frontend y PWA:** React 19, Vite, Tailwind CSS, Lucide React (Iconos).
*   **Estado Complejo (POS/Carrito):** Zustand o Redux Toolkit.
*   **Caché Offline:** `localforage` (Wrapper de IndexedDB) + `vite-plugin-pwa`.
*   **Generación QR:** `qrcode.react`.
*   **Backend & Base de Datos (A implementar luego):** Node.js/Express, PostgreSQL (usando Drizzle ORM).

## 5. Hoja de Ruta (Roadmap de Implementación Paso a Paso)

Para no saturar el código, desarrollaremos siguiendo estas fases:

*   **Fase 1: Estructura Local de Datos y Estado (Frontend)**
    *   Definir los modelos de datos en TypeScript.
    *   Crear el estado global (Zustand) para el Carrito del POS, la navegación y los datos simulados temporales de inventario y clientes.
*   **Fase 2: Perfeccionamiento del POS y Productos**
    *   Implementar modificadores/variantes al agregar al carrito.
    *   Lógica de cálculo de impuestos y descuentos.
    *   Módulo de manejo de métodos de pago y simulación de impresión de ticket.
*   **Fase 3: Módulo del Catálogo Offline (PWA)**
    *   Configurar Service Workers.
    *   Crear la vista de cliente que escanea el QR.
    *   Testear el almacenamiento en IndexedDB y modo sin conexión.
*   **Fase 4: Inventario Multisucursal Avanzado**
    *   Flujo de creación de traslados entre sucursales.
    *   Gestión de stock con trazabilidad (historial de movimientos).
*   **Fase 5: Módulos de Soporte (Clientes, Reportes, Empleados)**
    *   Creación de perfiles de clientes.
    *   Gráficos visuales en el Dashboard.
*   **Fase 6: Transición a Full-Stack (Backend Real)**
    *   Crear servidor Express, conectar a Base de Datos PostgreSQL real.
    *   Migrar toda la lógica del cliente al servidor y establecer autenticación JWT y sincronización offline/online real.
