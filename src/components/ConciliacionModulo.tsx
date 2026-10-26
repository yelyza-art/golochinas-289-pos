import React, { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Printer,
  FileText,
  Save,
  Trash2,
  Eye,
  RefreshCw,
  Plus,
  HelpCircle,
  Clock,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sliders,
  Download,
} from 'lucide-react';
import {
  CierreCajaConciliacion,
  DesgloseMetodoPago,
  TipoMetodoConciliacion,
  VentaRegistro,
  TasasCambio,
} from '../types';
import { StorageService, ComisionesConfig } from '../services/storage';
import { formatearVE, redondearExacto, formatearFechaDDMMYYYY } from '../utils/formatters';
import { imprimirCierreCajaTicket } from '../utils/printHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ConciliacionModuloProps {
  ventas: VentaRegistro[];
  tasas: TasasCambio;
  onGuardarCierre?: (cierre: CierreCajaConciliacion) => Promise<void>;
}

const BANCOS_VENEZUELA = [
  'Banesco',
  'Banco de Venezuela (BDV)',
  'Mercantil',
  'Bancamiga',
  'Banco Provincial (BBVA)',
  'Banco Nacional de Crédito (BNC)',
  'Bancaribe',
  'Banco Exterior',
  '100% Banco',
  'Otro Banco',
];

const METODOS_BASE: { metodo: TipoMetodoConciliacion; nombre: string; esPunto: boolean; esEfectivo: boolean }[] = [
  { metodo: 'DEBITO', nombre: 'Punto Débito (Nacional / Maestro)', esPunto: true, esEfectivo: false },
  { metodo: 'CREDITO', nombre: 'Punto Crédito (Visa / Mastercard / Intl)', esPunto: true, esEfectivo: false },
  { metodo: 'PAGO_MOVIL', nombre: 'Pago Móvil Interbancario (P2P / C2P)', esPunto: false, esEfectivo: false },
  { metodo: 'BIOPAGO', nombre: 'Biopago BDV / Código QR', esPunto: true, esEfectivo: false },
  { metodo: 'EFECTIVO_USD', nombre: 'Efectivo en Divisas ($ USD Cash en Gaveta)', esPunto: false, esEfectivo: true },
  { metodo: 'EFECTIVO_BS', nombre: 'Efectivo en Bolívares (Bs Cash en Gaveta)', esPunto: false, esEfectivo: true },
  { metodo: 'TRANSFERENCIA', nombre: 'Transferencias Bancarias Directas', esPunto: false, esEfectivo: false },
];

