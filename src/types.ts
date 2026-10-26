export interface InventarioItem {
  nombre: string;
  base_pvp_detal: number;
  pvp_detal: number;
  categoria: string;
  sku: string;
  base_costo: number;
  costo_con_iva: number;
  costo_u_prot: number;
  stock: number;
  stock_minimo?: number;
  unidad?: number;
  presentacion?: string;
  iva_tipo: string;
  se_pesa?: string;
  activo?: string;
  base_pvp_mayor?: number;
  pvp_mayor: number;
  cat_detal: boolean;
  cat_mayor: boolean;
  rowid: string;
  lote?: string;
  fecha_vencimiento?: string;
}

export interface HistorialAbono {
  fecha: string;
  nro_doc?: string;
  monto_usd: number;
  tasa_bcv: number;
  pagado_bs: number;
  metodo_pago: string;
  referencia: string;
}

export interface CompraItem {
  id_registro: string;
  empresa: string;
  libro: 'FISCAL' | 'PRIVADO';
  documento: 'FACTURA' | 'NOTA DE ENTREGA';
  nro_doc: string;
  fecha_emision: string;
  fecha_recepcion: string;
  fecha_vencimiento: string;
  proveedor: string;
  exento: number;
  base_gravada: number;
  iva: number;
  total: number;
  abonado_usd: number;
  historial_abonos: HistorialAbono[];
  tasa_bcv: number;
  pagado_bs: number;
  fecha_pago?: string;
  metodo_pago?: string;
  referencia?: string;
}

export interface Proveedor {
  rif: string;
  razon_social: string;
  dias_credito_base: number;
  metodo_habitual: string;
  datos_cuenta: string;
}

export interface CarritoItem {
  rowId: string;
  sku: string;
  nombre: string;
  precio_base_detal: number;
  precio_manual: number;
  tarifa: 'DETAL' | 'MAYOR';
  cantidad: number;
  sinStock?: boolean;
  stockActual?: number;
  esManual?: boolean;
}

export interface VentaRegistro {
  id_venta: string;
  fecha: string;
  cliente: string;
  tipo_precio: string;
  condicion_pago: 'CONTADO' | 'CRÉDITO';
  metodo_pago: string;
  items_json: string;
  total_usd: number;
  total_bs: number;
  tasa_bcv: number;
  estado: string;
  libro: 'FISCAL' | 'PRIVADO';
}

export interface TasasCambio {
  tasaBcv: number;
  tasaEuro: number;
  tasaUsdt: number;
}

export interface MovimientoKardex {
  id: string;
  fecha: string;
  proveedor: string;
  rif: string;
  tipo: string;
  nro_doc: string;
  detalle: string;
  cargo: number;
  abono: number;
  saldo: number;
}

export interface OfflineAction {
  id: string;
  timestamp: number;
  action:
    | 'GUARDAR_PRODUCTO'
    | 'GUARDAR_VENTA'
    | 'GUARDAR_COMPRA'
    | 'GUARDAR_PROVEEDOR'
    | 'ELIMINAR_PRODUCTO'
    | 'BORRAR_COMPRA'
    | 'GUARDAR_CONCILIACION'
    | 'GUARDAR_GASTO'
    | 'ELIMINAR_GASTO';
  description: string;
  payload: any;
  retryCount: number;
  lastError?: string;
}

export type TipoMetodoConciliacion =
  | 'DEBITO'
  | 'CREDITO'
  | 'PAGO_MOVIL'
  | 'BIOPAGO'
  | 'EFECTIVO_USD'
  | 'EFECTIVO_BS'
  | 'TRANSFERENCIA';

export interface DesgloseMetodoPago {
  metodo: TipoMetodoConciliacion;
  nombreLegible: string;
  montoSistemaBs: number;
  montoSistemaUsd: number;
  montoLotePosBs: number; // Monto bruto reportado en cierre de punto / físico
  montoLotePosUsd: number;
  tasaComisionPorcentaje: number; // Porcentaje de comisión bancaria (ej. 1.5% o 3.5%)
  comisionBs: number;
  comisionUsd: number;
  retencionBs?: number; // Retención bancaria ISLR/IVA si aplica
  retencionUsd?: number;
  montoNetoBancoBs: number; // Lo que realmente ingresa en la cuenta bancaria
  montoNetoBancoUsd: number;
  diferenciaBs: number; // montoLotePosBs - montoSistemaBs
  diferenciaUsd: number;
}

export interface CierreCajaConciliacion {
  id: string;
  fecha: string;
  hora: string;
  cajero: string;
  banco: string;
  nroLote: string;
  tasaBcv: number;
  totalSistemaBs: number;
  totalSistemaUsd: number;
  totalLotePosBs: number; // Total bruto transado
  totalLotePosUsd: number;
  totalComisionesBs: number; // Total comisiones cobradas
  totalComisionesUsd: number;
  totalRetencionesBs: number;
  totalRetencionesUsd: number;
  totalNetoBancoBs: number; // Lo que realmente cae en la cuenta del banco
  totalNetoBancoUsd: number;
  diferenciaNetaBs: number; // totalLotePosBs - totalSistemaBs
  diferenciaNetaUsd: number;
  estadoDiferencia: 'CUADRADO' | 'SOBRANTE' | 'FALTANTE';
  desglose: DesgloseMetodoPago[];
  observaciones?: string;
  fechaCreacionIso: string;
}

export type CategoriaGasto =
  | 'ALQUILER'
  | 'NOMINA_SUELDOS'
  | 'SERVICIOS_PUBLICOS'
  | 'FLETES_TRANSPORTE'
  | 'MANTENIMIENTO_REPARACIONES'
  | 'IMPUESTOS_PATENTES'
  | 'PUBLICIDAD_MARKETING'
  | 'INSUMOS_PAPELERIA'
  | 'MERMAS_PERDIDAS'
  | 'COMISIONES_BANCARIAS'
  | 'OTRO_GASTO';

export interface GastoItem {
  id: string; // ej. "GAS-202610-001"
  fecha: string; // "YYYY-MM-DD"
  categoria: CategoriaGasto;
  descripcion: string;
  monto_usd: number;
  monto_bs: number;
  tasa_bcv: number;
  metodo_pago: string; // "EFECTIVO USD", "EFECTIVO BS", "PAGO MOVIL", "TRANSFERENCIA", "PUNTO DE VENTA"
  beneficiario?: string; // Nombre del proveedor del servicio o empleado
  nro_comprobante?: string; // Nro de factura de servicio, recibo o referencia
  observaciones?: string;
  fechaCreacionIso: string;
  libro: 'FISCAL' | 'PRIVADO';
}


export interface PrintLog {
  id: string;
  timestamp: string;
  printerModel: string;
  format: '58mm' | '80mm' | 'pdf';
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  ventaId?: string;
}
export interface MultiPayment {
  metodo: TipoMetodoConciliacion;
  montoBs: number;
  montoUsd: number;
}
