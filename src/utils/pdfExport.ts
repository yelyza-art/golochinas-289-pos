import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VentaRegistro, InventarioItem, TasasCambio } from '../types';
import { StorageService } from '../services/storage';
import { formatearVE, formatearFechaDDMMYYYY } from './formatters';

interface DashboardReportData {
  periodoNombre: string;
  kpis: {
    ingresos: number;
    totalBs: number;
    ganancia: number;
    margenGlobal: number;
    unidades: number;
    transacciones: number;
    ticketPromedio: number;
    topProducto: { nombre: string; unidadesVendidas: number; ingresoUSD: number } | null;
  };
  ventasDiarias: {
    fecha: string;
    totalUSD: number;
    totalBs: number;
    cantidadVentas: number;
  }[];
  rentabilidadCategorias: {
    categoria: string;
    ingresosUSD: number;
    costoUSD: number;
    gananciaUSD: number;
    margenPct: number;
    participacionPct: number;
  }[];
  rotacionInventario: {
    nombre: string;
    sku: string;
    categoria: string;
    unidadesVendidas: number;
    stockActual: number;
    ingresoUSD: number;
  }[];
  tasas: TasasCambio;
}

export function exportarDashboardPDF(data: DashboardReportData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const settings = StorageService.getSettings();
  const fechaHoyStr = new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const horaHoyStr = new Date().toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Color Palette
  const primaryNavy = [30, 58, 138] as [number, number, number]; // #1e3a8a
  const darkSlate = [15, 23, 42] as [number, number, number]; // #0f172a
  const emeraldGreen = [16, 185, 129] as [number, number, number];

  // 1. Header Banner
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 0, 210, 28, 'F');

  // Title in Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(settings.empresaNombre.toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`RIF: ${settings.empresaRif} • ${settings.empresaUbicacion}`, 14, 18);
  doc.text(`INFORME ADMINISTRATIVO DE VENTAS, ROTACIÓN Y RENTABILIDAD`, 14, 23);

  // Date and Period in top right
  doc.setFontSize(8);
  doc.text(`Fecha Emisión: ${fechaHoyStr} ${horaHoyStr}`, 196, 12, { align: 'right' });
  doc.text(`Período: ${data.periodoNombre.toUpperCase()}`, 196, 18, { align: 'right' });
  doc.text(`Tasa BCV Referencial: ${formatearVE(data.tasas.tasaBcv)} Bs/$`, 196, 23, { align: 'right' });

  let currentY = 34;

  // 2. Executive Summary KPIs (Boxes)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkSlate);
  doc.text('1. RESUMEN EJECUTIVO DE INDICADORES CLAVE (KPIs)', 14, currentY);

  currentY += 4;

  // 4 Metric cards
  const boxWidth = 43;
  const boxHeight = 16;
  const startX = 14;
  const gap = 3;

  const kpiItems = [
    {
      title: 'VENTAS TOTALES',
      val1: `$ ${formatearVE(data.kpis.ingresos)}`,
      val2: `Bs. ${formatearVE(data.kpis.totalBs)}`,
      color: [236, 253, 245], // emerald light
      border: [16, 185, 129],
    },
    {
      title: 'GANANCIA BRUTA',
      val1: `$ ${formatearVE(data.kpis.ganancia)}`,
      val2: `Margen: ${formatearVE(data.kpis.margenGlobal, 1)}%`,
      color: [239, 246, 255], // blue light
      border: [59, 130, 246],
    },
    {
      title: 'UNIDADES VENDIDAS',
      val1: `${data.kpis.unidades} Uds.`,
      val2: `${data.kpis.transacciones} Tickets`,
      color: [250, 245, 255], // purple light
      border: [168, 85, 247],
    },
    {
      title: 'TICKET PROMEDIO',
      val1: `$ ${formatearVE(data.kpis.ticketPromedio)}`,
      val2: `Top: ${data.kpis.topProducto?.nombre.substring(0, 10) || '---'}`,
      color: [255, 251, 235], // amber light
      border: [245, 158, 11],
    },
  ];

  kpiItems.forEach((box, i) => {
    const x = startX + i * (boxWidth + gap);
    doc.setFillColor(box.color[0], box.color[1], box.color[2]);
    doc.setDrawColor(box.border[0], box.border[1], box.border[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, currentY, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(box.title, x + boxWidth / 2, currentY + 4, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(box.val1, x + boxWidth / 2, currentY + 9.5, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(box.val2, x + boxWidth / 2, currentY + 13.5, { align: 'center' });
  });

  currentY += boxHeight + 8;

  // 3. Table: Ventas Diarias
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkSlate);
  doc.text('2. HISTORIAL DE FACTURACIÓN DIARIA', 14, currentY);

  const filasVentasDiarias = data.ventasDiarias.map((d) => [
    d.fecha,
    `${d.cantidadVentas} ticket(s)`,
    `$ ${formatearVE(d.totalUSD)}`,
    `Bs. ${formatearVE(d.totalBs)}`,
  ]);

  autoTable(doc, {
    startY: currentY + 2,
    head: [['FECHA', 'TICKETS PROCESADOS', 'TOTAL VENTAS (USD)', 'TOTAL VENTAS (BS)']],
    body: filasVentasDiarias.length > 0 ? filasVentasDiarias : [['---', 'Sin ventas', '$ 0,00', 'Bs. 0,00']],
    theme: 'grid',
    headStyles: {
      fillColor: primaryNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
      3: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216] },
    },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Check if page break is needed
  if (currentY > 210) {
    doc.addPage();
    currentY = 20;
  }

  // 4. Table: Rentabilidad por Categoría
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkSlate);
  doc.text('3. ANÁLISIS DE RENTABILIDAD & GANANCIA POR CATEGORÍA', 14, currentY);

  const filasCategorias = data.rentabilidadCategorias.map((c) => [
    c.categoria,
    `$ ${formatearVE(c.ingresosUSD)}`,
    `$ ${formatearVE(c.costoUSD)}`,
    `$ ${formatearVE(c.gananciaUSD)}`,
    `${c.margenPct}%`,
    `${c.participacionPct}%`,
  ]);

  autoTable(doc, {
    startY: currentY + 2,
    head: [['CATEGORÍA', 'INGRESOS ($)', 'COSTO MERCANCÍA ($)', 'GANANCIA BRUTA ($)', 'MARGEN %', 'PART. %']],
    body: filasCategorias.length > 0 ? filasCategorias : [['Sin datos', '$ 0,00', '$ 0,00', '$ 0,00', '0.0%', '0.0%']],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
      4: { halign: 'center', fontStyle: 'bold', textColor: [180, 83, 9] },
      5: { halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Check if page break is needed
  if (currentY > 210) {
    doc.addPage();
    currentY = 20;
  }

  // 5. Table: Inventario con Mayor Rotación
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkSlate);
  doc.text('4. TOP GOLOSINAS DE MAYOR ROTACIÓN Y VENTA', 14, currentY);

  const filasRotacion = data.rotacionInventario.slice(0, 10).map((r) => [
    r.nombre,
    r.sku,
    r.categoria,
    `${r.unidadesVendidas} uds`,
    `${r.stockActual} uds`,
    `$ ${formatearVE(r.ingresoUSD)}`,
  ]);

  autoTable(doc, {
    startY: currentY + 2,
    head: [['PRODUCTO', 'CÓD. SKU', 'CATEGORÍA', 'UDS VENDIDAS', 'STOCK ACTUAL', 'INGRESOS ($)']],
    body: filasRotacion.length > 0 ? filasRotacion : [['Sin datos', '---', '---', '0', '0', '$ 0,00']],
    theme: 'grid',
    headStyles: {
      fillColor: primaryNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center', fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'center', fontStyle: 'bold', textColor: [4, 120, 87] },
      4: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138] },
    },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Check if signatures fit or add page
  if (currentY > 245) {
    doc.addPage();
    currentY = 30;
  }

  // 6. Signatures & Administrative Approval section
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);

  const sigY = currentY + 12;
  // Signature 1
  doc.line(25, sigY, 85, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text('ELABORADO POR:', 55, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('DEPARTAMENTO DE VENTAS / POS', 55, sigY + 8, { align: 'center' });

  // Signature 2
  doc.line(125, sigY, 185, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REVISADO Y APROBADO POR:', 155, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('GERENCIA / ADMINISTRACIÓN CENTRAL', 155, sigY + 8, { align: 'center' });

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `GOLOCHINAS 289, C.A. • Documento Administrativo Confidencial • Generado automáticamente el ${fechaHoyStr}`,
      14,
      290
    );
    doc.text(`Página ${p} de ${totalPages}`, 196, 290, { align: 'right' });
  }

  // Save the PDF
  const filename = `Informe_Dashboard_Golochinas_${fechaHoyStr.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}

export function exportarReporteVentasPDF(
  ventas: VentaRegistro[],
  tasas: TasasCambio,
  fechaFiltro?: string // YYYY-MM-DD o DD/MM/YYYY opcional para reporte específico del día
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const settings = StorageService.getSettings();
  const fechaHoyStr = new Date().toLocaleDateString('es-VE');

  // Filtrar si se proporcionó una fecha específica del día
  let ventasExportar = ventas;
  let subtituloFecha = `Fecha de Emisión: ${fechaHoyStr}`;
  if (fechaFiltro) {
    const fechaFiltroNormalized = fechaFiltro.trim();
    ventasExportar = ventas.filter((v) => {
      const vFecha = (v.fecha || '').trim();
      return (
        vFecha === fechaFiltroNormalized ||
        vFecha.startsWith(fechaFiltroNormalized) ||
        formatearFechaDDMMYYYY(vFecha) === formatearFechaDDMMYYYY(fechaFiltroNormalized)
      );
    });
    subtituloFecha = `Reporte del Día: ${formatearFechaDDMMYYYY(fechaFiltro)} • Emisión: ${fechaHoyStr}`;
  }

  // Header Banner
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(settings.empresaNombre.toUpperCase(), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const tituloDocumento = fechaFiltro
    ? `RIF: ${settings.empresaRif} • REPORTE DIARIO DE VENTAS Y FACTURACIÓN (${formatearFechaDDMMYYYY(fechaFiltro)})`
    : `RIF: ${settings.empresaRif} • REPORTE GENERAL DE VENTAS FACTURADAS (SENIAT POS)`;
  doc.text(tituloDocumento, 14, 18);

  doc.setFontSize(8);
  doc.text(subtituloFecha, 283, 11, { align: 'right' });
  doc.text(`Tasa BCV Referencial: ${formatearVE(tasas.tasaBcv)} Bs/$`, 283, 18, { align: 'right' });

  let totalUSDGeneral = 0;
  let totalBsGeneral = 0;

  const filas = ventasExportar.map((v) => {
    totalUSDGeneral += v.total_usd || 0;
    totalBsGeneral += v.total_bs || 0;

    let itemsCount = 0;
    try {
      const parsed = typeof v.items_json === 'string' ? JSON.parse(v.items_json) : v.items_json;
      if (Array.isArray(parsed)) itemsCount = parsed.length;
    } catch (e) {
      itemsCount = 1;
    }

    return [
      v.id_venta,
      v.fecha,
      v.cliente.toUpperCase(),
      v.condicion_pago,
      v.metodo_pago,
      `${itemsCount} ítem(s)`,
      `$ ${formatearVE(v.total_usd)}`,
      `Bs. ${formatearVE(v.total_bs)}`,
      v.estado || 'PROCESADA',
    ];
  });

  autoTable(doc, {
    startY: 30,
    head: [['NRO FACTURA', 'FECHA', 'CLIENTE / RIF', 'CONDICIÓN', 'MÉTODO', 'CANT. ARTÍCULOS', 'TOTAL (USD)', 'TOTAL (BS)', 'ESTADO']],
    body: filas.length > 0 ? filas : [['---', '---', 'Sin ventas registradas para este periodo', '---', '---', '---', '$ 0,00', 'Bs. 0,00', '---']],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
      7: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216] },
      8: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    tableWidth: 269,
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Totals summary box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL FACTURADO (${ventasExportar.length} Transacciones):`, 140, finalY + 4);
  doc.setTextColor(4, 120, 87);
  doc.text(`$ ${formatearVE(totalUSDGeneral)} USD`, 215, finalY + 4);
  doc.setTextColor(29, 78, 216);
  doc.text(`Bs. ${formatearVE(totalBsGeneral)}`, 255, finalY + 4);

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `GOLOCHINAS 289, C.A. • Reporte Oficial de Ventas SENIAT POS • Fecha: ${fechaHoyStr}`,
      14,
      202
    );
    doc.text(`Página ${p} de ${totalPages}`, 283, 202, { align: 'right' });
  }

  const filename = fechaFiltro
    ? `Reporte_Ventas_Del_Dia_${fechaFiltro.replace(/[\/\-]/g, '_')}.pdf`
    : `Reporte_Ventas_Golochinas_${fechaHoyStr.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}

/**
 * Exporta un Ticket de Venta como PDF descargable, formateado para cualquier dispositivo móvil o de escritorio
 */
export function exportarTicketPDF(
  idVenta: string,
  cliente: string,
  condicion: 'CONTADO' | 'CRÉDITO',
  items: { nombre: string; cantidad: number; precio_manual: number; sku?: string }[],
  totalUSD: number,
  totalBs: number,
  tasaBCV: number,
  formato: '58mm' | '80mm' | 'pdf' = '80mm'
) {
  const widthMm = formato === '58mm' ? 58 : formato === 'pdf' ? 100 : 80;
  // Cálculo dinámico de altura para evitar cortes en tickets largos
  const heightMm = Math.max(130, 80 + items.length * 8.5);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
  });

  const settings = StorageService.getSettings();
  const logo = StorageService.getLogo();
  const margin = 4;
  let currentY = 5;

  // 1. Logo si existe
  if (logo && logo.startsWith('data:image/')) {
    try {
      const logoWidth = widthMm === 58 ? 20 : 26;
      const logoHeight = logoWidth * 0.75;
      const logoX = (widthMm - logoWidth) / 2;
      doc.addImage(logo, 'PNG', logoX, currentY, logoWidth, logoHeight);
      currentY += logoHeight + 2;
    } catch {
      // Continuar si falla renderizado de imagen
    }
  }

  // 2. Encabezado de la Empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(widthMm === 58 ? 9 : 11);
  doc.setTextColor(15, 23, 42);
  doc.text(settings.empresaNombre, widthMm / 2, currentY, { align: 'center' });
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(widthMm === 58 ? 6.5 : 7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`RIF: ${settings.empresaRif}`, widthMm / 2, currentY, { align: 'center' });
  currentY += 3.5;
  doc.text(settings.empresaUbicacion, widthMm / 2, currentY, { align: 'center' });
  currentY += 4;

  // Línea divisoria
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, currentY, widthMm - margin, currentY);
  currentY += 3.5;

  // 3. Metadatos de la Venta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(widthMm === 58 ? 7 : 8);
  doc.text(`FACTURA NRO: ${idVenta}`, widthMm / 2, currentY, { align: 'center' });
  currentY += 3.5;

  const fechaStr = new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const horaStr = new Date().toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(widthMm === 58 ? 6 : 7);
  doc.text(`FECHA: ${fechaStr}  ${horaStr}`, margin, currentY);
  currentY += 3;
  doc.text(`CLIENTE: ${(cliente || 'CLIENTE GENERAL').toUpperCase()}`, margin, currentY);
  currentY += 3;
  doc.text(`CONDICIÓN: ${condicion.toUpperCase()}`, margin, currentY);
  currentY += 3.5;

  // Línea divisoria
  doc.line(margin, currentY, widthMm - margin, currentY);
  currentY += 3.5;

  // 4. Detalle de Artículos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(widthMm === 58 ? 6.5 : 7.5);
  doc.text('CANT.  DESCRIPCIÓN', margin, currentY);
  doc.text('TOTAL ($)', widthMm - margin, currentY, { align: 'right' });
  currentY += 3.5;

  doc.setFont('helvetica', 'normal');
  items.forEach((it) => {
    const cant = it.cantidad || 1;
    const precioU = it.precio_manual || 0;
    const subUSD = cant * precioU;
    const subBs = subUSD * tasaBCV;

    // Nombre recortado según ancho
    const maxChars = widthMm === 58 ? 16 : 24;
    const nombreCorto = it.nombre.length > maxChars ? it.nombre.substring(0, maxChars) + '..' : it.nombre;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(widthMm === 58 ? 6.5 : 7.5);
    doc.text(`${cant}x ${nombreCorto}`, margin, currentY);
    doc.text(`$ ${formatearVE(subUSD)}`, widthMm - margin, currentY, { align: 'right' });
    currentY += 2.8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(widthMm === 58 ? 5.5 : 6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `P.U: $${formatearVE(precioU)}  |  Bs.${formatearVE(subBs)}`,
      margin + 3,
      currentY
    );
    doc.setTextColor(51, 65, 85);
    currentY += 3.8;
  });

  // Línea divisoria
  doc.line(margin, currentY, widthMm - margin, currentY);
  currentY += 4;

  // 5. Bloque de Totales
  if (condicion === 'CRÉDITO') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(widthMm === 58 ? 9 : 10);
    doc.setTextColor(185, 28, 28);
    doc.text('TOTAL CRÉDITO:', margin, currentY);
    doc.text(`$ ${formatearVE(totalUSD)}`, widthMm - margin, currentY, { align: 'right' });
    currentY += 4.5;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(widthMm === 58 ? 9 : 10);
    doc.setTextColor(4, 120, 87);
    doc.text('TOTAL A PAGAR:', margin, currentY);
    doc.text(`Bs. ${formatearVE(totalBs)}`, widthMm - margin, currentY, { align: 'right' });
    currentY += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(widthMm === 58 ? 8 : 8.5);
    doc.setTextColor(30, 58, 138);
    doc.text('REF. USD ($):', margin, currentY);
    doc.text(`$ ${formatearVE(totalUSD)}`, widthMm - margin, currentY, { align: 'right' });
    currentY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(widthMm === 58 ? 6 : 6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Tasa Oficial BCV: Bs. ${formatearVE(tasaBCV)} / USD`, margin, currentY);
    currentY += 4.5;
  }

  // 6. Pie de Ticket
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(widthMm === 58 ? 6.5 : 7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('*** GRACIAS POR SU COMPRA ***', widthMm / 2, currentY, { align: 'center' });
  currentY += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(widthMm === 58 ? 5.5 : 6);
  doc.setTextColor(148, 163, 184);
  doc.text('Comprobante electrónico guardado en sistema', widthMm / 2, currentY, { align: 'center' });

  const safeCliente = cliente ? cliente.replace(/[^a-zA-Z0-9]/g, '_') : 'General';
  doc.save(`Ticket_${idVenta}_${safeCliente}.pdf`);
}

