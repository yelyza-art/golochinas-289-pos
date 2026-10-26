import {
  InventarioItem,
  CompraItem,
  Proveedor,
  VentaRegistro,
  TasasCambio,
  OfflineAction,
  CierreCajaConciliacion,
  GastoItem,
  PrintLog,
} from '../types';

const STORAGE_KEYS = {
  INVENTARIO: 'golochinas_inventario_v2',
  COMPRAS: 'golochinas_compras_v2',
  PROVEEDORES: 'golochinas_proveedores_v2',
  VENTAS: 'golochinas_ventas_v2',
  GASTOS: 'golochinas_gastos_v2',
  CONCILIACIONES: 'golochinas_conciliaciones_v2',
  COMISIONES_CONFIG: 'golochinas_comisiones_config_v2',
  TASAS: 'golochinas_tasas_v2',
  OFFLINE_QUEUE: 'golochinas_offline_queue_v2',
  SETTINGS: 'golochinas_settings_v2',
  LOGO: 'golochinas_logo',
  ADMIN_PIN: 'golochinas_admin_pin',
  ADMIN_UNLOCKED: 'golochinas_admin_unlocked_session',
};

export interface ComisionesConfig {
  debito: number; // % comisión tarjeta de débito
  credito: number; // % comisión tarjeta de crédito
  pagoMovil: number; // % comisión pago móvil
  biopago: number; // % comisión biopago
  retencionIslr: number; // % retención ISLR si aplica
}

export const DEFAULT_COMISIONES: ComisionesConfig = {
  debito: 1.5,
  credito: 3.5,
  pagoMovil: 0.3,
  biopago: 1.2,
  retencionIslr: 0.0,
};

export const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby6G4lfHIpLGcbdgusD2Hm-des9LL9ULp_gm-clk43S1e6zZ0OtQNupuLQp0o9RMC4/exec";

export interface AppSettings {
  scriptUrl: string;
  formatoImpresora: '58mm' | '80mm' | 'pdf';
  autoSync: boolean;
  empresaNombre: string;
  empresaRif: string;
  empresaUbicacion: string;
  pinSeguridad?: string; // PIN para restringir módulos administrativos
  bloqueoModulosActivo?: boolean; // Activar/desactivar restricción
  logoBase64?: string; // Copia de respaldo permanente del logo en ajustes
  ivaGeneral: number;
  ivaReducida: number;
  impresoraFiscalMargins: { top: number; bottom: number; left: number; right: number; };
}

export const DEFAULT_SETTINGS: AppSettings = {
  scriptUrl: DEFAULT_SCRIPT_URL,
  formatoImpresora: '58mm',
  autoSync: true,
  empresaNombre: 'GOLOCHINAS 289, C.A.',
  empresaRif: 'J-50412389-0',
  empresaUbicacion: 'SAN DIEGO - ESTADO CARABOBO',
  pinSeguridad: '1234',
  bloqueoModulosActivo: true,
  ivaGeneral: 16,
  ivaReducida: 8,
  impresoraFiscalMargins: { top: 0, bottom: 0, left: 0, right: 0 }
};

