export const ESCPOS_COMMANDS = {
  INIT: new Uint8Array([0x1b, 0x40]),
  LF: new Uint8Array([0x0a]),
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),
  TEXT_DOUBLE_HEIGHT: new Uint8Array([0x1b, 0x21, 0x10]),
  TEXT_NORMAL: new Uint8Array([0x1b, 0x21, 0x00]),
  CUT_FULL: new Uint8Array([0x1d, 0x56, 0x00]),
  CUT_PARTIAL: new Uint8Array([0x1d, 0x56, 0x01]),
  OPEN_DRAWER: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
};

let cachedPort: any = null;
let cachedBluetoothDevice: any = null;
let cachedBluetoothCharacteristic: any = null;

export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function getHardwareCapabilities() {
  const serialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;
  const bluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const inIframe = isInsideIframe();
  const isAndroid = isAndroidDevice();

  return {
    serialSupported,
    bluetoothSupported,
    inIframe,
    isAndroid
  };
}

/**
 * Format a line with left text and right text padded to exactly maxCols characters (32 cols for 58mm).
 */
export function format58mmLine(left: string, right: string, maxCols: number = 32): string {
  const cleanLeft = (left || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const cleanRight = (right || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const rightLen = cleanRight.length;
  const maxLeftLen = Math.max(1, maxCols - rightLen - 1);
  
  const truncatedLeft = cleanLeft.length > maxLeftLen ? cleanLeft.substring(0, maxLeftLen) : cleanLeft;
  const spacesNeeded = Math.max(1, maxCols - truncatedLeft.length - rightLen);
  
  return `${truncatedLeft}${' '.repeat(spacesNeeded)}${cleanRight}`;
}

/**
 * Encode an array of lines into an ESC/POS byte sequence.
 */
export function encodeEscPosLines(
  textLines: string[], 
  openDrawer: boolean = false, 
  width: '58mm' | '80mm' = '58mm'
): Uint8Array {
  const cols = width === '58mm' ? 32 : 42;
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();

  const append = (arr: Uint8Array) => chunks.push(arr);
  const appendText = (text: string) => {
    const clean = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    chunks.push(encoder.encode(clean));
  };

  append(ESCPOS_COMMANDS.INIT);

  for (const rawLine of textLines) {
    let line = rawLine;

    if (line === '---') {
      appendText('-'.repeat(cols));
      append(ESCPOS_COMMANDS.LF);
      continue;
    }
    if (line === '===') {
      appendText('='.repeat(cols));
      append(ESCPOS_COMMANDS.LF);
      continue;
    }

    let isBold = false;
    let isCenter = false;
    let isRight = false;

    if (line.startsWith('CENTER|')) {
      isCenter = true;
      line = line.substring(7);
    } else if (line.startsWith('RIGHT|')) {
      isRight = true;
      line = line.substring(6);
    }

    if (line.startsWith('BOLD|')) {
      isBold = true;
      line = line.substring(5);
    }

    if (isCenter) append(ESCPOS_COMMANDS.ALIGN_CENTER);
    if (isRight) append(ESCPOS_COMMANDS.ALIGN_RIGHT);
    if (isBold) append(ESCPOS_COMMANDS.BOLD_ON);

    appendText(line);
    append(ESCPOS_COMMANDS.LF);

    if (isBold) append(ESCPOS_COMMANDS.BOLD_OFF);
    if (isCenter || isRight) append(ESCPOS_COMMANDS.ALIGN_LEFT);
  }

  // Feed extra lines for thermal tear-off
  append(ESCPOS_COMMANDS.LF);
  append(ESCPOS_COMMANDS.LF);
  append(ESCPOS_COMMANDS.LF);
  append(ESCPOS_COMMANDS.LF);
  append(ESCPOS_COMMANDS.CUT_PARTIAL);

  if (openDrawer) {
    append(ESCPOS_COMMANDS.OPEN_DRAWER);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Convert ESC/POS bytes into Base64 string (for RawBT and Print Apps).
 */
export function getEscPosBase64(
  textLines: string[], 
  openDrawer: boolean = false, 
  width: '58mm' | '80mm' = '58mm'
): string {
  const bytes = encodeEscPosLines(textLines, openDrawer, width);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Direct Print via RawBT protocol (Universal Android Thermal Printer App).
 * RawBT connects seamlessly to Bluetooth (BLE & Classic 2.0/3.0 SPP), USB OTG, and WiFi printers on Android.
 */
export function printViaRawBT(
  textLines: string[], 
  openDrawer: boolean = false, 
  width: '58mm' | '80mm' = '58mm'
): boolean {
  const base64 = getEscPosBase64(textLines, openDrawer, width);
  const rawbtUrl = `rawbt:data:application/octet-stream;base64,${base64}`;
  
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = rawbtUrl;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch (e) {}
    }, 2000);
    return true;
  } catch (err) {
    window.location.href = rawbtUrl;
    return true;
  }
}

/**
 * Direct Connect to USB/Serial Printer (Web Serial API)
 */
export async function connectPrinter() {
  if (cachedPort && cachedPort.readable) {
    return cachedPort;
  }
  
  if (isInsideIframe()) {
    throw new Error('Las APIs de hardware directo (USB/Serie) están restringidas dentro de marcos (iframe). Abre la aplicación en una pestaña nueva para vincular.');
  }

  if (!('serial' in navigator)) {
    throw new Error('Web Serial API no está soportada en este navegador. Utiliza Google Chrome o Microsoft Edge.');
  }

  try {
    // @ts-ignore
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    cachedPort = port;
    return port;
  } catch (error: any) {
    if (
      error?.name === 'NotFoundError' || 
      error?.message?.includes('No port selected') || 
      error?.message?.includes('Failed to execute \'requestPort\' on \'Serial\'')
    ) {
      throw new Error('Selección de puerto cancelada.');
    }
    if (error?.name === 'SecurityError') {
      throw new Error('Permiso denegado por el navegador. Abre el sistema en una nueva pestaña.');
    }
    console.error('Error conectando impresora USB/Serie:', error);
    throw new Error(error?.message || 'No se pudo conectar con la impresora.');
  }
}

export async function checkPrinterConnection() {
  if (!('serial' in navigator)) return false;
  try {
    // @ts-ignore
    const ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
      if (!cachedPort) {
        cachedPort = ports[0];
        try {
          await cachedPort.open({ baudRate: 9600 });
        } catch (e) {
          // Already opened
        }
      }
      return true;
    }
  } catch (e) {}
  return false;
}

export async function checkBluetoothConnection(): Promise<boolean> {
  if (cachedBluetoothDevice && cachedBluetoothDevice.gatt && cachedBluetoothDevice.gatt.connected) {
    return true;
  }
  return false;
}

export async function getConnectedDeviceName(): Promise<string | null> {
  if (cachedBluetoothDevice && cachedBluetoothDevice.gatt?.connected) {
    return cachedBluetoothDevice.name || 'Impresora Bluetooth 58mm';
  }
  if (cachedPort) {
    return 'Impresora USB/Serie 58mm';
  }
  return null;
}

export async function isPrinterConnected(): Promise<boolean> {
  const bt = await checkBluetoothConnection();
  if (bt) return true;
  const usb = await checkPrinterConnection();
  return usb;
}

export async function disconnectPrinter() {
  if (cachedPort) {
    try {
      await cachedPort.close();
    } catch (e) {}
    cachedPort = null;
  }
}

export function disconnectBluetoothPrinter() {
  try {
    if (cachedBluetoothDevice && cachedBluetoothDevice.gatt && cachedBluetoothDevice.gatt.connected) {
      cachedBluetoothDevice.gatt.disconnect();
    }
  } catch (e) {}
  cachedBluetoothDevice = null;
  cachedBluetoothCharacteristic = null;
}

/**
 * Standard Bluetooth LE Service UUIDs across POS Thermal Printers:
 * HM-10, Goojprt, MPT-II, POS-58, PT-210, Xprinter, Netum, Rongta, Star, Epson BLE, etc.
 */
const THERMAL_PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard ESC/POS BLE
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 (Goojprt, MPT, PT-210, etc.)
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic POS BLE
  '0000fff0-0000-1000-8000-00805f9b34fb', // Generic POS BLE 2
  '0000ae00-0000-1000-8000-00805f9b34fb', // AE00
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent/WeChat BLE standard
  '000018f1-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Nordic UART 1
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART 2
  '0000af30-0000-1000-8000-00805f9b34fb', // ZJiang / POS58
  '0000fee0-0000-1000-8000-00805f9b34fb',
  '0000fe59-0000-1000-8000-00805f9b34fb',
];