/**
 * Exporta una etiqueta POP de precio como PDF descargable para cualquier dispositivo
 */
export function exportarEtiquetaPDF(
  nombre: string,
  pvpFinalConIVA: number,
  tasaBCV: number,
  sku?: string,
  categoria?: string
) {
  // Dimensiones estándar POP (70mm x 45mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [45, 70],
  });

  const settings = StorageService.getSettings();
  const pvpBs = pvpFinalConIVA * tasaBCV;
  const mesAno = new Date().toLocaleDateString('es-VE', { month: '2-digit', year: 'numeric' });

  // Marco de borde
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.6);
  doc.rect(2, 2, 66, 41);

  // Encabezado
  doc.setFillColor(30, 58, 138);
  doc.rect(2, 2, 66, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(settings.empresaNombre || 'GOLOCHINAS 289', 35, 6, { align: 'center' });

  // Título del producto
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const nombreTrim = nombre.toUpperCase();
  const maxL = 26;
  const nombreLinea = nombreTrim.length > maxL ? nombreTrim.substring(0, maxL) + '..' : nombreTrim;
  doc.text(nombreLinea, 35, 12, { align: 'center' });

  // Precio Gigante en USD
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(4, 120, 87);
  doc.text(`$ ${formatearVE(pvpFinalConIVA)}`, 35, 22, { align: 'center' });

  // Precio en Bolívares
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text(`Bs. ${formatearVE(pvpBs)}`, 35, 28, { align: 'center' });

  // Leyenda de Tasa
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(`CALCULADO A TASA OFICIAL BCV (${formatearVE(tasaBCV)})`, 35, 33, { align: 'center' });

  // Pie con SKU y Fecha
  doc.setDrawColor(226, 232, 240);
  doc.line(4, 35.5, 66, 35.5);

  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text(sku && sku !== 'S/N' ? `SKU: ${sku}` : (categoria || 'GOLOCHINAS'), 4, 39);
  doc.text(mesAno, 66, 39, { align: 'right' });

  const safeName = nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
  doc.save(`Etiqueta_${safeName}.pdf`);
}