export const ConciliacionModulo: React.FC<ConciliacionModuloProps> = ({
  ventas,
  tasas,
  onGuardarCierre,
}) => {
  const [tabActiva, setTabActiva] = useState<'nuevo' | 'historial' | 'config'>('nuevo');

  // Configuración de comisiones bancarias
  const [comisionesConfig, setComisionesConfig] = useState<ComisionesConfig>(() =>
    StorageService.getComisionesConfig()
  );

  // Historial de cierres guardados
  const [historialCierres, setHistorialCierres] = useState<CierreCajaConciliacion[]>(() =>
    StorageService.getConciliaciones()
  );

  // Fecha seleccionada para el cierre (YYYY-MM-DD)
  const hoyIso = new Date().toISOString().split('T')[0];
  const [fechaCierre, setFechaCierre] = useState<string>(hoyIso);

  // Datos generales del cierre
  const [cajero, setCajero] = useState<string>('CAJERO PRINCIPAL');
  const [bancoSeleccionado, setBancoSeleccionado] = useState<string>('Banesco');
  const [nroLote, setNroLote] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // Cierre seleccionado para modal de detalle
  const [cierreSeleccionado, setCierreSeleccionado] = useState<CierreCajaConciliacion | null>(null);

  // Estado del formulario de conciliación: valores ingresados por el usuario
  const [valoresIngresados, setValoresIngresados] = useState<
    Record<
      TipoMetodoConciliacion,
      {
        montoLotePosBs: string;
        montoLotePosUsd: string;
        tasaComisionPorcentaje: number;
      }
    >
  >(() => {
    const init: any = {};
    METODOS_BASE.forEach((m) => {
      let tasaCom = 0;
      if (m.metodo === 'DEBITO') tasaCom = comisionesConfig.debito;
      else if (m.metodo === 'CREDITO') tasaCom = comisionesConfig.credito;
      else if (m.metodo === 'PAGO_MOVIL') tasaCom = comisionesConfig.pagoMovil;
      else if (m.metodo === 'BIOPAGO') tasaCom = comisionesConfig.biopago;

      init[m.metodo] = {
        montoLotePosBs: '',
        montoLotePosUsd: '',
        tasaComisionPorcentaje: tasaCom,
      };
    });
    return init;
  });

  // Ventas registradas en el sistema para la fecha seleccionada
  const ventasFiltradas = useMemo(() => {
    // Normalizar fecha de venta en formatos DD/MM/YYYY o YYYY-MM-DD
    const [y, m, d] = fechaCierre.split('-');
    const fechaDDMMYYYY = `${d}/${m}/${y}`;
    const fechaDDMMYYYY_sinCeros = `${parseInt(d)}/${parseInt(m)}/${y}`;

    return ventas.filter((v) => {
      if (!v.fecha) return false;
      const vFecha = v.fecha.trim();
      return (
        vFecha === fechaCierre ||
        vFecha === fechaDDMMYYYY ||
        vFecha === fechaDDMMYYYY_sinCeros ||
        vFecha.startsWith(fechaCierre)
      );
    });
  }, [ventas, fechaCierre]);

  // Totales del sistema para el día
  const totalSistemaDelDia = useMemo(() => {
    const usd = ventasFiltradas.reduce((acc, v) => acc + (v.total_usd || 0), 0);
    const bs = ventasFiltradas.reduce((acc, v) => acc + (v.total_bs || 0), 0);
    return {
      usd: redondearExacto(usd, 2),
      bs: redondearExacto(bs > 0 ? bs : usd * tasas.tasaBcv, 2),
    };
  }, [ventasFiltradas, tasas.tasaBcv]);

  // Cargar montos del sistema automáticamente en el formulario
  const handleAutoCargarSistema = () => {
    // Si no hay ventas, avisar
    if (ventasFiltradas.length === 0) {
      alert(`No se encontraron ventas registradas en el sistema para la fecha ${fechaCierre}.`);
      return;
    }

    // Por defecto, sugerir todo a Débito si no se desglosó por método
    const totalBs = totalSistemaDelDia.bs;
    const totalUsd = totalSistemaDelDia.usd;

    setValoresIngresados((prev) => ({
      ...prev,
      DEBITO: {
        ...prev.DEBITO,
        montoLotePosBs: String(totalBs),
        montoLotePosUsd: String(totalUsd),
      },
    }));
  };

  // Manejo de cambios en el monto ingresado
  const handleMontoChange = (
    metodo: TipoMetodoConciliacion,
    moneda: 'Bs' | 'USD',
    valor: string
  ) => {
    const num = parseFloat(valor) || 0;
    setValoresIngresados((prev) => {
      const current = prev[metodo];
      let nuevoBs = current.montoLotePosBs;
      let nuevoUsd = current.montoLotePosUsd;

      if (moneda === 'Bs') {
        nuevoBs = valor;
        nuevoUsd = num > 0 ? String(redondearExacto(num / (tasas.tasaBcv || 1), 2)) : '';
      } else {
        nuevoUsd = valor;
        nuevoBs = num > 0 ? String(redondearExacto(num * (tasas.tasaBcv || 1), 2)) : '';
      }

      return {
        ...prev,
        [metodo]: {
          ...current,
          montoLotePosBs: nuevoBs,
          montoLotePosUsd: nuevoUsd,
        },
      };
    });
  };

  const handleTasaComisionChange = (metodo: TipoMetodoConciliacion, valor: string) => {
    const num = parseFloat(valor) || 0;
    setValoresIngresados((prev) => ({
      ...prev,
      [metodo]: {
        ...prev[metodo],
        tasaComisionPorcentaje: num,
      },
    }));
  };

  // Cálculo del desglose completo en tiempo real
  const desgloseCalculado = useMemo<DesgloseMetodoPago[]>(() => {
    return METODOS_BASE.map((m) => {
      const datos = valoresIngresados[m.metodo] || {
        montoLotePosBs: '',
        montoLotePosUsd: '',
        tasaComisionPorcentaje: 0,
      };

      const montoLotePosBs = parseFloat(datos.montoLotePosBs) || 0;
      const montoLotePosUsd =
        parseFloat(datos.montoLotePosUsd) ||
        (montoLotePosBs > 0 ? redondearExacto(montoLotePosBs / (tasas.tasaBcv || 1), 2) : 0);

      // Si es débito y el usuario cargó todo el sistema, o según método
      let montoSistemaBs = 0;
      let montoSistemaUsd = 0;
      if (m.metodo === 'DEBITO') {
        montoSistemaBs = totalSistemaDelDia.bs;
        montoSistemaUsd = totalSistemaDelDia.usd;
      }

      // Comisión bancaria cobrada
      const tasaCom = datos.tasaComisionPorcentaje || 0;
      const comisionBs = redondearExacto((montoLotePosBs * tasaCom) / 100, 2);
      const comisionUsd = redondearExacto((montoLotePosUsd * tasaCom) / 100, 2);

      // Lo que realmente cae en la cuenta del banco
      const montoNetoBancoBs = redondearExacto(Math.max(0, montoLotePosBs - comisionBs), 2);
      const montoNetoBancoUsd = redondearExacto(Math.max(0, montoLotePosUsd - comisionUsd), 2);

      // Diferencia (Lote POS / Real vs Sistema)
      const diferenciaBs = redondearExacto(montoLotePosBs - montoSistemaBs, 2);
      const diferenciaUsd = redondearExacto(montoLotePosUsd - montoSistemaUsd, 2);

      return {
        metodo: m.metodo,
        nombreLegible: m.nombre,
        montoSistemaBs,
        montoSistemaUsd,
        montoLotePosBs,
        montoLotePosUsd,
        tasaComisionPorcentaje: tasaCom,
        comisionBs,
        comisionUsd,
        montoNetoBancoBs,
        montoNetoBancoUsd,
        diferenciaBs,
        diferenciaUsd,
      };
    });
  }, [valoresIngresados, totalSistemaDelDia, tasas.tasaBcv]);

  // Totales consolidados de la conciliación
  const totalesConsolidados = useMemo(() => {
    let totalLotePosBs = 0;
    let totalLotePosUsd = 0;
    let totalComisionesBs = 0;
    let totalComisionesUsd = 0;
    let totalNetoBancoBs = 0;
    let totalNetoBancoUsd = 0;

    desgloseCalculado.forEach((d) => {
      totalLotePosBs += d.montoLotePosBs;
      totalLotePosUsd += d.montoLotePosUsd;
      totalComisionesBs += d.comisionBs;
      totalComisionesUsd += d.comisionUsd;
      totalNetoBancoBs += d.montoNetoBancoBs;
      totalNetoBancoUsd += d.montoNetoBancoUsd;
    });

    const totalSistemaBs = totalSistemaDelDia.bs;
    const totalSistemaUsd = totalSistemaDelDia.usd;

    // Diferencia Neta Final entre lo reportado en cierre vs lo facturado en sistema
    const diferenciaNetaBs = redondearExacto(totalLotePosBs - totalSistemaBs, 2);
    const diferenciaNetaUsd = redondearExacto(totalLotePosUsd - totalSistemaUsd, 2);

    let estadoDiferencia: 'CUADRADO' | 'SOBRANTE' | 'FALTANTE' = 'CUADRADO';
    if (Math.abs(diferenciaNetaBs) < 0.5) {
      estadoDiferencia = 'CUADRADO';
    } else if (diferenciaNetaBs > 0) {
      estadoDiferencia = 'SOBRANTE';
    } else {
      estadoDiferencia = 'FALTANTE';
    }

    return {
      totalLotePosBs: redondearExacto(totalLotePosBs, 2),
      totalLotePosUsd: redondearExacto(totalLotePosUsd, 2),
      totalComisionesBs: redondearExacto(totalComisionesBs, 2),
      totalComisionesUsd: redondearExacto(totalComisionesUsd, 2),
      totalNetoBancoBs: redondearExacto(totalNetoBancoBs, 2),
      totalNetoBancoUsd: redondearExacto(totalNetoBancoUsd, 2),
      totalSistemaBs,
      totalSistemaUsd,
      diferenciaNetaBs,
      diferenciaNetaUsd,
      estadoDiferencia,
    };
  }, [desgloseCalculado, totalSistemaDelDia]);

  // Guardar Cierre de Caja y Conciliación
  const handleGuardarCierre = async () => {
    if (totalesConsolidados.totalLotePosBs <= 0 && totalesConsolidados.totalSistemaBs <= 0) {
      alert('Debes ingresar al menos un monto en el cierre de caja o contar con ventas registradas.');
      return;
    }

    const ahora = new Date();
    const idCorrelativo = `CIERRE-${fechaCierre.replace(/-/g, '')}-${String(
      historialCierres.length + 1
    ).padStart(3, '0')}`;

    const nuevoCierre: CierreCajaConciliacion = {
      id: idCorrelativo,
      fecha: fechaCierre,
      hora: ahora.toLocaleTimeString('es-VE'),
      cajero: cajero.trim().toUpperCase() || 'CAJERO PRINCIPAL',
      banco: bancoSeleccionado,
      nroLote: nroLote.trim() || 'S/N',
      tasaBcv: tasas.tasaBcv,
      totalSistemaBs: totalesConsolidados.totalSistemaBs,
      totalSistemaUsd: totalesConsolidados.totalSistemaUsd,
      totalLotePosBs: totalesConsolidados.totalLotePosBs,
      totalLotePosUsd: totalesConsolidados.totalLotePosUsd,
      totalComisionesBs: totalesConsolidados.totalComisionesBs,
      totalComisionesUsd: totalesConsolidados.totalComisionesUsd,
      totalRetencionesBs: 0,
      totalRetencionesUsd: 0,
      totalNetoBancoBs: totalesConsolidados.totalNetoBancoBs,
      totalNetoBancoUsd: totalesConsolidados.totalNetoBancoUsd,
      diferenciaNetaBs: totalesConsolidados.diferenciaNetaBs,
      diferenciaNetaUsd: totalesConsolidados.diferenciaNetaUsd,
      estadoDiferencia: totalesConsolidados.estadoDiferencia,
      desglose: desgloseCalculado,
      observaciones: observaciones.trim(),
      fechaCreacionIso: ahora.toISOString(),
    };

    StorageService.addConciliacion(nuevoCierre);
    const updated = StorageService.getConciliaciones();
    setHistorialCierres(updated);

    if (onGuardarCierre) {
      await onGuardarCierre(nuevoCierre);
    }

    alert(`✅ Cierre de caja #${nuevoCierre.id} registrado y conciliado exitosamente.`);
    // Imprimir automáticamente comprobante térmico
    imprimirCierreCajaTicket(nuevoCierre, StorageService.getSettings().formatoImpresora);
  };

  // Guardar configuración de comisiones
  const handleGuardarConfigComisiones = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveComisionesConfig(comisionesConfig);
    alert('✅ Tasas de comisión bancaria guardadas correctamente.');
    setTabActiva('nuevo');
  };

  // Exportar Conciliación a PDF
  const handleExportarPDF = (cierre: CierreCajaConciliacion) => {
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
    doc.text(`COMPROBANTE OFICIAL DE CIERRE DE CAJA Y CONCILIACIÓN POS - ${cierre.id}`, 14, 19);

    // Datos generales
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Fecha del Cierre: ${cierre.fecha} ${cierre.hora}`, 14, 33);
    doc.text(`Cajero / Responsable: ${cierre.cajero}`, 14, 38);
    doc.text(`Banco Adquirente: ${cierre.banco}`, 110, 33);
    doc.text(`Nro de Lote POS: ${cierre.nroLote || 'N/A'}`, 110, 38);
    doc.text(`Tasa Oficial BCV: Bs. ${formatearVE(cierre.tasaBcv)}`, 14, 43);

    // Tabla de desglose
    const tablaData = cierre.desglose
      .filter((d) => d.montoLotePosBs > 0 || d.montoSistemaBs > 0)
      .map((d) => [
        d.nombreLegible,
        `Bs. ${formatearVE(d.montoSistemaBs)}`,
        `Bs. ${formatearVE(d.montoLotePosBs)}`,
        `${d.tasaComisionPorcentaje}%`,
        `-Bs. ${formatearVE(d.comisionBs)}`,
        `Bs. ${formatearVE(d.montoNetoBancoBs)}`,
        `${d.diferenciaBs >= 0 ? '+' : ''}Bs. ${formatearVE(d.diferenciaBs)}`,
      ]);

    autoTable(doc, {
      startY: 48,
      head: [
        [
          'Método / Tarjeta',
          'Sistema (Bs)',
          'Lote POS (Bs)',
          '% Comis.',
          'Comisión (Bs)',
          'Neto Banco (Bs)',
          'Diferencia (Bs)',
        ],
      ],
      body: tablaData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      foot: [
        [
          'TOTALES CONSOLIDADOS',
          `Bs. ${formatearVE(cierre.totalSistemaBs)}`,
          `Bs. ${formatearVE(cierre.totalLotePosBs)}`,
          '—',
          `-Bs. ${formatearVE(cierre.totalComisionesBs)}`,
          `Bs. ${formatearVE(cierre.totalNetoBancoBs)}`,
          `${cierre.diferenciaNetaBs >= 0 ? '+' : ''}Bs. ${formatearVE(cierre.diferenciaNetaBs)}`,
        ],
      ],
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;

    // Cuadro de Resultado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const estadoTexto =
      cierre.estadoDiferencia === 'CUADRADO'
        ? 'RESULTADO: CAJA CUADRADA EXACTA (DIFERENCIA Bs. 0,00)'
        : cierre.estadoDiferencia === 'SOBRANTE'
        ? `RESULTADO: SOBRANTE EN CAJA (+Bs. ${formatearVE(cierre.diferenciaNetaBs)} / +$${formatearVE(cierre.diferenciaNetaUsd)})`
        : `RESULTADO: FALTANTE EN CAJA (-Bs. ${formatearVE(Math.abs(cierre.diferenciaNetaBs))} / -$${formatearVE(Math.abs(cierre.diferenciaNetaUsd))})`;

    doc.text(estadoTexto, 14, finalY);

    if (cierre.observaciones) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Observaciones: ${cierre.observaciones}`, 14, finalY + 6);
    }

    // Firmas
    const firmasY = finalY + 28;
    doc.line(20, firmasY, 80, firmasY);
    doc.line(130, firmasY, 190, firmasY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('FIRMA DEL CAJERO', 35, firmasY + 5);
    doc.text('FIRMA DEL SUPERVISOR', 145, firmasY + 5);

    doc.save(`Conciliacion_${cierre.id}.pdf`);
  };

  // Exportar Conciliación Actual del Formulario (del Día) directamente a PDF
  const handleExportarConciliacionActual = () => {
    const ahora = new Date();
    const idTemp = `CIERRE-${fechaCierre.replace(/-/g, "")}-DRAFT`;
    const cierrePreview: CierreCajaConciliacion = {
      id: idTemp,
      fecha: fechaCierre,
      hora: ahora.toLocaleTimeString("es-VE"),
      cajero: cajero.trim().toUpperCase() || "CAJERO PRINCIPAL",
      banco: bancoSeleccionado,
      nroLote: nroLote.trim() || "S/N",
      tasaBcv: tasas.tasaBcv,
      totalSistemaBs: totalesConsolidados.totalSistemaBs,
      totalSistemaUsd: totalesConsolidados.totalSistemaUsd,
      totalLotePosBs: totalesConsolidados.totalLotePosBs,
      totalLotePosUsd: totalesConsolidados.totalLotePosUsd,
      totalComisionesBs: totalesConsolidados.totalComisionesBs,
      totalComisionesUsd: totalesConsolidados.totalComisionesUsd,
      totalRetencionesBs: 0,
      totalRetencionesUsd: 0,
      totalNetoBancoBs: totalesConsolidados.totalNetoBancoBs,
      totalNetoBancoUsd: totalesConsolidados.totalNetoBancoUsd,
      diferenciaNetaBs: totalesConsolidados.diferenciaNetaBs,
      diferenciaNetaUsd: totalesConsolidados.diferenciaNetaUsd,
      estadoDiferencia: totalesConsolidados.estadoDiferencia,
      desglose: desgloseCalculado,
      observaciones: observaciones.trim() || "Comprobante diario de arqueo de caja y lote de tarjetas emitido desde el punto.",
      fechaCreacionIso: ahora.toISOString(),
    };
    handleExportarPDF(cierrePreview);
  };

  const handleEliminarCierre = (id: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el registro de conciliación ${id}?`)) {
      StorageService.deleteConciliacion(id);
      setHistorialCierres(StorageService.getConciliaciones());
    }
  };

  const handleExportarSeniatCSV = () => {
    const ventasFiscales = ventas.filter(v => v.libro === 'FISCAL');
    const gastos = StorageService.getGastos();
    const gastosFiscales = gastos.filter(g => g.libro === 'FISCAL');

    const csvRows = [];
    csvRows.push(['FECHA', 'TIPO', 'NRO_DOC', 'DESCRIPCION', 'TOTAL_BS', 'BASE_BS', 'IVA_BS', 'LIBRO']);

    ventasFiscales.forEach(v => {
      const iva = v.total_bs * 0.16 / 1.16;
      const base = v.total_bs - iva;
      csvRows.push([v.fecha, 'VENTA', v.id_venta, v.cliente, v.total_bs.toFixed(2), base.toFixed(2), iva.toFixed(2), 'FISCAL']);
    });

    gastosFiscales.forEach(g => {
       csvRows.push([g.fecha, 'GASTO', g.nro_comprobante || 'S/N', g.descripcion, g.monto_bs.toFixed(2), '0.00', '0.00', 'FISCAL']);
    });

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_SENIAT_FISCAL_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Navigation */}
      <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-900" />
            <h2 className="text-base sm:text-lg font-black uppercase text-blue-950 tracking-wide">
              Conciliaciones Bancarias & Cierre de Caja POS
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Control exacto del cierre de lote del punto de venta, desglose por tarjeta (débito/crédito), comisiones bancarias deducidas y abono neto en banco.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportarConciliacionActual}
            className="px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            title="Descargar reporte oficial de conciliación bancaria y cierre del día en PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>EXPORTAR PDF DEL DÍA</span>
          </button>

          <button
            onClick={() => setTabActiva('nuevo')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              tabActiva === 'nuevo'
                ? 'bg-blue-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>NUEVO CIERRE / ARQUEO</span>
          </button>

          <button
            onClick={() => setTabActiva('historial')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              tabActiva === 'historial'
                ? 'bg-blue-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>HISTORIAL CIERRES ({historialCierres.length})</span>
          </button>

          <button
            onClick={() => setTabActiva('config')}
            className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              tabActiva === 'config'
                ? 'bg-blue-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Configurar tasas de comisión bancaria para débito, crédito y pago móvil"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">COMISIONES</span>
          </button>
        </div>
      </section>

      {/* ================= VISTA 1: NUEVO CIERRE / ARQUEO ================= */}
      {tabActiva === 'nuevo' && (
        <div className="space-y-4">
          {/* Fila de Datos de Cabecera del Cierre */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-700" />
                <span>Datos del Cierre de Caja y Punto de Venta</span>
              </span>

              <button
                type="button"
                onClick={handleAutoCargarSistema}
                className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Cargar automáticamente el total vendido en sistema para esta fecha"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                <span>Auto-Cargar Ventas del Sistema ({ventasFiltradas.length} Facturas)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Fecha del Cierre:
                </label>
                <input
                  type="date"
                  value={fechaCierre}
                  onChange={(e) => setFechaCierre(e.target.value)}
                  className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl text-xs font-black outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Banco Adquirente (Punto POS):
                </label>
                <select
                  value={bancoSeleccionado}
                  onChange={(e) => setBancoSeleccionado(e.target.value)}
                  className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl text-xs font-black outline-none focus:border-blue-700"
                >
                  {BANCOS_VENEZUELA.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Nro. de Lote del Punto POS:
                </label>
                <input
                  type="text"
                  value={nroLote}
                  onChange={(e) => setNroLote(e.target.value)}
                  placeholder="Ej: Lote #00452"
                  className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Cajero / Responsable:
                </label>
                <input
                  type="text"
                  value={cajero}
                  onChange={(e) => setCajero(e.target.value)}
                  placeholder="CAJERO PRINCIPAL"
                  className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-700"
                />
              </div>
            </div>
          </div>

          {/* Tarjetas KPI de Resumen en Tiempo Real */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Lote POS Bruto */}
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                Total Bruto Lote POS
              </span>
              <div className="my-1">
                <div className="text-xl font-mono font-black text-blue-300">
                  Bs. {formatearVE(totalesConsolidados.totalLotePosBs)}
                </div>
                <div className="text-xs font-mono font-bold text-slate-400">
                  $ {formatearVE(totalesConsolidados.totalLotePosUsd)}
                </div>
              </div>
              <span className="text-[9px] text-slate-400">Total transado en el punto</span>
            </div>

            {/* 2. Comisiones Bancarias */}
            <div className="bg-rose-950/80 text-white p-3.5 rounded-2xl shadow-sm border border-rose-900 flex flex-col justify-between">
              <span className="text-[10px] font-black text-rose-300 uppercase tracking-wide flex items-center justify-between">
                <span>Comisiones Bancarias</span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              </span>
              <div className="my-1">
                <div className="text-xl font-mono font-black text-rose-300">
                  -Bs. {formatearVE(totalesConsolidados.totalComisionesBs)}
                </div>
                <div className="text-xs font-mono font-bold text-rose-200">
                  -$ {formatearVE(totalesConsolidados.totalComisionesUsd)}
                </div>
              </div>
              <span className="text-[9px] text-rose-300/80">Descuento aplicado por el banco</span>
            </div>

            {/* 3. Abono Neto Real en Banco */}
            <div className="bg-emerald-950/90 text-white p-3.5 rounded-2xl shadow-sm border border-emerald-900 flex flex-col justify-between">
              <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wide flex items-center justify-between">
                <span>Abono Real en Banco</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </span>
              <div className="my-1">
                <div className="text-xl font-mono font-black text-emerald-400">
                  Bs. {formatearVE(totalesConsolidados.totalNetoBancoBs)}
                </div>
                <div className="text-xs font-mono font-bold text-emerald-200">
                  $ {formatearVE(totalesConsolidados.totalNetoBancoUsd)}
                </div>
              </div>
              <span className="text-[9px] text-emerald-300 font-bold">Líquido que cae a cuenta</span>
            </div>

            {/* 4. Registrado en Sistema */}
            <div className="bg-blue-950/90 text-white p-3.5 rounded-2xl shadow-sm border border-blue-900 flex flex-col justify-between">
              <span className="text-[10px] font-black text-blue-300 uppercase tracking-wide">
                Registrado en Sistema
              </span>
              <div className="my-1">
                <div className="text-xl font-mono font-black text-blue-200">
                  Bs. {formatearVE(totalesConsolidados.totalSistemaBs)}
                </div>
                <div className="text-xs font-mono font-bold text-blue-300">
                  $ {formatearVE(totalesConsolidados.totalSistemaUsd)}
                </div>
              </div>
              <span className="text-[9px] text-blue-300/80">
                {ventasFiltradas.length} venta(s) facturada(s)
              </span>
            </div>

            {/* 5. Diferencia Neta Final */}
            <div
              className={`p-3.5 rounded-2xl shadow-sm border flex flex-col justify-between ${
                totalesConsolidados.estadoDiferencia === 'CUADRADO'
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : totalesConsolidados.estadoDiferencia === 'SOBRANTE'
                  ? 'bg-blue-700 text-white border-blue-800'
                  : 'bg-rose-600 text-white border-rose-700'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wide flex items-center justify-between">
                <span>Cuadre Final</span>
                {totalesConsolidados.estadoDiferencia === 'CUADRADO' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-200" />
                )}
              </span>
              <div className="my-1">
                <div className="text-lg font-mono font-black">
                  {totalesConsolidados.diferenciaNetaBs >= 0 ? '+' : ''}
                  Bs. {formatearVE(totalesConsolidados.diferenciaNetaBs)}
                </div>
                <div className="text-xs font-mono font-bold text-white/90">
                  {totalesConsolidados.diferenciaNetaUsd >= 0 ? '+' : ''}$
                  {formatearVE(totalesConsolidados.diferenciaNetaUsd)}
                </div>
              </div>
              <span className="text-[9px] font-black uppercase">
                {totalesConsolidados.estadoDiferencia === 'CUADRADO'
                  ? 'CAJA CUADRADA'
                  : totalesConsolidados.estadoDiferencia === 'SOBRANTE'
                  ? 'SOBRANTE EN CAJA'
                  : 'FALTANTE EN CAJA'}
              </span>
            </div>
          </div>

          {/* Tabla Interactiva de Conciliación por Método de Pago */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800">
                  Desglose Detallado por Tipo de Tarjeta / Instrumento de Cobro
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ingresa el monto del reporte de cierre del punto (Lote POS) para calcular automáticamente comisiones y neto.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-900 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Método / Tarjeta</th>
                    <th className="p-2.5 text-right">Sistema (Bs)</th>
                    <th className="p-2.5 text-center min-w-[130px]">Lote POS (Bs)</th>
                    <th className="p-2.5 text-center min-w-[90px]">Lote POS ($)</th>
                    <th className="p-2.5 text-center w-20">% Comis.</th>
                    <th className="p-2.5 text-right">Comisión (Bs)</th>
                    <th className="p-2.5 text-right font-black text-emerald-400">Neto Banco (Bs)</th>
                    <th className="p-2.5 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 uppercase">
                  {desgloseCalculado.map((item) => {
                    const datos = valoresIngresados[item.metodo];
                    const esPunto = item.metodo === 'DEBITO' || item.metodo === 'CREDITO' || item.metodo === 'BIOPAGO';

                    return (
                      <tr key={item.metodo} className="hover:bg-slate-50/80 transition">
                        <td className="p-2.5 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span>{item.nombreLegible}</span>
                            {item.metodo === 'DEBITO' && (
                              <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-black">
                                DÉBITO
                              </span>
                            )}
                            {item.metodo === 'CREDITO' && (
                              <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-black">
                                CRÉDITO
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Sistema Bs */}
                        <td className="p-2.5 font-mono text-right font-bold text-slate-600">
                          Bs. {formatearVE(item.montoSistemaBs)}
                        </td>

                        {/* Input Lote POS (Bs) */}
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            step="any"
                            value={datos.montoLotePosBs}
                            onChange={(e) => handleMontoChange(item.metodo, 'Bs', e.target.value)}
                            placeholder="0.00"
                            className="w-full border-2 border-slate-300 focus:border-blue-600 bg-white p-1.5 rounded-lg font-mono font-black text-xs text-right outline-none"
                          />
                        </td>

                        {/* Input Lote POS ($ USD) */}
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            step="any"
                            value={datos.montoLotePosUsd}
                            onChange={(e) => handleMontoChange(item.metodo, 'USD', e.target.value)}
                            placeholder="0.00"
                            className="w-full border border-slate-300 bg-slate-50 p-1.5 rounded-lg font-mono font-bold text-xs text-right outline-none"
                          />
                        </td>

                        {/* % Comisión bancaria editable */}
                        <td className="p-2 text-center">
                          {esPunto || item.metodo === 'PAGO_MOVIL' ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <input
                                type="number"
                                step="any"
                                value={datos.tasaComisionPorcentaje}
                                onChange={(e) => handleTasaComisionChange(item.metodo, e.target.value)}
                                className="w-12 border border-slate-300 p-1 rounded font-mono font-black text-center text-xs outline-none"
                              />
                              <span className="text-[10px] text-slate-500 font-bold">%</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-bold text-[10px]">0.0%</span>
                          )}
                        </td>

                        {/* Comisión en Bs */}
                        <td className="p-2.5 font-mono text-right font-black text-rose-600">
                          {item.comisionBs > 0 ? `-Bs. ${formatearVE(item.comisionBs)}` : 'Bs. 0,00'}
                        </td>

                        {/* Neto en Banco */}
                        <td className="p-2.5 font-mono text-right font-black text-emerald-700 bg-emerald-50/40">
                          Bs. {formatearVE(item.montoNetoBancoBs)}
                        </td>

                        {/* Diferencia */}
                        <td className="p-2.5 font-mono text-right font-black">
                          <span
                            className={
                              Math.abs(item.diferenciaBs) < 0.05
                                ? 'text-slate-500'
                                : item.diferenciaBs > 0
                                ? 'text-blue-700'
                                : 'text-rose-600'
                            }
                          >
                            {item.diferenciaBs >= 0 ? '+' : ''}
                            Bs. {formatearVE(item.diferenciaBs)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Total Row */}
                <tfoot className="bg-slate-100 font-black text-xs border-t-2 border-slate-300">
                  <tr>
                    <td className="p-2.5 text-slate-900 uppercase">TOTALES GENERALES</td>
                    <td className="p-2.5 font-mono text-right text-slate-700">
                      Bs. {formatearVE(totalesConsolidados.totalSistemaBs)}
                    </td>
                    <td className="p-2.5 font-mono text-right text-blue-900 font-black">
                      Bs. {formatearVE(totalesConsolidados.totalLotePosBs)}
                    </td>
                    <td className="p-2.5 font-mono text-right text-slate-700">
                      $ {formatearVE(totalesConsolidados.totalLotePosUsd)}
                    </td>
                    <td className="p-2.5 text-center text-slate-400">—</td>
                    <td className="p-2.5 font-mono text-right text-rose-700 font-black">
                      -Bs. {formatearVE(totalesConsolidados.totalComisionesBs)}
                    </td>
                    <td className="p-2.5 font-mono text-right text-emerald-800 font-black bg-emerald-100/50">
                      Bs. {formatearVE(totalesConsolidados.totalNetoBancoBs)}
                    </td>
                    <td className="p-2.5 font-mono text-right font-black">
                      <span
                        className={
                          totalesConsolidados.estadoDiferencia === 'CUADRADO'
                            ? 'text-emerald-700'
                            : totalesConsolidados.estadoDiferencia === 'SOBRANTE'
                            ? 'text-blue-700'
                            : 'text-rose-700'
                        }
                      >
                        {totalesConsolidados.diferenciaNetaBs >= 0 ? '+' : ''}
                        Bs. {formatearVE(totalesConsolidados.diferenciaNetaBs)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Observaciones y Justificación de Diferencias */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                Observaciones del Arqueo / Justificación de Sobrantes o Faltantes:
              </label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Lote cerrado a las 7:30 PM. Sin incidencias. Todas las tarjetas coincidieron con los vouchers del punto."
                className="w-full border-2 border-slate-300 p-2 rounded-xl text-xs font-medium outline-none focus:border-blue-700"
              />
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleExportarConciliacionActual}
                className="bg-blue-900 hover:bg-blue-950 text-white font-black text-xs px-4 py-3 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 active:scale-95"
                title="Generar y descargar documento PDF con el desglose de ventas vs lotes POS y comisiones"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>EXPORTAR REPORTE DEL DÍA (PDF)</span>
              </button>
              
              <button
                type="button"
                onClick={handleExportarSeniatCSV}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs px-4 py-3 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 active:scale-95"
                title="Exportar movimientos FISCALES para carga en portal SENIAT"
              >
                <FileText className="w-4 h-4" />
                <span>EXPORTAR SENIAT (CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const ahora = new Date();
                  const cierrePreview: import('../types').CierreCajaConciliacion = {
                    id: `CIERRE-${fechaCierre.replace(/-/g, "")}-PREVIEW`,
                    fecha: fechaCierre,
                    hora: ahora.toLocaleTimeString("es-VE"),
                    cajero: cajero.trim().toUpperCase() || "CAJERO PRINCIPAL",
                    banco: bancoSeleccionado,
                    nroLote: nroLote.trim() || "S/N",
                    tasaBcv: tasas.tasaBcv,
                    totalSistemaBs: totalesConsolidados.totalSistemaBs,
                    totalSistemaUsd: totalesConsolidados.totalSistemaUsd,
                    totalLotePosBs: totalesConsolidados.totalLotePosBs,
                    totalLotePosUsd: totalesConsolidados.totalLotePosUsd,
                    totalComisionesBs: totalesConsolidados.totalComisionesBs,
                    totalComisionesUsd: totalesConsolidados.totalComisionesUsd,
                    totalRetencionesBs: 0,
                    totalRetencionesUsd: 0,
                    totalNetoBancoBs: totalesConsolidados.totalNetoBancoBs,
                    totalNetoBancoUsd: totalesConsolidados.totalNetoBancoUsd,
                    diferenciaNetaBs: totalesConsolidados.diferenciaNetaBs,
                    diferenciaNetaUsd: totalesConsolidados.diferenciaNetaUsd,
                    estadoDiferencia: totalesConsolidados.estadoDiferencia,
                    desglose: desgloseCalculado,
                    observaciones: observaciones.trim() || "Comprobante de arqueo de caja (Previsualización).",
                    fechaCreacionIso: ahora.toISOString(),
                  };
                  import('../utils/printHelpers').then(helpers => {
                    helpers.imprimirCierreCajaTicket(cierrePreview, StorageService.getSettings().formatoImpresora);
                  });
                }}
                className="bg-indigo-700 hover:bg-indigo-800 text-white font-black text-xs px-4 py-3 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 active:scale-95"
                title="Imprimir ticket detallado de cierre en impresora térmica"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>IMPRIMIR TICKET DE CIERRE</span>
              </button>

              <button
                type="button"
                onClick={handleGuardarCierre}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>REGISTRAR Y GUARDAR CIERRE DE CAJA</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= VISTA 2: HISTORIAL DE CIERRES ================= */}
      {tabActiva === 'historial' && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800">
                Historial de Cierres de Caja y Conciliaciones Previas
              </h3>
              <p className="text-[11px] text-slate-500">
                Consulta los arqueos guardados, reimprime comprobantes contables y revisa las comisiones pagadas a los bancos.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-blue-900 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Cierre / Fecha</th>
                  <th className="p-2.5">Banco / Lote</th>
                  <th className="p-2.5">Cajero</th>
                  <th className="p-2.5 text-right">Lote POS Bruto</th>
                  <th className="p-2.5 text-right">Comisiones</th>
                  <th className="p-2.5 text-right">Neto en Banco</th>
                  <th className="p-2.5 text-right">Sistema</th>
                  <th className="p-2.5 text-center">Cuadre</th>
                  <th className="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 uppercase">
                {historialCierres.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 italic font-medium">
                      No hay registros de cierre de caja guardados todavía. Registra tu primer cierre en la pestaña "Nuevo Cierre".
                    </td>
                  </tr>
                ) : (
                  historialCierres.map((c) => (
                    <tr key={`${c.id}_${c.fecha}`} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-bold text-slate-800">
                        <div className="font-mono text-blue-900 font-black">{c.id}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {c.fecha} • {c.hora}
                        </div>
                      </td>
                      <td className="p-2.5 font-bold text-slate-700">
                        <div>{c.banco}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Lote: {c.nroLote || 'S/N'}</div>
                      </td>
                      <td className="p-2.5 text-slate-600 font-medium">{c.cajero}</td>
                      <td className="p-2.5 font-mono text-right font-black text-slate-900">
                        Bs. {formatearVE(c.totalLotePosBs)}
                      </td>
                      <td className="p-2.5 font-mono text-right font-bold text-rose-600">
                        -Bs. {formatearVE(c.totalComisionesBs)}
                      </td>
                      <td className="p-2.5 font-mono text-right font-black text-emerald-700">
                        Bs. {formatearVE(c.totalNetoBancoBs)}
                      </td>
                      <td className="p-2.5 font-mono text-right text-slate-600">
                        Bs. {formatearVE(c.totalSistemaBs)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            c.estadoDiferencia === 'CUADRADO'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : c.estadoDiferencia === 'SOBRANTE'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {c.estadoDiferencia}
                          {c.diferenciaNetaBs !== 0 && ` (${c.diferenciaNetaBs > 0 ? '+' : ''}${formatearVE(c.diferenciaNetaBs)})`}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setCierreSeleccionado(c)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 rounded hover:bg-slate-100 cursor-pointer"
                            title="Ver desglose completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              imprimirCierreCajaTicket(c, StorageService.getSettings().formatoImpresora)
                            }
                            className="p-1.5 text-slate-600 hover:text-blue-900 rounded hover:bg-slate-100 cursor-pointer"
                            title="Imprimir ticket de cierre POS"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleExportarPDF(c)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 rounded hover:bg-slate-100 cursor-pointer"
                            title="Descargar comprobante en PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEliminarCierre(c.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VISTA 3: CONFIGURACIÓN DE COMISIONES ================= */}
      {tabActiva === 'config' && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 max-w-xl mx-auto space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-700" />
              <span>Configuración de Comisiones Bancarias por Tarjeta</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Establece los porcentajes contractuales de comisión que tu banco descuenta en cada transacción del punto de venta.
            </p>
          </div>

          <form onSubmit={handleGuardarConfigComisiones} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                  Comisión Tarjeta de Débito Nacional (%):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={comisionesConfig.debito}
                    onChange={(e) =>
                      setComisionesConfig({ ...comisionesConfig, debito: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-mono font-bold text-xs outline-none focus:border-blue-700"
                  />
                  <span className="font-bold text-xs text-slate-600">%</span>
                </div>
                <span className="text-[10px] text-slate-500">Típicamente entre 1.00% y 1.50% según la SUDEBAN.</span>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                  Comisión Tarjeta de Crédito (%):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={comisionesConfig.credito}
                    onChange={(e) =>
                      setComisionesConfig({ ...comisionesConfig, credito: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-mono font-bold text-xs outline-none focus:border-blue-700"
                  />
                  <span className="font-bold text-xs text-slate-600">%</span>
                </div>
                <span className="text-[10px] text-slate-500">Típicamente entre 3.00% y 5.00%.</span>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                  Comisión Pago Móvil Interbancario (%):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={comisionesConfig.pagoMovil}
                    onChange={(e) =>
                      setComisionesConfig({ ...comisionesConfig, pagoMovil: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-mono font-bold text-xs outline-none focus:border-blue-700"
                  />
                  <span className="font-bold text-xs text-slate-600">%</span>
                </div>
                <span className="text-[10px] text-slate-500">Típicamente 0.30% para P2P / C2P comercio.</span>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                  Comisión Biopago BDV (%):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={comisionesConfig.biopago}
                    onChange={(e) =>
                      setComisionesConfig({ ...comisionesConfig, biopago: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-mono font-bold text-xs outline-none focus:border-blue-700"
                  />
                  <span className="font-bold text-xs text-slate-600">%</span>
                </div>
                <span className="text-[10px] text-slate-500">Típicamente entre 1.00% y 1.50%.</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTabActiva('nuevo')}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>GUARDAR CONFIGURACIÓN</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL: DETALLE DE CIERRE DE CAJA ================= */}
      {cierreSeleccionado && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-black text-sm uppercase">Detalle del Cierre #{cierreSeleccionado.id}</h3>
                  <p className="text-[10px] text-slate-400">
                    Fecha: {cierreSeleccionado.fecha} {cierreSeleccionado.hora} • Cajero: {cierreSeleccionado.cajero}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCierreSeleccionado(null)}
                className="text-slate-400 hover:text-white font-black text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Tarjetas resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block">Lote POS Bruto</span>
                  <div className="font-black font-mono text-slate-900">
                    Bs. {formatearVE(cierreSeleccionado.totalLotePosBs)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    ${formatearVE(cierreSeleccionado.totalLotePosUsd)}
                  </div>
                </div>

                <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  <span className="text-[10px] text-rose-700 font-bold block">Comisiones Bancarias</span>
                  <div className="font-black font-mono text-rose-700">
                    -Bs. {formatearVE(cierreSeleccionado.totalComisionesBs)}
                  </div>
                </div>

                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 font-bold block">Abono Neto en Banco</span>
                  <div className="font-black font-mono text-emerald-800">
                    Bs. {formatearVE(cierreSeleccionado.totalNetoBancoBs)}
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${
                    cierreSeleccionado.estadoDiferencia === 'CUADRADO'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : cierreSeleccionado.estadoDiferencia === 'SOBRANTE'
                      ? 'bg-blue-50 text-blue-900 border-blue-300'
                      : 'bg-rose-50 text-rose-900 border-rose-300'
                  }`}
                >
                  <span className="text-[10px] font-black block">Cuadre Final</span>
                  <div className="font-black font-mono">
                    {cierreSeleccionado.diferenciaNetaBs >= 0 ? '+' : ''}
                    Bs. {formatearVE(cierreSeleccionado.diferenciaNetaBs)}
                  </div>
                </div>
              </div>

              {/* Tabla de desglose */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 font-black uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Instrumento</th>
                      <th className="p-2 text-right">Lote POS</th>
                      <th className="p-2 text-center">%</th>
                      <th className="p-2 text-right">Comisión</th>
                      <th className="p-2 text-right">Neto Banco</th>
                      <th className="p-2 text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {cierreSeleccionado.desglose
                      .filter((d) => d.montoLotePosBs > 0 || d.montoSistemaBs > 0)
                      .map((d, i) => (
                        <tr key={i}>
                          <td className="p-2 font-bold font-sans text-slate-800">{d.nombreLegible}</td>
                          <td className="p-2 text-right">Bs. {formatearVE(d.montoLotePosBs)}</td>
                          <td className="p-2 text-center text-slate-500">{d.tasaComisionPorcentaje}%</td>
                          <td className="p-2 text-right text-rose-600">-Bs. {formatearVE(d.comisionBs)}</td>
                          <td className="p-2 text-right font-black text-emerald-700">
                            Bs. {formatearVE(d.montoNetoBancoBs)}
                          </td>
                          <td className="p-2 text-right font-bold">
                            {d.diferenciaBs >= 0 ? '+' : ''}
                            {formatearVE(d.diferenciaBs)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {cierreSeleccionado.observaciones && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <strong className="block text-slate-700 uppercase text-[10px] mb-0.5">Observaciones:</strong>
                  <p className="text-slate-600 italic">{cierreSeleccionado.observaciones}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    imprimirCierreCajaTicket(
                      cierreSeleccionado,
                      StorageService.getSettings().formatoImpresora
                    )
                  }
                  className="px-3 py-2 bg-blue-900 hover:bg-blue-950 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Ticket</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportarPDF(cierreSeleccionado)}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Exportar PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCierreSeleccionado(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
