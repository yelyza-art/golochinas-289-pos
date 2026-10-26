import { InventarioItem } from '../types';
import { redondearExacto } from './formatters';

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function exportarInventarioCSV(items: InventarioItem[], nombreArchivoExtra = '') {
  const headers = [
    'ROW_ID',
    'NOMBRE_ARTICULO',
    'SKU_CODIGO_BARRA',
    'CATEGORIA',
    'PRESENTACION',
    'STOCK_ACTUAL',
    'STOCK_MINIMO_ALERTA',
    'ESTADO_STOCK',
    'BASE_COSTO_USD',
    'TASA_IVA_PCT',
    'COSTO_CON_IVA_USD',
    'COSTO_UNITARIO_USD',
    'BASE_PVP_DETAL_USD',
    'PVP_DETAL_IVA_USD',
    'PVP_MAYOR_IVA_USD',
    'MARGEN_DETAL_PCT',
    'MARGEN_MAYOR_PCT',
    'VALOR_TOTAL_COSTO_USD',
    'VALOR_TOTAL_VENTA_USD',
    'CAT_DETAL',
    'CAT_MAYOR',
  ];

  let totalStock = 0;
  let totalValorCosto = 0;
  let totalValorVenta = 0;
  let articulosCriticos = 0;

  const filas = items.map((p) => {
    const stock = parseFloat(p.stock as any) || 0;
    const stockMin = parseFloat(p.stock_minimo as any) || 0;
    const baseCosto = parseFloat(p.base_costo as any) || 0;
    const costoU = parseFloat(p.costo_u_prot as any) || baseCosto;
    const basePvp = parseFloat(p.base_pvp_detal as any) || 0;
    const pvpDetal = parseFloat(p.pvp_detal as any) || 0;
    const pvpMayor = parseFloat(p.pvp_mayor as any) || redondearExacto(pvpDetal * 0.95, 2);

    const valorCosto = redondearExacto(stock * costoU, 2);
    const valorVenta = redondearExacto(stock * pvpDetal, 2);

    totalStock += stock;
    totalValorCosto += valorCosto;
    totalValorVenta += valorVenta;

    // Estado stock
    let estadoStock = 'NORMAL';
    if (stock <= 0) {
      estadoStock = 'AGOTADO';
      articulosCriticos++;
    } else if (stock <= stockMin) {
      estadoStock = 'CRITICO / BAJO MINIMO';
      articulosCriticos++;
    } else if (stock <= stockMin + 3) {
      estadoStock = 'POR AGOTARSE';
    }

    const margenD = basePvp > 0 ? redondearExacto(((basePvp - costoU) / basePvp) * 100, 1) : 0;
    const margenM = (basePvp * 0.95) > 0 ? redondearExacto((((basePvp * 0.95) - costoU) / (basePvp * 0.95)) * 100, 1) : 0;

    return [
      escapeCSV(p.rowid || ''),
      escapeCSV(p.nombre),
      escapeCSV(p.sku || 'S/N'),
      escapeCSV(p.categoria || 'GOLOSINAS'),
      escapeCSV(p.presentacion || 'Unidad'),
      stock,
      stockMin,
      escapeCSV(estadoStock),
      baseCosto.toFixed(4),
      p.iva_tipo || '16',
      (parseFloat(p.costo_con_iva as any) || 0).toFixed(4),
      costoU.toFixed(4),
      basePvp.toFixed(4),
      pvpDetal.toFixed(2),
      pvpMayor.toFixed(2),
      `${margenD}%`,
      `${margenM}%`,
      valorCosto.toFixed(2),
      valorVenta.toFixed(2),
      p.cat_detal ? 'TRUE' : 'FALSE',
      p.cat_mayor ? 'TRUE' : 'FALSE',
    ].join(',');
  });

  // Summary Row
  const filaTotales = [
    escapeCSV('TOTALES_AUDITORIA'),
    escapeCSV(`TOTAL ARTICULOS: ${items.length} (${articulosCriticos} CRITICOS)`),
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    totalStock,
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    escapeCSV('---'),
    totalValorCosto.toFixed(2),
    totalValorVenta.toFixed(2),
    escapeCSV('---'),
    escapeCSV('---'),
  ].join(',');

  // UTF-8 BOM for perfect Excel accent rendering
  const csvContent = '\uFEFF' + [headers.join(','), ...filas, filaTotales].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  const fechaHoy = new Date().toISOString().split('T')[0];
  const sufijo = nombreArchivoExtra ? `_${nombreArchivoExtra}` : '';
  a.href = url;
  a.download = `Inventario_Golochinas289_${fechaHoy}${sufijo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