// Default seed data so the user has immediate access even with zero network connection on day one
const SEED_INVENTARIO: InventarioItem[] = [
  {
    nombre: "CHOCOLATE SAVOY LECHE 130G",
    base_pvp_detal: 2.15,
    pvp_detal: 2.50,
    categoria: "CHOCOLATES",
    sku: "7591016001234",
    base_costo: 1.60,
    costo_con_iva: 1.856,
    costo_u_prot: 1.60,
    stock: 24,
    stock_minimo: 10,
    unidad: 1,
    presentacion: "Tableta",
    iva_tipo: "16",
    pvp_mayor: 2.38,
    cat_detal: true,
    cat_mayor: true,
    rowid: "ROW_SEED_1"
  },
  {
    nombre: "GALLETAS OREO ORIGINAL 108G",
    base_pvp_detal: 1.03,
    pvp_detal: 1.20,
    categoria: "GALLETAS",
    sku: "7622210456789",
    base_costo: 0.75,
    costo_con_iva: 0.87,
    costo_u_prot: 0.75,
    stock: 5,
    stock_minimo: 12,
    unidad: 1,
    presentacion: "Paquete",
    iva_tipo: "16",
    pvp_mayor: 1.14,
    cat_detal: true,
    cat_mayor: true,
    rowid: "ROW_SEED_2"
  },
  {
    nombre: "CHUPETA BON BON BUM FRESA 24U",
    base_pvp_detal: 3.88,
    pvp_detal: 4.50,
    categoria: "GOLOSINAS",
    sku: "7702011089123",
    base_costo: 2.90,
    costo_con_iva: 3.364,
    costo_u_prot: 2.90,
    stock: 15,
    stock_minimo: 8,
    unidad: 24,
    presentacion: "Bolsa",
    iva_tipo: "16",
    pvp_mayor: 4.28,
    cat_detal: true,
    cat_mayor: true,
    rowid: "ROW_SEED_3"
  },
  {
    nombre: "CARAMELOS PIRULIN LATA 300G",
    base_pvp_detal: 5.17,
    pvp_detal: 6.00,
    categoria: "CHOCOLATES",
    sku: "7591054002345",
    base_costo: 3.90,
    costo_con_iva: 4.524,
    costo_u_prot: 3.90,
    stock: 3,
    stock_minimo: 6,
    unidad: 1,
    presentacion: "Lata",
    iva_tipo: "16",
    pvp_mayor: 5.70,
    cat_detal: true,
    cat_mayor: true,
    rowid: "ROW_SEED_4"
  },
  {
    nombre: "REFRESCO COCA COLA 1.5L",
    base_pvp_detal: 1.72,
    pvp_detal: 2.00,
    categoria: "BEBIDAS",
    sku: "7591001003456",
    base_costo: 1.30,
    costo_con_iva: 1.508,
    costo_u_prot: 1.30,
    stock: 18,
    stock_minimo: 10,
    unidad: 1,
    presentacion: "Botella",
    iva_tipo: "16",
    pvp_mayor: 1.90,
    cat_detal: true,
    cat_mayor: true,
    rowid: "ROW_SEED_5"
  },
  {
    nombre: "GOMITAS TRIDENT MORA 50G",
    base_pvp_detal: 0.86,
    pvp_detal: 1.00,
    categoria: "GOLOSINAS",
    sku: "7591023400567",
    base_costo: 0.60,
    costo_con_iva: 0.696,
    costo_u_prot: 0.60,
    stock: 0,
    stock_minimo: 5,
    unidad: 1,
    presentacion: "Paquete",
    iva_tipo: "16",
    pvp_mayor: 0.95,
    cat_detal: true,
    cat_mayor: true,
    rowid: "ROW_SEED_6"
  }
];

const SEED_PROVEEDORES: Proveedor[] = [
  {
    rif: "J-30567890-1",
    razon_social: "DISTRIBUIDORA VALENCIA DULCES C.A.",
    dias_credito_base: 15,
    metodo_habitual: "PAGO MÓVIL / TRANSFERENCIA",
    datos_cuenta: "BANESCO 0134-0012-34-1234567890 | PAGO MOVIL 0414-1234567 J-30567890-1"
  },
  {
    rif: "J-40123456-7",
    razon_social: "CONFITERIA CARABOBO MAYOR",
    dias_credito_base: 21,
    metodo_habitual: "TRANSFERENCIA BANCARIA",
    datos_cuenta: "BANCO DE VENEZUELA 0102-0111-22-3344556677"
  }
];