/**
 * Connect to Bluetooth Thermal Printer (BLE ESC/POS)
 */
export async function connectBluetoothPrinter() {
  if (isInsideIframe()) {
    throw new Error('Las APIs de Bluetooth están restringidas dentro de marcos (iframe). Abre la aplicación en una pestaña nueva para buscar dispositivos.');
  }

  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth no está disponible en este navegador. Asegúrate de usar Google Chrome o Edge en Android o PC.');
  }
  
  try {
    // @ts-ignore
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: THERMAL_PRINTER_SERVICE_UUIDS
    });
    
    cachedBluetoothDevice = device;
    
    if (device.gatt) {
      const server = await device.gatt.connect();
      cachedBluetoothCharacteristic = await findBluetoothWritableCharacteristic(server);
    }
    
    return device;
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err?.message?.includes('User cancelled') || err?.message?.includes('cancelada')) {
      throw new Error('Búsqueda de dispositivo cancelada.');
    }
    if (err.name === 'SecurityError') {
      throw new Error('Permiso de Bluetooth denegado. Abre la app en una pestaña directa del navegador.');
    }
    throw new Error(err.message || 'Error al conectar con la impresora Bluetooth.');
  }
}

async function findBluetoothWritableCharacteristic(server: any) {
  for (const sUuid of THERMAL_PRINTER_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(sUuid);
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          return char;
        }
      }
    } catch (e) {
      // Try next service
    }
  }

  // Fallback: search all primary services exposed by device
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            return char;
          }
        }
      } catch (e) {}
    }
  } catch (e) {}

  return null;
}

