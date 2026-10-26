import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Plus,
  Trash2,
  Printer,
  FileText,
  Download,
  Search,
  Calendar,
  Layers,
  Sparkles,
  Filter,
  Receipt,
  CheckCircle2,
  Briefcase,
  Wrench,
  Truck,
  Building,
  ShieldCheck,
  BarChart3,
  Percent,
  X,
  Save,
  CreditCard,
} from 'lucide-react';
import {
  GastoItem,
  CategoriaGasto,
  VentaRegistro,
  CompraItem,
  TasasCambio,
  CierreCajaConciliacion,
} from '../types';
import { StorageService } from '../services/storage';
import {
  formatearVE,
  redondearExacto,
  formatearFechaDDMMYYYY,
  convertirDDMMYYYYToYYYYMMDD,
} from '../utils/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GastosBalanceModuloProps {
  ventas: VentaRegistro[];
  compras: CompraItem[];
  tasas: TasasCambio;
  onGuardarGasto?: (gasto: GastoItem) => Promise<void>;
  onEliminarGasto?: (id: string) => Promise<void>;
}

const CATEGORIAS_GASTO_INFO: Record<
  CategoriaGasto,
  { label: string; icon: string; colorBg: string; colorText: string }
> = {
  ALQUILER: { label: 'Alquiler de Local', icon: '🏢', colorBg: 'bg-indigo-50', colorText: 'text-indigo-800' },
  NOMINA_SUELDOS: { label: 'Nómina y Sueldos', icon: '👥', colorBg: 'bg-blue-50', colorText: 'text-blue-800' },
  SERVICIOS_PUBLICOS: { label: 'Servicios (Luz/Agua/Net)', icon: '💡', colorBg: 'bg-amber-50', colorText: 'text-amber-800' },
  FLETES_TRANSPORTE: { label: 'Fletes y Envíos', icon: '🚚', colorBg: 'bg-cyan-50', colorText: 'text-cyan-800' },
  MANTENIMIENTO_REPARACIONES: { label: 'Mantenimiento y Reparación', icon: '🔧', colorBg: 'bg-orange-50', colorText: 'text-orange-800' },
  IMPUESTOS_PATENTES: { label: 'Impuestos y Patentes', icon: '🏛️', colorBg: 'bg-purple-50', colorText: 'text-purple-800' },
  PUBLICIDAD_MARKETING: { label: 'Publicidad y Marketing', icon: '📢', colorBg: 'bg-pink-50', colorText: 'text-pink-800' },
  INSUMOS_PAPELERIA: { label: 'Insumos, Bolsas y Papel', icon: '📦', colorBg: 'bg-emerald-50', colorText: 'text-emerald-800' },
  MERMAS_PERDIDAS: { label: 'Mermas y Daños', icon: '⚠️', colorBg: 'bg-red-50', colorText: 'text-red-800' },
  COMISIONES_BANCARIAS: { label: 'Comisiones Bancarias', icon: '💳', colorBg: 'bg-rose-50', colorText: 'text-rose-800' },
  OTRO_GASTO: { label: 'Otros Gastos Varios', icon: '📑', colorBg: 'bg-slate-50', colorText: 'text-slate-800' },
};

const METODOS_PAGO_GASTO = [
  'EFECTIVO USD',
  'EFECTIVO BS',
  'PAGO MOVIL',
  'TRANSFERENCIA BANCARIA',
  'PUNTO DE VENTA',
  'OTRO',
];