const SEED_VENTAS: VentaRegistro[] = [
  {
    id_venta: "00000001",
    fecha: "01/10/2026",
    cliente: "JUAN PEREZ",
    tipo_precio: "MIXTO",
    condicion_pago: "CONTADO",
    metodo_pago: "SENIAT POS",
    items_json: JSON.stringify([
      { rowId: "ROW_SEED_1", sku: "7591016001234", nombre: "CHOCOLATE SAVOY LECHE 130G", precio_base_detal: 2.50, precio_manual: 2.50, tarifa: "DETAL", cantidad: 4 },
      { rowId: "ROW_SEED_3", sku: "7702011089123", nombre: "CHUPETA BON BON BUM FRESA 24U", precio_base_detal: 4.50, precio_manual: 4.50, tarifa: "DETAL", cantidad: 2 }
    ]),
    total_usd: 19.00,
    total_bs: 14001.67,
    tasa_bcv: 736.93,
    estado: "PROCESADA"
  },
  {
    id_venta: "00000002",
    fecha: "02/10/2026",
    cliente: "MARIA RODRIGUEZ",
    tipo_precio: "MIXTO",
    condicion_pago: "CONTADO",
    metodo_pago: "SENIAT POS",
    items_json: JSON.stringify([
      { rowId: "ROW_SEED_2", sku: "7622210456789", nombre: "GALLETAS OREO ORIGINAL 108G", precio_base_detal: 1.20, precio_manual: 1.20, tarifa: "DETAL", cantidad: 6 },
      { rowId: "ROW_SEED_5", sku: "7591001003456", nombre: "REFRESCO COCA COLA 1.5L", precio_base_detal: 2.00, precio_manual: 2.00, tarifa: "DETAL", cantidad: 3 }
    ]),
    total_usd: 13.20,
    total_bs: 9727.48,
    tasa_bcv: 736.93,
    estado: "PROCESADA"
  },
  {
    id_venta: "00000003",
    fecha: "03/10/2026",
    cliente: "BODEGA LOS SAMANES",
    tipo_precio: "MAYOR",
    condicion_pago: "CONTADO",
    metodo_pago: "SENIAT POS",
    items_json: JSON.stringify([
      { rowId: "ROW_SEED_1", sku: "7591016001234", nombre: "CHOCOLATE SAVOY LECHE 130G", precio_base_detal: 2.50, precio_manual: 2.38, tarifa: "MAYOR", cantidad: 10 },
      { rowId: "ROW_SEED_4", sku: "7591054002345", nombre: "CARAMELOS PIRULIN LATA 300G", precio_base_detal: 6.00, precio_manual: 5.70, tarifa: "MAYOR", cantidad: 5 }
    ]),
    total_usd: 52.30,
    total_bs: 38541.44,
    tasa_bcv: 736.93,
    estado: "PROCESADA"
  },
  {
    id_venta: "00000004",
    fecha: "04/10/2026",
    cliente: "CARLOS GONZALEZ",
    tipo_precio: "MIXTO",
    condicion_pago: "CONTADO",
    metodo_pago: "SENIAT POS",
    items_json: JSON.stringify([
      { rowId: "ROW_SEED_2", sku: "7622210456789", nombre: "GALLETAS OREO ORIGINAL 108G", precio_base_detal: 1.20, precio_manual: 1.20, tarifa: "DETAL", cantidad: 8 },
      { rowId: "ROW_SEED_3", sku: "7702011089123", nombre: "CHUPETA BON BON BUM FRESA 24U", precio_base_detal: 4.50, precio_manual: 4.50, tarifa: "DETAL", cantidad: 3 },
      { rowId: "ROW_SEED_5", sku: "7591001003456", nombre: "REFRESCO COCA COLA 1.5L", precio_base_detal: 2.00, precio_manual: 2.00, tarifa: "DETAL", cantidad: 2 }
    ]),
    total_usd: 27.10,
    total_bs: 19970.80,
    tasa_bcv: 736.93,
    estado: "PROCESADA"
  },
  {
    id_venta: "00000005",
    fecha: "05/10/2026",
    cliente: "CLIENTE GENERAL",
    tipo_precio: "MIXTO",
    condicion_pago: "CONTADO",
    metodo_pago: "SENIAT POS",
    items_json: JSON.stringify([
      { rowId: "ROW_SEED_1", sku: "7591016001234", nombre: "CHOCOLATE SAVOY LECHE 130G", precio_base_detal: 2.50, precio_manual: 2.50, tarifa: "DETAL", cantidad: 6 },
      { rowId: "ROW_SEED_4", sku: "7591054002345", nombre: "CARAMELOS PIRULIN LATA 300G", precio_base_detal: 6.00, precio_manual: 6.00, tarifa: "DETAL", cantidad: 2 }
    ]),
    total_usd: 27.00,
    total_bs: 19897.11,
    tasa_bcv: 736.93,
    estado: "PROCESADA"
  }
];