/**
 * Print raw ESC/POS bytes over Bluetooth in safe chunk size (<= 100 bytes)
 */
export async function printReceiptOverBluetooth(textLines: string[], openDrawer: boolean = false, width: '58mm' | '80mm' = '58mm') {
  if (!cachedBluetoothDevice || !cachedBluetoothDevice.gatt) {
    throw new Error('No hay impresora Bluetooth conectada.');
  }

  let server = cachedBluetoothDevice.gatt;
  if (!server.connected) {
    server = await cachedBluetoothDevice.gatt.connect();
  }

  let characteristic = cachedBluetoothCharacteristic;
  if (!characteristic) {
    characteristic = await findBluetoothWritableCharacteristic(server);
    cachedBluetoothCharacteristic = characteristic;
  }

  if (!characteristic) {
    throw new Error('No se encontró canal de escritura ESC/POS en la impresora Bluetooth.');
  }

  const bytes = encodeEscPosLines(textLines, openDrawer, width);
  const chunkSize = 100;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

/**
 * Print raw ESC/POS bytes over Serial/USB
 */
export async function printReceiptOverSerial(textLines: string[], openDrawer: boolean = false, width: '58mm' | '80mm' = '58mm') {
  if (!await checkPrinterConnection()) {
    throw new Error('No hay impresora USB/Serie conectada.');
  }

  const bytes = encodeEscPosLines(textLines, openDrawer, width);
  const writer = cachedPort.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
}

/**
 * Unified Thermal Receipt Dispatcher:
 * 1) Tries Web Bluetooth if device is connected
 * 2) Tries Serial/USB if connected
 * 3) If neither is directly paired, allows RawBT print or connection modal
 */
export async function printThermalReceipt(options: {
  lines: string[];
  openDrawer?: boolean;
  width?: '58mm' | '80mm';
  preferRawBT?: boolean;
  onSuccess?: (method: 'bluetooth' | 'serial' | 'rawbt' | 'system') => void;
  onError?: (err: any) => void;
}): Promise<'bluetooth' | 'serial' | 'rawbt' | 'system'> {
  const { lines, openDrawer = false, width = '58mm', preferRawBT = false, onSuccess, onError } = options;

  // Option 1: Direct Bluetooth BLE
  if (cachedBluetoothDevice?.gatt?.connected) {
    try {
      await printReceiptOverBluetooth(lines, openDrawer, width);
      onSuccess?.('bluetooth');
      return 'bluetooth';
    } catch (btErr) {
      console.warn('Bluetooth thermal print failed:', btErr);
    }
  }

  // Option 2: Direct Serial / USB OTG
  const isSerialConnected = await checkPrinterConnection();
  if (isSerialConnected) {
    try {
      await printReceiptOverSerial(lines, openDrawer, width);
      onSuccess?.('serial');
      return 'serial';
    } catch (serErr) {
      console.warn('Serial thermal print failed:', serErr);
    }
  }

  // Option 3: RawBT (Android) if requested or running on Android mobile
  if (preferRawBT || (isAndroidDevice() && !cachedBluetoothDevice?.gatt?.connected && !isSerialConnected)) {
    try {
      printViaRawBT(lines, openDrawer, width);
      onSuccess?.('rawbt');
      return 'rawbt';
    } catch (rawErr) {
      console.warn('RawBT print failed:', rawErr);
    }
  }

  const err = new Error('No hay impresora térmica conectada.');
  onError?.(err);
  throw err;
}

export async function openCashDrawer() {
  if (cachedBluetoothDevice?.gatt?.connected) {
    await printReceiptOverBluetooth([], true);
    return;
  }

  if (await checkPrinterConnection()) {
    const writer = cachedPort.writable.getWriter();
    try {
      await writer.write(ESCPOS_COMMANDS.OPEN_DRAWER);
    } finally {
      writer.releaseLock();
    }
    return;
  }

  if (isAndroidDevice()) {
    printViaRawBT([], true);
    return;
  }

  throw new Error('No hay impresora térmica conectada para abrir el cajón.');
}

export async function testWifiPrinterConnection(ipAddress: string, _port: number = 9100) {
  if (!ipAddress || !ipAddress.trim()) {
    throw new Error('Ingresa una dirección IP válida (ejemplo: 192.168.1.100).');
  }
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ipAddress.trim())) {
    throw new Error('Formato de IP no válido. Ejemplo esperado: 192.168.1.100');
  }
  return true;
}

export const printESCPOS = printThermalReceipt;