export const GastosBalanceModulo: React.FC<GastosBalanceModuloProps> = ({
  ventas,
  compras,
  tasas,
  onGuardarGasto,
  onEliminarGasto,
}) => {
  const [tabActiva, setTabActiva] = useState<'gastos' | 'balance' | 'cuentas'>('gastos');

  // Gastos almacenados
  const [gastos, setGastos] = useState<GastoItem[]>(() => StorageService.getGastos());

  // Modal para agregar gasto
  const [modalGastoOpen, setModalGastoOpen] = useState(false);
  const [formFecha, setFormFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [formCategoria, setFormCategoria] = useState<CategoriaGasto>('SERVICIOS_PUBLICOS');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formMontoUsd, setFormMontoUsd] = useState('');
  const [formMontoBs, setFormMontoBs] = useState('');
  const [formMetodoPago, setFormMetodoPago] = useState('EFECTIVO USD');
  const [formLibro, setFormLibro] = useState<'FISCAL' | 'PRIVADO'>('FISCAL');
  const [formBeneficiario, setFormBeneficiario] = useState('');
  const [formComprobante, setFormComprobante] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');

  // Filtros de la lista de gastos
  const [busquedaGasto, setBusquedaGasto] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');

  // Filtros del Balance General
  const anioActual = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1; // 1 - 12
  const [modoPeriodo, setModoPeriodo] = useState<'MENSUAL' | 'TRIMESTRAL' | 'ANUAL'>('MENSUAL');
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(mesActual);
  const [trimestreSeleccionado, setTrimestreSeleccionado] = useState<number>(Math.ceil(mesActual / 3));
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(anioActual);

  // Manejo de cambio en monto USD (con cálculo automático de Bs a tasa BCV)
  const handleMontoUsdChange = (val: string) => {
    setFormMontoUsd(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setFormMontoBs(String(redondearExacto(num * (tasas.tasaBcv || 1), 2)));
    } else {
      setFormMontoBs('');
    }
  };

  // Manejo de cambio en monto Bs (con cálculo automático de USD)
  const handleMontoBsChange = (val: string) => {
    setFormMontoBs(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setFormMontoUsd(String(redondearExacto(num / (tasas.tasaBcv || 1), 2)));
    } else {
      setFormMontoUsd('');
    }
  };

  // Guardar nuevo gasto
  const handleGuardarNuevoGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    const pUSD = parseFloat(formMontoUsd) || 0;
    const pBs = parseFloat(formMontoBs) || redondearExacto(pUSD * tasas.tasaBcv, 2);

    if (pUSD <= 0 && pBs <= 0) {
      alert('Por favor introduce un monto válido mayor a 0.');
      return;
    }

    if (!formDescripcion.trim()) {
      alert('Por favor especifica el concepto o descripción del gasto.');
      return;
    }

    const nuevoGasto: GastoItem = {
      id: `GAS-${formFecha.replace(/-/g, '').slice(2, 6)}-${Date.now().toString().slice(-4)}`,
      fecha: formFecha,
      categoria: formCategoria,
      descripcion: formDescripcion.trim().toUpperCase(),
      monto_usd: pUSD > 0 ? pUSD : redondearExacto(pBs / (tasas.tasaBcv || 1), 2),
      monto_bs: pBs > 0 ? pBs : redondearExacto(pUSD * (tasas.tasaBcv || 1), 2),
      tasa_bcv: tasas.tasaBcv,
      metodo_pago: formMetodoPago,
      beneficiario: formBeneficiario.trim().toUpperCase() || undefined,
      nro_comprobante: formComprobante.trim().toUpperCase() || undefined,
      observaciones: formObservaciones.trim() || undefined,
      fechaCreacionIso: new Date().toISOString(),
      libro: formLibro,
    };

    StorageService.addGasto(nuevoGasto);
    const updated = StorageService.getGastos();
    setGastos(updated);

    if (onGuardarGasto) {
      await onGuardarGasto(nuevoGasto);
    }

    // Reset form
    setFormDescripcion('');
    setFormMontoUsd('');
    setFormMontoBs('');
    setFormBeneficiario('');
    setFormComprobante('');
    setFormObservaciones('');
    setModalGastoOpen(false);
  };

  // Eliminar gasto
  const handleEliminarGasto = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este gasto registrado?')) {
      StorageService.deleteGasto(id);
      const updated = StorageService.getGastos();
      setGastos(updated);
      if (onEliminarGasto) {
        await onEliminarGasto(id);
      }
    }
  };

  // Filtrado de gastos para la tabla
  const gastosFiltrados = useMemo(() => {
    const q = busquedaGasto.toLowerCase().trim();
    return gastos.filter((g) => {
      const matchCat = filtroCategoria === 'TODAS' || g.categoria === filtroCategoria;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        g.descripcion.toLowerCase().includes(q) ||
        (g.beneficiario && g.beneficiario.toLowerCase().includes(q)) ||
        (g.nro_comprobante && g.nro_comprobante.toLowerCase().includes(q))
      );
    });
  }, [gastos, busquedaGasto, filtroCategoria]);

  // ================= CÁLCULOS DEL BALANCE GENERAL / P&L =================
  // Helper para saber si una fecha cae en el período seleccionado
  const fechaPerteneceAlPeriodo = (fechaRaw: string | undefined): boolean => {
    if (!fechaRaw) return false;
    let y = 0;
    let m = 0;

    if (fechaRaw.includes('-')) {
      const partes = fechaRaw.split('T')[0].split('-');
      y = parseInt(partes[0]);
      m = parseInt(partes[1]);
    } else if (fechaRaw.includes('/')) {
      const partes = fechaRaw.split('/');
      if (partes.length === 3) {
        y = parseInt(partes[2]);
        m = parseInt(partes[1]);
      }
    }

    if (!y || !m) return false;
    if (y !== anioSeleccionado) return false;

    if (modoPeriodo === 'ANUAL') {
      return true;
    } else if (modoPeriodo === 'MENSUAL') {
      return m === mesSeleccionado;
    } else if (modoPeriodo === 'TRIMESTRAL') {
      const q = Math.ceil(m / 3);
      return q === trimestreSeleccionado;
    }

    return false;
  };

  // Balance consolidado para el período
  const balancePeriodo = useMemo(() => {
    // 1. Ingresos por Ventas
    const ventasPeriodo = ventas.filter((v) => fechaPerteneceAlPeriodo(v.fecha));
    const totalIngresosUsd = redondearExacto(
      ventasPeriodo.reduce((acc, v) => acc + (v.total_usd || 0), 0),
      2
    );
    const totalIngresosBs = redondearExacto(
      ventasPeriodo.reduce((acc, v) => acc + (v.total_bs || (v.total_usd || 0) * (v.tasa_bcv || tasas.tasaBcv)), 0),
      2
    );

    // 2. Costo de Mercancía / Compras de Inventario
    const comprasPeriodo = compras.filter((c) =>
      fechaPerteneceAlPeriodo(c.fecha_emision || c.fecha_recepcion)
    );
    const totalComprasUsd = redondearExacto(
      comprasPeriodo.reduce((acc, c) => acc + (c.total || 0), 0),
      2
    );
    const totalComprasBs = redondearExacto(
      comprasPeriodo.reduce((acc, c) => acc + (c.total || 0) * (c.tasa_bcv || tasas.tasaBcv), 0),
      2
    );

    // 3. Utilidad Bruta = Ingresos - Compras
    const utilidadBrutaUsd = redondearExacto(totalIngresosUsd - totalComprasUsd, 2);
    const utilidadBrutaBs = redondearExacto(totalIngresosBs - totalComprasBs, 2);
    const margenBrutoPorcentaje =
      totalIngresosUsd > 0 ? redondearExacto((utilidadBrutaUsd / totalIngresosUsd) * 100, 1) : 0;

    // 4. Gastos Operativos Adicionales (Desglosados por categoría)
    const gastosPeriodo = gastos.filter((g) => fechaPerteneceAlPeriodo(g.fecha));
    const gastosPorCategoria: Record<CategoriaGasto, { usd: number; bs: number; count: number }> = {
      ALQUILER: { usd: 0, bs: 0, count: 0 },
      NOMINA_SUELDOS: { usd: 0, bs: 0, count: 0 },
      SERVICIOS_PUBLICOS: { usd: 0, bs: 0, count: 0 },
      FLETES_TRANSPORTE: { usd: 0, bs: 0, count: 0 },
      MANTENIMIENTO_REPARACIONES: { usd: 0, bs: 0, count: 0 },
      IMPUESTOS_PATENTES: { usd: 0, bs: 0, count: 0 },
      PUBLICIDAD_MARKETING: { usd: 0, bs: 0, count: 0 },
      INSUMOS_PAPELERIA: { usd: 0, bs: 0, count: 0 },
      MERMAS_PERDIDAS: { usd: 0, bs: 0, count: 0 },
      COMISIONES_BANCARIAS: { usd: 0, bs: 0, count: 0 },
      OTRO_GASTO: { usd: 0, bs: 0, count: 0 },
    };

    let totalGastosOperativosUsd = 0;
    let totalGastosOperativosBs = 0;

    gastosPeriodo.forEach((g) => {
      const cat = g.categoria || 'OTRO_GASTO';
      if (!gastosPorCategoria[cat]) {
        gastosPorCategoria[cat] = { usd: 0, bs: 0, count: 0 };
      }
      gastosPorCategoria[cat].usd += g.monto_usd;
      gastosPorCategoria[cat].bs += g.monto_bs;
      gastosPorCategoria[cat].count += 1;
      totalGastosOperativosUsd += g.monto_usd;
      totalGastosOperativosBs += g.monto_bs;
    });

    totalGastosOperativosUsd = redondearExacto(totalGastosOperativosUsd, 2);
    totalGastosOperativosBs = redondearExacto(totalGastosOperativosBs, 2);

    // 5. Utilidad Neta Real = Utilidad Bruta - Gastos Operativos
    const utilidadNetaUsd = redondearExacto(utilidadBrutaUsd - totalGastosOperativosUsd, 2);
    const utilidadNetaBs = redondearExacto(utilidadBrutaBs - totalGastosOperativosBs, 2);
    const margenNetoPorcentaje =
      totalIngresosUsd > 0 ? redondearExacto((utilidadNetaUsd / totalIngresosUsd) * 100, 1) : 0;

    return {
      totalIngresosUsd,
      totalIngresosBs,
      totalComprasUsd,
      totalComprasBs,
      utilidadBrutaUsd,
      utilidadBrutaBs,
      margenBrutoPorcentaje,
      gastosPorCategoria,
      totalGastosOperativosUsd,
      totalGastosOperativosBs,
      utilidadNetaUsd,
      utilidadNetaBs,
      margenNetoPorcentaje,
      numVentas: ventasPeriodo.length,
      numCompras: comprasPeriodo.length,
      numGastos: gastosPeriodo.length,
    };
  }, [ventas, compras, gastos, modoPeriodo, mesSeleccionado, trimestreSeleccionado, anioSeleccionado, tasas.tasaBcv]);

  // Texto legible del período seleccionado
  const etiquetaPeriodo = useMemo(() => {
    const mesesNombres = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    if (modoPeriodo === 'ANUAL') {
      return `Año Completo ${anioSeleccionado}`;
    } else if (modoPeriodo === 'TRIMESTRAL') {
      const trimNombres = ['Q1 (Enero - Marzo)', 'Q2 (Abril - Junio)', 'Q3 (Julio - Septiembre)', 'Q4 (Octubre - Diciembre)'];
      return `${trimNombres[trimestreSeleccionado - 1]} de ${anioSeleccionado}`;
    } else {
      return `${mesesNombres[mesSeleccionado - 1]} de ${anioSeleccionado}`;
    }
  }, [modoPeriodo, mesSeleccionado, trimestreSeleccionado, anioSeleccionado]);

  // Exportar Balance a PDF
  const handleExportarBalancePDF = () => {
    const doc = new jsPDF();
    const settings = StorageService.getSettings();

    // Encabezado
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(settings.empresaNombre || 'GOLOCHINAS 289', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`ESTADO FINANCIERO Y BALANCE DE RESULTADOS (${etiquetaPeriodo.toUpperCase()})`, 14, 19);

    // Metadata
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Período Evaluado: ${etiquetaPeriodo}`, 14, 33);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}`, 14, 38);
    doc.text(`Tasa Referencial BCV: Bs. ${formatearVE(tasas.tasaBcv)}`, 130, 33);

    // Tabla Resumen de Estado de Resultados
    const tablaResumen = [
      ['(+) Ingresos Brutos por Ventas Facturadas', `$ ${formatearVE(balancePeriodo.totalIngresosUsd)}`, `Bs. ${formatearVE(balancePeriodo.totalIngresosBs)}`, '100%'],
      ['(-) Costo de Mercancía / Compras Inventario', `-$ ${formatearVE(balancePeriodo.totalComprasUsd)}`, `-Bs. ${formatearVE(balancePeriodo.totalComprasBs)}`, `${balancePeriodo.totalIngresosUsd > 0 ? ((balancePeriodo.totalComprasUsd / balancePeriodo.totalIngresosUsd) * 100).toFixed(1) : 0}%`],
      ['(=) UTILIDAD BRUTA OPERATIVA', `$ ${formatearVE(balancePeriodo.utilidadBrutaUsd)}`, `Bs. ${formatearVE(balancePeriodo.utilidadBrutaBs)}`, `${balancePeriodo.margenBrutoPorcentaje}%`],
      ['(-) Gastos Operativos y Administrativos', `-$ ${formatearVE(balancePeriodo.totalGastosOperativosUsd)}`, `-Bs. ${formatearVE(balancePeriodo.totalGastosOperativosBs)}`, `${balancePeriodo.totalIngresosUsd > 0 ? ((balancePeriodo.totalGastosOperativosUsd / balancePeriodo.totalIngresosUsd) * 100).toFixed(1) : 0}%`],
      ['(=) UTILIDAD NETA FINAL DEL EJERCICIO', `$ ${formatearVE(balancePeriodo.utilidadNetaUsd)}`, `Bs. ${formatearVE(balancePeriodo.utilidadNetaBs)}`, `${balancePeriodo.margenNetoPorcentaje}%`],
    ];

    autoTable(doc, {
      startY: 44,
      head: [['Concepto Contable', 'Total USD ($)', 'Total Bolívares (Bs)', '% de Ventas']],
      body: tablaResumen,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 8;

    // Desglose de Gastos Operativos por Categoría
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Desglose Detallado de Gastos Operativos del Período:', 14, currentY);

    const tablaGastosDetalle = Object.entries(balancePeriodo.gastosPorCategoria)
      .filter(([_, datos]) => datos.usd > 0)
      .map(([cat, datos]) => [
        CATEGORIAS_GASTO_INFO[cat as CategoriaGasto]?.label || cat,
        `${datos.count} egreso(s)`,
        `$ ${formatearVE(datos.usd)}`,
        `Bs. ${formatearVE(datos.bs)}`,
        `${balancePeriodo.totalGastosOperativosUsd > 0 ? ((datos.usd / balancePeriodo.totalGastosOperativosUsd) * 100).toFixed(1) : 0}%`,
      ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [['Categoría de Gasto', 'Frecuencia', 'Monto ($)', 'Monto (Bs)', '% del Total Gastos']],
      body: tablaGastosDetalle.length > 0 ? tablaGastosDetalle : [['Sin gastos registrados en el período', '0', '$ 0,00', 'Bs. 0,00', '0%']],
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      foot: [
        [
          'TOTAL GASTOS OPERATIVOS',
          `${balancePeriodo.numGastos} egreso(s)`,
          `$ ${formatearVE(balancePeriodo.totalGastosOperativosUsd)}`,
          `Bs. ${formatearVE(balancePeriodo.totalGastosOperativosBs)}`,
          '100%',
        ],
      ],
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;

    // Firmas
    doc.line(20, finalY, 80, finalY);
    doc.line(130, finalY, 190, finalY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ELABORADO POR ADMINISTRACIÓN', 25, finalY + 5);
    doc.text('REVISADO POR JUNTA DIRECTIVA', 135, finalY + 5);

    doc.save(`Balance_General_${etiquetaPeriodo.replace(/[\s()]/g, '_')}.pdf`);
  };

  // Exportar lista de gastos a CSV
  const handleExportarGastosCSV = () => {
    const headers = ['ID', 'Fecha', 'Categoria', 'Descripcion', 'Monto_USD', 'Monto_BS', 'Tasa_BCV', 'Metodo_Pago', 'Beneficiario', 'Nro_Comprobante', 'Observaciones'];
    const rows = gastos.map((g) => [
      g.id,
      g.fecha,
      g.categoria,
      `"${g.descripcion.replace(/"/g, '""')}"`,
      g.monto_usd,
      g.monto_bs,
      g.tasa_bcv,
      g.metodo_pago,
      `"${(g.beneficiario || '').replace(/"/g, '""')}"`,
      `"${(g.nro_comprobante || '').replace(/"/g, '""')}"`,
      `"${(g.observaciones || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gastos_Operativos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Toolbar */}
      <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-black uppercase text-slate-900 tracking-wide">
              Gastos Operativos & Balance General
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Control de gastos que no son compras de mercancía (alquiler, nómina, luz, papelería) y estado financiero mensual, trimestral y anual.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTabActiva('gastos')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              tabActiva === 'gastos'
                ? 'bg-blue-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>REGISTRO DE GASTOS ({gastos.length})</span>
          </button>

          <button
            onClick={() => setTabActiva('balance')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              tabActiva === 'balance'
                ? 'bg-blue-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-300" />
            <span>BALANCE GENERAL & P&L</span>
          </button>

          <button
            onClick={() => setTabActiva('cuentas')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              tabActiva === 'cuentas'
                ? 'bg-blue-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-red-300" />
            <span>CUENTAS POR PAGAR</span>
          </button>
        </div>
        </section>

      {/* ================= TAB 1: REGISTRO Y GESTIÓN DE GASTOS ================= */}
      {tabActiva === 'gastos' && (
        <div className="space-y-4">
          {/* Action Row & KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                Total Gastos Registrados
              </span>
              <div className="my-1">
                <div className="text-2xl font-mono font-black text-rose-400">
                  $ {formatearVE(gastos.reduce((acc, g) => acc + g.monto_usd, 0))}
                </div>
                <div className="text-xs font-mono font-bold text-slate-400">
                  Bs. {formatearVE(gastos.reduce((acc, g) => acc + g.monto_bs, 0))}
                </div>
              </div>
              <span className="text-[9px] text-slate-400">{gastos.length} comprobantes de egreso</span>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                Gastos del Mes en Curso ({new Date().toLocaleString('es-VE', { month: 'long' })})
              </span>
              <div className="my-1">
                <div className="text-2xl font-mono font-black text-slate-800">
                  ${' '}
                  {formatearVE(
                    gastos
                      .filter((g) => fechaPerteneceAlPeriodo(g.fecha))
                      .reduce((acc, g) => acc + g.monto_usd, 0)
                  )}
                </div>
                <div className="text-xs font-mono font-bold text-slate-500">
                  Bs.{' '}
                  {formatearVE(
                    gastos
                      .filter((g) => fechaPerteneceAlPeriodo(g.fecha))
                      .reduce((acc, g) => acc + g.monto_bs, 0)
                  )}
                </div>
              </div>
              <span className="text-[9px] text-slate-400">Gastos deducibles en el balance</span>
            </div>

            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-blue-200 uppercase tracking-wide">
                  Acción Operativa
                </span>
                <h4 className="text-sm font-black mt-0.5">Registrar Nuevo Gasto</h4>
              </div>
              <button
                type="button"
                onClick={() => setModalGastoOpen(true)}
                className="mt-2 w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ REGISTRAR EGRESO / GASTO</span>
              </button>
            </div>
          </div>

          {/* Search, Category Filter & Export Controls */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={busquedaGasto}
                  onChange={(e) => setBusquedaGasto(e.target.value)}
                  placeholder="BUSCAR GASTO, BENEFICIARIO O FACTURA..."
                  className="w-full border-2 border-slate-300 bg-white p-2 pl-9 rounded-xl font-bold text-xs uppercase outline-none focus:border-blue-700"
                />
              </div>

              {/* Category Filter */}
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="border-2 border-slate-300 bg-white p-2 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-700"
              >
                <option value="TODAS">TODAS LAS CATEGORÍAS</option>
                {Object.entries(CATEGORIAS_GASTO_INFO).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.label.toUpperCase()}
                  </option>
                ))}
              </select>

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportarGastosCSV}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
                title="Exportar archivo CSV de gastos para auditoría"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>CSV</span>
              </button>
            </div>

            {/* Expenses Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-900 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">ID / Fecha</th>
                    <th className="p-2.5">Categoría</th>
                    <th className="p-2.5">Concepto / Descripción</th>
                    <th className="p-2.5">Beneficiario / Factura</th>
                    <th className="p-2.5 text-center">Método</th>
                    <th className="p-2.5 text-right">Monto ($)</th>
                    <th className="p-2.5 text-right">Monto (Bs)</th>
                    <th className="p-2.5 text-center">✕</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 uppercase">
                  {gastosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 italic font-medium">
                        No se encontraron gastos con ese criterio de búsqueda. Haz clic en "+ REGISTRAR EGRESO".
                      </td>
                    </tr>
                  ) : (
                    gastosFiltrados.map((g) => {
                      const catInfo = CATEGORIAS_GASTO_INFO[g.categoria] || CATEGORIAS_GASTO_INFO.OTRO_GASTO;
                      return (
                        <tr key={`${g.id}_${g.fecha}`} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 font-bold text-slate-800">
                            <div className="font-mono text-blue-900">{g.id}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {formatearFechaDDMMYYYY(g.fecha)}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black inline-flex items-center gap-1 ${catInfo.colorBg} ${catInfo.colorText} border border-slate-200`}
                            >
                              <span>{catInfo.icon}</span>
                              <span>{catInfo.label}</span>
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-slate-800">
                            <div>{g.descripcion}</div>
                            {g.observaciones && (
                              <div className="text-[10px] text-slate-400 normal-case italic">
                                {g.observaciones}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-600 font-medium">
                            <div>{g.beneficiario || '—'}</div>
                            {g.nro_comprobante && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Comp: {g.nro_comprobante}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-[10px] font-bold text-slate-600">
                            {g.metodo_pago}
                          </td>
                          <td className="p-2.5 font-mono text-right font-black text-rose-600">
                            $ {formatearVE(g.monto_usd)}
                          </td>
                          <td className="p-2.5 font-mono text-right font-black text-slate-700">
                            Bs. {formatearVE(g.monto_bs)}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => handleEliminarGasto(g.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                              title="Eliminar gasto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: BALANCE GENERAL & ESTADO DE RESULTADOS ================= */}
      {tabActiva === 'balance' && (
        <div className="space-y-4">
          {/* Selector de Período: Mensual / Trimestral / Anual */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-700" />
                <span>Modalidad del Balance:</span>
              </span>

              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setModoPeriodo('MENSUAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    modoPeriodo === 'MENSUAL'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📅 MENSUAL
                </button>
                <button
                  type="button"
                  onClick={() => setModoPeriodo('TRIMESTRAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    modoPeriodo === 'TRIMESTRAL'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📊 TRIMESTRAL (QUARTER)
                </button>
                <button
                  type="button"
                  onClick={() => setModoPeriodo('ANUAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    modoPeriodo === 'ANUAL'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🏛️ ANUAL (AÑO COMPLETO)
                </button>
              </div>
            </div>

            {/* Selectores específicos según modo */}
            <div className="flex items-center gap-2">
              {modoPeriodo === 'MENSUAL' && (
                <select
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(parseInt(e.target.value))}
                  className="border-2 border-slate-300 bg-white p-2 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-700"
                >
                  {[
                    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
                  ].map((m, i) => (
                    <option key={i + 1} value={i + 1}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
              )}

              {modoPeriodo === 'TRIMESTRAL' && (
                <select
                  value={trimestreSeleccionado}
                  onChange={(e) => setTrimestreSeleccionado(parseInt(e.target.value))}
                  className="border-2 border-slate-300 bg-white p-2 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-700"
                >
                  <option value={1}>TRIMESTRE 1 (Q1: ENE - MAR)</option>
                  <option value={2}>TRIMESTRE 2 (Q2: ABR - JUN)</option>
                  <option value={3}>TRIMESTRE 3 (Q3: JUL - SEP)</option>
                  <option value={4}>TRIMESTRE 4 (Q4: OCT - DIC)</option>
                </select>
              )}

              <select
                value={anioSeleccionado}
                onChange={(e) => setAnioSeleccionado(parseInt(e.target.value))}
                className="border-2 border-slate-300 bg-white p-2 rounded-xl text-xs font-black outline-none focus:border-blue-700"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    AÑO {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleExportarBalancePDF}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                title="Generar y descargar informe de Balance General en PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>EXPORTAR PDF</span>
              </button>
            </div>
          </div>

          {/* Tarjetas KPI de Estado de Resultados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Ingresos por Ventas */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                (+) Ventas Facturadas (Ingresos)
              </span>
              <div className="my-1">
                <div className="text-2xl font-mono font-black text-emerald-400">
                  $ {formatearVE(balancePeriodo.totalIngresosUsd)}
                </div>
                <div className="text-xs font-mono font-bold text-slate-400">
                  Bs. {formatearVE(balancePeriodo.totalIngresosBs)}
                </div>
              </div>
              <span className="text-[10px] text-slate-400">{balancePeriodo.numVentas} ventas en el período</span>
            </div>

            {/* Costo de Mercancía / Compras */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                (-) Costo de Mercancía (Compras)
              </span>
              <div className="my-1">
                <div className="text-2xl font-mono font-black text-slate-900">
                  $ {formatearVE(balancePeriodo.totalComprasUsd)}
                </div>
                <div className="text-xs font-mono font-bold text-slate-500">
                  Bs. {formatearVE(balancePeriodo.totalComprasBs)}
                </div>
              </div>
              <span className="text-[10px] text-slate-500">{balancePeriodo.numCompras} facturas de proveedores</span>
            </div>

            {/* Gastos Operativos y Administrativos */}
            <div className="bg-rose-50 p-4 rounded-2xl shadow-sm border border-rose-200">
              <span className="text-[10px] font-black text-rose-700 uppercase tracking-wide flex items-center justify-between">
                <span>(-) Gastos Operativos Totales</span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </span>
              <div className="my-1">
                <div className="text-2xl font-mono font-black text-rose-700">
                  -$ {formatearVE(balancePeriodo.totalGastosOperativosUsd)}
                </div>
                <div className="text-xs font-mono font-bold text-rose-600">
                  -Bs. {formatearVE(balancePeriodo.totalGastosOperativosBs)}
                </div>
              </div>
              <span className="text-[10px] text-rose-700">{balancePeriodo.numGastos} comprobantes de egreso</span>
            </div>

            {/* Utilidad Neta Real */}
            <div
              className={`p-4 rounded-2xl shadow-sm border ${
                balancePeriodo.utilidadNetaUsd >= 0
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-rose-600 text-white border-rose-700'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wide flex items-center justify-between">
                <span>(=) Utilidad Neta del Ejercicio</span>
                {balancePeriodo.utilidadNetaUsd >= 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-white" />
                )}
              </span>
              <div className="my-1">
                <div className="text-2xl font-mono font-black">
                  {balancePeriodo.utilidadNetaUsd >= 0 ? '+' : ''}${' '}
                  {formatearVE(balancePeriodo.utilidadNetaUsd)}
                </div>
                <div className="text-xs font-mono font-bold text-white/90">
                  {balancePeriodo.utilidadNetaBs >= 0 ? '+' : ''}Bs.{' '}
                  {formatearVE(balancePeriodo.utilidadNetaBs)}
                </div>
              </div>
              <span className="text-[10px] font-black uppercase">
                Margen Neto: {balancePeriodo.margenNetoPorcentaje}%
              </span>
            </div>
          </div>

          {/* Tabla Formal de Estado de Resultados (P&L) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-900">
                  Estado Financiero y Balance de Resultados • {etiquetaPeriodo}
                </h3>
                <p className="text-xs text-slate-500">
                  Cálculo contable de margen bruto, costos de reposición y margen neto real del negocio.
                </p>
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {/* Renglón 1: Ingresos */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 flex justify-between items-center">
                <div>
                  <span className="font-black text-emerald-950 font-sans text-xs">
                    (+) INGRESOS BRUTOS OPERATIVOS (VENTAS POS FACTURADAS)
                  </span>
                  <p className="text-[10px] text-slate-500 font-sans">
                    Total de ventas registradas en el sistema para este período.
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-black text-emerald-700 text-sm">
                    $ {formatearVE(balancePeriodo.totalIngresosUsd)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Bs. {formatearVE(balancePeriodo.totalIngresosBs)}
                  </div>
                </div>
              </div>

              {/* Renglón 2: Costo de Ventas */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="font-black text-slate-800 font-sans text-xs">
                    (-) COSTO DE MERCANCÍA / COMPRAS DE INVENTARIO
                  </span>
                  <p className="text-[10px] text-slate-500 font-sans">
                    Facturas y notas de recepción cargadas a proveedores en este período.
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-800 text-sm">
                    -$ {formatearVE(balancePeriodo.totalComprasUsd)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    -Bs. {formatearVE(balancePeriodo.totalComprasBs)}
                  </div>
                </div>
              </div>

              {/* Renglón 3: Utilidad Bruta */}
              <div className="p-3 bg-blue-50 rounded-xl border-2 border-blue-200 flex justify-between items-center">
                <div>
                  <span className="font-black text-blue-950 font-sans text-xs">
                    (=) UTILIDAD BRUTA OPERATIVA
                  </span>
                  <p className="text-[10px] text-blue-700 font-sans font-bold">
                    Margen Bruto de Ganancia: {balancePeriodo.margenBrutoPorcentaje}%
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-black text-blue-900 text-sm">
                    $ {formatearVE(balancePeriodo.utilidadBrutaUsd)}
                  </div>
                  <div className="text-[10px] text-blue-700">
                    Bs. {formatearVE(balancePeriodo.utilidadBrutaBs)}
                  </div>
                </div>
              </div>

              {/* Renglón 4: Desglose de Gastos Operativos */}
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2">
                <div className="flex justify-between items-center border-b border-rose-200 pb-1.5">
                  <span className="font-black text-rose-950 font-sans text-xs">
                    (-) GASTOS OPERATIVOS Y ADMINISTRATIVOS (NO COMPRAS)
                  </span>
                  <div className="text-right">
                    <span className="font-black text-rose-700 text-sm">
                      -$ {formatearVE(balancePeriodo.totalGastosOperativosUsd)}
                    </span>
                    <span className="text-[10px] text-rose-600 block">
                      -Bs. {formatearVE(balancePeriodo.totalGastosOperativosBs)}
                    </span>
                  </div>
                </div>

                {/* Sub-renglones por categoría */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-sans">
                  {Object.entries(balancePeriodo.gastosPorCategoria).map(([catKey, datos]) => {
                    const info = CATEGORIAS_GASTO_INFO[catKey as CategoriaGasto];
                    if (datos.usd <= 0) return null;
                    return (
                      <div
                        key={catKey}
                        className="bg-white p-2 rounded-lg border border-rose-100 flex justify-between items-center text-xs"
                      >
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <span>{info?.icon}</span>
                          <span>{info?.label}</span>
                        </span>
                        <span className="font-mono font-black text-rose-700">
                          $ {formatearVE(datos.usd)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Renglón 5: Utilidad Neta Final */}
              <div
                className={`p-4 rounded-xl border-2 flex justify-between items-center ${
                  balancePeriodo.utilidadNetaUsd >= 0
                    ? 'bg-emerald-100/60 border-emerald-500 text-emerald-950'
                    : 'bg-rose-100/60 border-rose-500 text-rose-950'
                }`}
              >
                <div>
                  <span className="font-black font-sans text-sm block">
                    (=) UTILIDAD NETA FINAL DEL EJERCICIO (GANANCIA / PÉRDIDA NETA)
                  </span>
                  <p className="text-xs font-sans font-bold mt-0.5">
                    Margen Neto Real: {balancePeriodo.margenNetoPorcentaje}% de los ingresos
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-black text-xl">
                    {balancePeriodo.utilidadNetaUsd >= 0 ? '+' : ''}${' '}
                    {formatearVE(balancePeriodo.utilidadNetaUsd)}
                  </div>
                  <div className="text-xs font-bold">
                    {balancePeriodo.utilidadNetaBs >= 0 ? '+' : ''}Bs.{' '}
                    {formatearVE(balancePeriodo.utilidadNetaBs)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: REGISTRAR NUEVO GASTO ================= */}
      {modalGastoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-sm uppercase">Registrar Nuevo Gasto Operativo</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalGastoOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarNuevoGasto} className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
              <p className="text-slate-500 font-medium">
                Registra cualquier desembolso que no corresponda a compras de inventario (nómina, alquiler, servicios, papelería).
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-black uppercase text-slate-700 block mb-1">Fecha del Gasto:</label>
                  <input
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-bold outline-none focus:border-blue-700"
                  />
                </div>

                <div>
                  <label className="font-black uppercase text-slate-700 block mb-1">Libro:</label>
                  <select
                    value={formLibro}
                    onChange={(e) => setFormLibro(e.target.value as any)}
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-bold outline-none focus:border-blue-700"
                  >
                    <option value="FISCAL">FISCAL</option>
                    <option value="PRIVADO">PRIVADO</option>
                  </select>
                </div>

                <div>
                  <label className="font-black uppercase text-slate-700 block mb-1">Categoría:</label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value as CategoriaGasto)}
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-bold outline-none focus:border-blue-700"
                  >
                    {Object.entries(CATEGORIAS_GASTO_INFO).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.icon} {info.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-black uppercase text-slate-700 block mb-1">
                  Concepto / Descripción del Gasto: *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="EJ: PAGO DE ALQUILER LOCAL COMERCIAL MES ACTUAL"
                  className="w-full border-2 border-slate-300 p-2.5 rounded-xl font-bold uppercase outline-none focus:border-blue-700"
                />
              </div>

              {/* Montos en USD y Bs */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="font-black uppercase text-slate-700 block mb-1">Monto en USD ($): *</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 font-black text-slate-400">$</span>
                    <input
                      type="number"
                      step="any"
                      value={formMontoUsd}
                      onChange={(e) => handleMontoUsdChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full border-2 border-slate-300 bg-white p-2 pl-7 rounded-xl font-mono font-black text-xs outline-none focus:border-blue-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-black uppercase text-slate-700 block mb-1">Equivalente en Bs:</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 font-black text-slate-400">Bs.</span>
                    <input
                      type="number"
                      step="any"
                      value={formMontoBs}
                      onChange={(e) => handleMontoBsChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full border-2 border-slate-300 bg-white p-2 pl-8 rounded-xl font-mono font-black text-xs outline-none focus:border-blue-700"
                    />
                  </div>
                </div>
                <div className="col-span-2 text-[10px] text-slate-500 font-bold">
                  Tasa referencial BCV: Bs. {formatearVE(tasas.tasaBcv)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-black uppercase text-slate-700 block mb-1">Método de Pago:</label>
                  <select
                    value={formMetodoPago}
                    onChange={(e) => setFormMetodoPago(e.target.value)}
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-bold outline-none focus:border-blue-700"
                  >
                    {METODOS_PAGO_GASTO.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-black uppercase text-slate-700 block mb-1">Nro. de Factura / Recibo:</label>
                  <input
                    type="text"
                    value={formComprobante}
                    onChange={(e) => setFormComprobante(e.target.value)}
                    placeholder="Ej: REC-0091"
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-bold uppercase outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-black uppercase text-slate-700 block mb-1">
                  Beneficiario / Proveedor del Servicio:
                </label>
                <input
                  type="text"
                  value={formBeneficiario}
                  onChange={(e) => setFormBeneficiario(e.target.value)}
                  placeholder="EJ: CORPOELEC / PROPIETARIO DEL LOCAL"
                  className="w-full border-2 border-slate-300 p-2 rounded-xl font-bold uppercase outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="font-black uppercase text-slate-700 block mb-1">Observaciones:</label>
                <textarea
                  rows={2}
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  placeholder="Detalles adicionales del pago..."
                  className="w-full border-2 border-slate-300 p-2 rounded-xl font-medium outline-none focus:border-blue-700"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalGastoOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>GUARDAR GASTO</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= TAB 3: CUENTAS POR PAGAR ================= */}
      {tabActiva === 'cuentas' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-red-600" />
              Cuentas por Pagar (Compras a Crédito Pendientes)
            </h2>
            <button
              onClick={() => {
                const area = document.getElementById('area-impresion');
                if (!area) return;

                const comprasPendientes = compras.filter((c) => (c.total - (c.abonado_usd || 0)) > 0.01);
                
                // Group by provider
                const agrupadas = comprasPendientes.reduce((acc, c) => {
                    if (!acc[c.proveedor]) acc[c.proveedor] = [];
                    acc[c.proveedor].push(c);
                    return acc;
                }, {} as Record<string, typeof compras>);

                let html = `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h1 style="text-align: center; border-bottom: 2px solid #334155; padding-bottom: 10px;">Reporte de Cuentas por Pagar</h1>
                        <p style="text-align: center; color: #64748b;">Fecha de emisión: ${new Date().toLocaleDateString()}</p>
                `;

                Object.entries(agrupadas).forEach(([proveedor, items]) => {
                    html += `
                        <h2 style="margin-top: 20px; border-left: 4px solid #ef4444; padding-left: 10px;">${proveedor}</h2>
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
                            <thead>
                                <tr style="background: #f1f5f9;">
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Documento</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Vencimiento</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">Monto Pendiente</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    items.forEach(c => {
                        html += `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #e2e8f0;">${c.nro_doc}</td>
                                <td style="padding: 8px; border: 1px solid #e2e8f0;">${c.fecha_vencimiento}</td>
                                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">$ ${formatearVE(c.total - (c.abonado_usd || 0))}</td>
                            </tr>
                        `;
                    });
                    html += `</tbody></table>`;
                });

                html += `</div>`;

                area.innerHTML = html;
                window.print();
                area.innerHTML = ''; // Clear after print
              }}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-[10px] px-3 py-1.5 rounded-lg transition"
            >
              <Printer className="w-3 h-3" />
              IMPRIMIR
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800 text-white uppercase font-black text-[10px]">
                <tr>
                  <th className="p-2.5">Proveedor</th>
                  <th className="p-2.5">Documento</th>
                  <th className="p-2.5">Vencimiento</th>
                  <th className="p-2.5 text-right">Deuda Pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold uppercase">
                {compras
                  .filter((c) => (c.total - (c.abonado_usd || 0)) > 0.01)
                  .map((c, i) => (
                    <tr key={`${c.id_registro}_${i}`} className="hover:bg-slate-50">
                      <td className="p-2.5">{c.proveedor}</td>
                      <td className="p-2.5 text-slate-600">{c.nro_doc}</td>
                      <td className="p-2.5 text-slate-600">{c.fecha_vencimiento}</td>
                      <td className="p-2.5 text-right text-red-700 font-mono font-black">
                        $ {formatearVE(c.total - (c.abonado_usd || 0))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