export const StorageService = {
  // Inventario
  getInventario(): InventarioItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INVENTARIO);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          return parsed.map((item, idx) => {
            let rId = (item.rowid || '').trim();
            if (!rId || seen.has(rId)) {
              rId = rId ? `${rId}_${idx}` : `ROW_${idx}_${Date.now()}`;
            }
            seen.add(rId);
            return { ...item, rowid: rId };
          });
        }
      }
    } catch (e) {
      console.warn("Storage error getInventario:", e);
    }
    return SEED_INVENTARIO;
  },

  saveInventario(items: InventarioItem[]): void {
    try {
      const seen = new Set<string>();
      const sanitized = items.map((item, idx) => {
        let rId = (item.rowid || '').trim();
        if (!rId || seen.has(rId)) {
          rId = rId ? `${rId}_${idx}` : `ROW_${idx}_${Date.now()}`;
        }
        seen.add(rId);
        return { ...item, rowid: rId };
      });
      localStorage.setItem(STORAGE_KEYS.INVENTARIO, JSON.stringify(sanitized));
    } catch (e) {
      console.error("Storage error saveInventario:", e);
    }
  },

  // Compras
  getCompras(): CompraItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMPRAS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Storage error getCompras:", e);
    }
    return [];
  },

  saveCompras(items: CompraItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPRAS, JSON.stringify(items));
    } catch (e) {
      console.error("Storage error saveCompras:", e);
    }
  },

  // Proveedores
  getProveedores(): Proveedor[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROVEEDORES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Storage error getProveedores:", e);
    }
    return SEED_PROVEEDORES;
  },

  saveProveedores(items: Proveedor[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROVEEDORES, JSON.stringify(items));
    } catch (e) {
      console.error("Storage error saveProveedores:", e);
    }
  },

  // Ventas
  getVentas(): VentaRegistro[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VENTAS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Storage error getVentas:", e);
    }
    return SEED_VENTAS;
  },

  saveVentas(items: VentaRegistro[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.VENTAS, JSON.stringify(items));
    } catch (e) {
      console.error("Storage error saveVentas:", e);
    }
  },

  // Tasas
  getTasas(): TasasCambio {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASAS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Storage error getTasas:", e);
    }
    return {
      tasaBcv: 736.93,
      tasaEuro: 843.20,
      tasaUsdt: 864.15,
    };
  },

  saveTasas(tasas: TasasCambio): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TASAS, JSON.stringify(tasas));
    } catch (e) {
      console.error("Storage error saveTasas:", e);
    }
  },

  // Conciliaciones Bancarias y Cierres de Caja
  getConciliaciones(): CierreCajaConciliacion[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONCILIACIONES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Storage error getConciliaciones:", e);
    }
    return [];
  },

  saveConciliaciones(conciliaciones: CierreCajaConciliacion[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONCILIACIONES, JSON.stringify(conciliaciones));
    } catch (e) {
      console.error("Storage error saveConciliaciones:", e);
    }
  },

  addConciliacion(cierre: CierreCajaConciliacion): void {
    const list = this.getConciliaciones();
    const updated = [cierre, ...list.filter((c) => c.id !== cierre.id)];
    this.saveConciliaciones(updated);
  },

  deleteConciliacion(id: string): void {
    const list = this.getConciliaciones();
    this.saveConciliaciones(list.filter((c) => c.id !== id));
  },

  getComisionesConfig(): ComisionesConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMISIONES_CONFIG);
      if (data) return { ...DEFAULT_COMISIONES, ...JSON.parse(data) };
    } catch (e) {
      console.warn("Storage error getComisionesConfig:", e);
    }
    return DEFAULT_COMISIONES;
  },

  saveComisionesConfig(cfg: ComisionesConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.COMISIONES_CONFIG, JSON.stringify(cfg));
    } catch (e) {
      console.error("Storage error saveComisionesConfig:", e);
    }
  },

  // Gastos Operativos y Adicionales (No Compras de Inventario)
  getGastos(): GastoItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GASTOS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Storage error getGastos:", e);
    }
    const seed: GastoItem[] = [
      {
        id: 'GAS-202610-001',
        fecha: '2026-10-01',
        categoria: 'ALQUILER',
        descripcion: 'PAGO DE ALQUILER LOCAL COMERCIAL OCTUBRE',
        monto_usd: 120.0,
        monto_bs: 88431.6,
        tasa_bcv: 736.93,
        metodo_pago: 'EFECTIVO USD',
        beneficiario: 'INVERSIONES INMOBILIARIAS SAN DIEGO',
        nro_comprobante: 'REC-0941',
        observaciones: 'Pago puntual mes de octubre',
        fechaCreacionIso: '2026-10-01T10:00:00.000Z',
      },
      {
        id: 'GAS-202610-002',
        fecha: '2026-10-02',
        categoria: 'SERVICIOS_PUBLICOS',
        descripcion: 'SERVICIO DE INTERNET FIBRA ÓPTICA Y LUZ',
        monto_usd: 35.0,
        monto_bs: 25792.55,
        tasa_bcv: 736.93,
        metodo_pago: 'PAGO MOVIL',
        beneficiario: 'FIBEX TELECOM / CORPOELEC',
        nro_comprobante: 'REF-789421',
        observaciones: 'Plan comercio mensual',
        fechaCreacionIso: '2026-10-02T14:30:00.000Z',
      },
      {
        id: 'GAS-202610-003',
        fecha: '2026-10-04',
        categoria: 'INSUMOS_PAPELERIA',
        descripcion: 'ROLLOS PAPEL TÉRMICO 58MM Y BOLSAS PLÁSTICAS',
        monto_usd: 18.5,
        monto_bs: 13633.2,
        tasa_bcv: 736.93,
        metodo_pago: 'TRANSFERENCIA',
        beneficiario: 'DISTRIBUIDORA DE EMPAQUES CARABOBO',
        nro_comprobante: 'FAC-2051',
        observaciones: '1 caja de rollos térmicos + 500 bolsas',
        fechaCreacionIso: '2026-10-04T11:15:00.000Z',
      },
    ];
    this.saveGastos(seed);
    return seed;
  },

  saveGastos(gastos: GastoItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GASTOS, JSON.stringify(gastos));
    } catch (e) {
      console.error("Storage error saveGastos:", e);
    }
  },

  addGasto(gasto: GastoItem): void {
    const list = this.getGastos();
    const updated = [gasto, ...list.filter((g) => g.id !== gasto.id)];
    this.saveGastos(updated);
  },

  deleteGasto(id: string): void {
    const list = this.getGastos();
    this.saveGastos(list.filter((g) => g.id !== id));
  },

  // Logo con persistencia redundante (localStorage directo + configuración general)
  getLogo(): string | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LOGO);
      if (stored && stored.startsWith('data:image/')) return stored;
      
      const settings = this.getSettings();
      if (settings.logoBase64 && settings.logoBase64.startsWith('data:image/')) {
        // Restaurar en STORAGE_KEYS.LOGO si se había limpiado
        try {
          localStorage.setItem(STORAGE_KEYS.LOGO, settings.logoBase64);
        } catch {
          // Ignorar si hay cuota
        }
        return settings.logoBase64;
      }
    } catch (e) {
      console.warn("Storage error getLogo:", e);
    }
    return null;
  },

  saveLogo(base64: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGO, base64);
    } catch (e) {
      console.warn("Storage direct saveLogo quota:", e);
    }
    try {
      const settings = this.getSettings();
      this.saveSettings({ ...settings, logoBase64: base64 });
    } catch (e) {
      console.error("Storage settings saveLogo error:", e);
    }
  },

  removeLogo(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.LOGO);
    } catch (e) {
      console.warn("Error removing logo key:", e);
    }
    try {
      const settings = this.getSettings();
      delete settings.logoBase64;
      this.saveSettings(settings);
    } catch (e) {
      console.warn("Error removing logo from settings:", e);
    }
  },

  // Control de Acceso y Restricción de Módulos (PIN)
  getAdminPin(): string {
    try {
      const pin = localStorage.getItem(STORAGE_KEYS.ADMIN_PIN);
      if (pin) return pin;
      const settings = this.getSettings();
      if (settings.pinSeguridad) return settings.pinSeguridad;
    } catch (e) {
      console.warn("Storage error getAdminPin:", e);
    }
    return '1234';
  },

  saveAdminPin(pin: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, pin);
      const settings = this.getSettings();
      this.saveSettings({ ...settings, pinSeguridad: pin });
    } catch (e) {
      console.error("Storage error saveAdminPin:", e);
    }
  },

  isAdminUnlocked(): boolean {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.ADMIN_UNLOCKED) === 'true';
    } catch {
      return false;
    }
  },

  setAdminUnlocked(unlocked: boolean): void {
    try {
      if (unlocked) {
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_UNLOCKED, 'true');
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.ADMIN_UNLOCKED);
      }
    } catch (e) {
      console.error("Storage error setAdminUnlocked:", e);
    }
  },

  // Settings
  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (e) {
      console.warn("Storage error getSettings:", e);
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error("Storage error saveSettings:", e);
    }
  },

  // Offline Queue
  getOfflineQueue(): OfflineAction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Storage error getOfflineQueue:", e);
    }
    return [];
  },

  addToOfflineQueue(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): OfflineAction {
    const queue = this.getOfflineQueue();
    const newAction: OfflineAction = {
      ...action,
      id: 'QUEUE_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(newAction);
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.error("Storage error save offlineQueue:", e);
    }
    return newAction;
  },

  removeFromOfflineQueue(actionId: string): void {
    const queue = this.getOfflineQueue().filter(item => item.id !== actionId);
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.error("Storage error removeFromOfflineQueue:", e);
    }
  },

  updateOfflineQueue(queue: OfflineAction[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.error("Storage error updateOfflineQueue:", e);
    }
  },

  clearOfflineQueue(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify([]));
    } catch (e) {
      console.error("Storage error clearOfflineQueue:", e);
    }
  },

  // Export / Import entire local database
  exportBackupJSON(): string {
    const data = {
      timestamp: new Date().toISOString(),
      inventario: this.getInventario(),
      compras: this.getCompras(),
      proveedores: this.getProveedores(),
      ventas: this.getVentas(),
      gastos: this.getGastos(),
      conciliaciones: this.getConciliaciones(),
      tasas: this.getTasas(),
      settings: this.getSettings(),
      offlineQueue: this.getOfflineQueue(),
      logo: this.getLogo(),
      adminPin: this.getAdminPin(),
    };
    return JSON.stringify(data, null, 2);
  },

  importBackupJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data.inventario && Array.isArray(data.inventario)) this.saveInventario(data.inventario);
      if (data.compras && Array.isArray(data.compras)) this.saveCompras(data.compras);
      if (data.proveedores && Array.isArray(data.proveedores)) this.saveProveedores(data.proveedores);
      if (data.ventas && Array.isArray(data.ventas)) this.saveVentas(data.ventas);
      if (data.gastos && Array.isArray(data.gastos)) this.saveGastos(data.gastos);
      if (data.conciliaciones && Array.isArray(data.conciliaciones)) this.saveConciliaciones(data.conciliaciones);
      if (data.tasas) this.saveTasas(data.tasas);
      if (data.settings) this.saveSettings(data.settings);
      if (data.logo && typeof data.logo === 'string') this.saveLogo(data.logo);
      if (data.adminPin && typeof data.adminPin === 'string') this.saveAdminPin(data.adminPin);
      return true;
    } catch (e) {
      console.error("Error importing backup JSON:", e);
      return false;
    }
  },

  // Export full raw localStorage object
  exportAllLocalStorage(): Record<string, any> {
    const data: Record<string, any> = {};
    if (typeof localStorage === 'undefined') return data;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key);
        try {
          data[key] = JSON.parse(val || '');
        } catch {
          data[key] = val;
        }
      }
    }
    return data;
  },

  // Restore full raw localStorage object
  restoreAllLocalStorage(data: Record<string, any>): boolean {
    try {
      if (typeof localStorage === 'undefined' || !data) return false;
      const targetData = data.localStorageData || data.localStorage || data;
      Object.keys(targetData).forEach((key) => {
        if (key.startsWith('_')) return; // skip metadata keys
        const val = targetData[key];
        const strVal = typeof val === 'string' ? val : JSON.stringify(val);
        localStorage.setItem(key, strVal);
      });
      return true;
    } catch (e) {
      console.error("Error restoring localStorage:", e);
      return false;
    }
  },

  // Google Drive Scheduled Backup Configuration
  getDriveBackupConfig(): {
    activo: boolean;
    intervaloMinutos: number;
    carpeta: string;
    ultimoRespaldo?: {
      timestamp: number;
      fileId: string;
      fileName: string;
      folderId?: string;
      size?: string;
      status: 'SUCCESS' | 'ERROR';
      errorMsg?: string;
    };
  } {
    const defaultCfg = {
      activo: false,
      intervaloMinutos: 60,
      carpeta: 'GOLOCHINAS_289_BACKUPS',
    };
    try {
      const raw = localStorage.getItem('golochinas_drive_backup_cfg');
      if (raw) return { ...defaultCfg, ...JSON.parse(raw) };
    } catch {}
    return defaultCfg;
  },

  saveDriveBackupConfig(cfg: any): void {
    try {
      localStorage.setItem('golochinas_drive_backup_cfg', JSON.stringify(cfg));
    } catch (e) {
      console.error("Error saving drive backup config:", e);
    }
  },

  getPrintLogs(): PrintLog[] {
    try {
      const data = localStorage.getItem('golochinas_print_logs');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addPrintLog(log: PrintLog): void {
    const logs = this.getPrintLogs();
    this.savePrintLogs([log, ...logs].slice(0, 100));
  },

  savePrintLogs(logs: PrintLog[]): void {
    localStorage.setItem('golochinas_print_logs', JSON.stringify(logs));
  }
};
