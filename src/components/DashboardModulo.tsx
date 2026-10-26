import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ArrowUpRight,
  ShoppingBag,
  Award,
  AlertTriangle,
  Calendar,
  Sparkles,
  BarChart3,
  PieChart as PieIcon,
  Flame,
  FileText,
  Download,
} from 'lucide-react';
import { VentaRegistro, InventarioItem, TasasCambio } from '../types';
import { formatearVE, redondearExacto, convertirDDMMYYYYToYYYYMMDD, formatearFechaDDMMYYYY } from '../utils/formatters';
import { exportarDashboardPDF, exportarReporteVentasPDF } from '../utils/pdfExport';

interface DashboardModuloProps {
  ventas: VentaRegistro[];
  inventario: InventarioItem[];
  tasas: TasasCambio;
}

type PeriodoFiltro = 'todos' | '7dias' | '30dias' | 'mesActual';

const COLORES_CATEGORIA = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#64748b', // slate
];

export const DashboardModulo: React.FC<DashboardModuloProps> = ({
  ventas,
  inventario,
  tasas,
}) => {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('todos');

  // Fast inventory lookup map for costs and categories
  const mapaInventario = useMemo(() => {
    const map = new Map<string, InventarioItem>();
    inventario.forEach((prod) => {
      if (prod.rowid) map.set(prod.rowid, prod);
      if (prod.sku && prod.sku !== 'S/N') map.set(prod.sku.toUpperCase().trim(), prod);
      map.set(prod.nombre.toUpperCase().trim(), prod);
    });
    return map;
  }, [inventario]);

  // Filtered sales by selected period
  const ventasFiltradas = useMemo(() => {
    const hoy = new Date();
    return ventas.filter((v) => {
      if (periodo === 'todos') return true;

      const fechaIso = convertirDDMMYYYYToYYYYMMDD(v.fecha);
      const fechaVenta = new Date(fechaIso);
      if (isNaN(fechaVenta.getTime())) return true;

      const diffTime = hoy.getTime() - fechaVenta.getTime();
      const diffDias = diffTime / (1000 * 3600 * 24);

      if (periodo === '7dias') return diffDias <= 7 && diffDias >= -1;
      if (periodo === '30dias') return diffDias <= 30 && diffDias >= -1;
      if (periodo === 'mesActual') {
        return (
          fechaVenta.getMonth() === hoy.getMonth() &&
          fechaVenta.getFullYear() === hoy.getFullYear()
        );
      }
      return true;
    });
  }, [ventas, periodo]);

  // 1. ANÁLISIS DE VENTAS DIARIAS
  const ventasDiariasData = useMemo(() => {
    const map = new Map<string, { fecha: string; fechaRaw: string; totalUSD: number; totalBs: number; cantidadVentas: number }>();

    ventasFiltradas.forEach((v) => {
      const fechaNormalizada = formatearFechaDDMMYYYY(v.fecha);
      const iso = convertirDDMMYYYYToYYYYMMDD(fechaNormalizada);

      const existing = map.get(fechaNormalizada) || {
        fecha: fechaNormalizada,
        fechaRaw: iso,
        totalUSD: 0,
        totalBs: 0,
        cantidadVentas: 0,
      };

      existing.totalUSD = redondearExacto(existing.totalUSD + (v.total_usd || 0), 2);
      existing.totalBs = redondearExacto(existing.totalBs + (v.total_bs || (v.total_usd || 0) * tasas.tasaBcv), 2);
      existing.cantidadVentas += 1;

      map.set(fechaNormalizada, existing);
    });

    const list = Array.from(map.values());
    list.sort((a, b) => new Date(a.fechaRaw).getTime() - new Date(b.fechaRaw).getTime());
    return list;
  }, [ventasFiltradas, tasas.tasaBcv]);

  // ANÁLISIS ESPECÍFICO DE TENDENCIAS DE CONSUMO (ÚLTIMOS 30 DÍAS COMPLETOS EN RECHARTS)
  const tendencias30Dias = useMemo(() => {
    const ahora = new Date();
    const mapaDias = new Map<
      string,
      { fecha: string; fechaCorta: string; iso: string; totalUSD: number; totalBs: number; transacciones: number }
    >();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(d.getDate() - i);
      const diaStr = String(d.getDate()).padStart(2, '0');
      const mesStr = String(d.getMonth() + 1).padStart(2, '0');
      const anoStr = d.getFullYear();
      const ddmm = `${diaStr}/${mesStr}`;
      const ddmmyyyy = `${diaStr}/${mesStr}/${anoStr}`;
      const iso = `${anoStr}-${mesStr}-${diaStr}`;

      mapaDias.set(ddmmyyyy, {
        fecha: ddmmyyyy,
        fechaCorta: ddmm,
        iso,
        totalUSD: 0,
        totalBs: 0,
        transacciones: 0,
      });
    }

    // Mapear todas las ventas registradas
    ventas.forEach((v) => {
      const fechaNormalizada = formatearFechaDDMMYYYY(v.fecha);
      if (mapaDias.has(fechaNormalizada)) {
        const item = mapaDias.get(fechaNormalizada)!;
        item.totalUSD = redondearExacto(item.totalUSD + (v.total_usd || 0), 2);
        item.totalBs = redondearExacto(
          item.totalBs + (v.total_bs || (v.total_usd || 0) * (v.tasa_bcv || tasas.tasaBcv)),
          2
        );
        item.transacciones += 1;
      }
    });

    const lista = Array.from(mapaDias.values());

    // Media móvil de 7 días para visualizar la tendencia de consumo
    const conTendencia = lista.map((dia, idx) => {
      const ventana = lista.slice(Math.max(0, idx - 6), idx + 1);
      const sumaUSD = ventana.reduce((acc, it) => acc + it.totalUSD, 0);
      const promedioMovilUSD = redondearExacto(sumaUSD / ventana.length, 2);
      return {
        ...dia,
        promedioMovilUSD,
      };
    });

    const total30DiasUSD = redondearExacto(lista.reduce((acc, it) => acc + it.totalUSD, 0), 2);
    const total30DiasBs = redondearExacto(lista.reduce((acc, it) => acc + it.totalBs, 0), 2);
    const total30DiasTransacciones = lista.reduce((acc, it) => acc + it.transacciones, 0);
    const promedioDiarioUSD = redondearExacto(total30DiasUSD / 30, 2);

    let diaPico = { fecha: '---', totalUSD: 0 };
    lista.forEach((d) => {
      if (d.totalUSD > diaPico.totalUSD) {
        diaPico = { fecha: d.fechaCorta, totalUSD: d.totalUSD };
      }
    });

    const ultimos7 = lista.slice(-7);
    const anteriores7 = lista.slice(-14, -7);
    const sumUltimos7 = ultimos7.reduce((acc, it) => acc + it.totalUSD, 0);
    const sumAnteriores7 = anteriores7.reduce((acc, it) => acc + it.totalUSD, 0);

    let direccionTendencia: 'ALZA' | 'BAJA' | 'ESTABLE' = 'ESTABLE';
    let variacionPct = 0;
    if (sumAnteriores7 > 0) {
      variacionPct = redondearExacto(((sumUltimos7 - sumAnteriores7) / sumAnteriores7) * 100, 1);
      if (variacionPct >= 5) direccionTendencia = 'ALZA';
      else if (variacionPct <= -5) direccionTendencia = 'BAJA';
    } else if (sumUltimos7 > 0) {
      direccionTendencia = 'ALZA';
      variacionPct = 100;
    }

    return {
      datos: conTendencia,
      total30DiasUSD,
      total30DiasBs,
      total30DiasTransacciones,
      promedioDiarioUSD,
      diaPico,
      direccionTendencia,
      variacionPct,
    };
  }, [ventas, tasas.tasaBcv]);

  // 2. ANÁLISIS DE ROTACIÓN DE INVENTARIO
  const rotacionInventarioData = useMemo(() => {
    const map = new Map<
      string,
      {
        nombre: string;
        sku: string;
        categoria: string;
        unidadesVendidas: number;
        ingresoUSD: number;
        costoEstimadoUSD: number;
        stockActual: number;
      }
    >();

    ventasFiltradas.forEach((v) => {
      let items: any[] = [];
      try {
        if (typeof v.items_json === 'string') {
          items = JSON.parse(v.items_json);
        } else if (Array.isArray(v.items_json)) {
          items = v.items_json;
        }
      } catch (e) {
        items = [];
      }

      if (Array.isArray(items)) {
        items.forEach((it) => {
          const itemNombre = String(it.nombre || 'SIN NOMBRE').toUpperCase().trim();
          const itemSku = String(it.sku || 'S/N').trim();
          const cant = parseFloat(it.cantidad) || 0;
          const precio = parseFloat(it.precio_manual || it.precio_base_detal) || 0;
          const ingreso = cant * precio;

          const invItem =
            (it.rowId && mapaInventario.get(it.rowId)) ||
            (itemSku !== 'S/N' && mapaInventario.get(itemSku)) ||
            mapaInventario.get(itemNombre);

          const costoU = invItem ? (invItem.costo_u_prot || invItem.base_costo || 0) : 0;
          const stock = invItem ? (invItem.stock || 0) : 0;
          const cat = invItem ? (invItem.categoria || 'GOLOSINAS') : 'GOLOSINAS';

          const key = itemSku !== 'S/N' ? itemSku : itemNombre;
          const existing = map.get(key) || {
            nombre: itemNombre,
            sku: itemSku,
            categoria: cat,
            unidadesVendidas: 0,
            ingresoUSD: 0,
            costoEstimadoUSD: 0,
            stockActual: stock,
          };

          existing.unidadesVendidas += cant;
          existing.ingresoUSD = redondearExacto(existing.ingresoUSD + ingreso, 2);
          existing.costoEstimadoUSD = redondearExacto(existing.costoEstimadoUSD + cant * costoU, 2);
          map.set(key, existing);
        });
      }
    });

    const list = Array.from(map.values()).map((p) => {
      // Turnover index: ratio of units sold vs total available stock (sold + current)
      const totalMovido = p.unidadesVendidas + p.stockActual;
      const indiceRotacion = totalMovido > 0 ? (p.unidadesVendidas / totalMovido) * 100 : 0;
      return {
        ...p,
        indiceRotacion: redondearExacto(indiceRotacion, 1),
      };
    });

    // Sort by highest units sold
    list.sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);
    return list;
  }, [ventasFiltradas, mapaInventario]);

  // 3. ANÁLISIS DE RENTABILIDAD POR CATEGORÍA
  const rentabilidadCategoriasData = useMemo(() => {
    const map = new Map<
      string,
      {
        categoria: string;
        ingresosUSD: number;
        costoUSD: number;
        gananciaUSD: number;
        unidadesVendidas: number;
      }
    >();

    // Initialize all existing inventory categories
    inventario.forEach((p) => {
      const c = (p.categoria || 'GOLOSINAS').toUpperCase().trim();
      if (!map.has(c)) {
        map.set(c, {
          categoria: c,
          ingresosUSD: 0,
          costoUSD: 0,
          gananciaUSD: 0,
          unidadesVendidas: 0,
        });
      }
    });

    // Populate from sales
    rotacionInventarioData.forEach((item) => {
      const cat = (item.categoria || 'GOLOSINAS').toUpperCase().trim();
      const existing = map.get(cat) || {
        categoria: cat,
        ingresosUSD: 0,
        costoUSD: 0,
        gananciaUSD: 0,
        unidadesVendidas: 0,
      };

      existing.ingresosUSD = redondearExacto(existing.ingresosUSD + item.ingresoUSD, 2);
      existing.costoUSD = redondearExacto(existing.costoUSD + item.costoEstimadoUSD, 2);
      existing.gananciaUSD = redondearExacto(existing.gananciaUSD + (item.ingresoUSD - item.costoEstimadoUSD), 2);
      existing.unidadesVendidas += item.unidadesVendidas;
      map.set(cat, existing);
    });

    const totalIngresosG = Array.from(map.values()).reduce((acc, c) => acc + c.ingresosUSD, 0);

    const list = Array.from(map.values())
      .filter((c) => c.ingresosUSD > 0 || c.costoUSD > 0)
      .map((c) => {
        const margen = c.ingresosUSD > 0 ? (c.gananciaUSD / c.ingresosUSD) * 100 : 0;
        const participacion = totalIngresosG > 0 ? (c.ingresosUSD / totalIngresosG) * 100 : 0;
        return {
          ...c,
          margenPct: redondearExacto(margen, 1),
          participacionPct: redondearExacto(participacion, 1),
        };
      });

    // Sort by highest profit
    list.sort((a, b) => b.gananciaUSD - a.gananciaUSD);
    return list;
  }, [inventario, rotacionInventarioData]);

  // Overall KPIs
  const kpis = useMemo(() => {
    let ingresos = 0;
    let costoTotal = 0;
    let unidades = 0;

    rotacionInventarioData.forEach((p) => {
      ingresos += p.ingresoUSD;
      costoTotal += p.costoEstimadoUSD;
      unidades += p.unidadesVendidas;
    });

    // If no items were parsed in items_json, fallback to v.total_usd
    if (ingresos === 0 && ventasFiltradas.length > 0) {
      ingresos = ventasFiltradas.reduce((acc, v) => acc + (v.total_usd || 0), 0);
    }

    const ganancia = redondearExacto(Math.max(0, ingresos - costoTotal), 2);
    const margenGlobal = ingresos > 0 ? redondearExacto((ganancia / ingresos) * 100, 1) : 0;
    const ticketPromedio = ventasFiltradas.length > 0 ? redondearExacto(ingresos / ventasFiltradas.length, 2) : 0;
    const totalBs = redondearExacto(ingresos * tasas.tasaBcv, 2);
    const topProducto = rotacionInventarioData.length > 0 ? rotacionInventarioData[0] : null;

    return {
      ingresos: redondearExacto(ingresos, 2),
      totalBs,
      ganancia,
      margenGlobal,
      unidades,
      transacciones: ventasFiltradas.length,
      ticketPromedio,
      topProducto,
    };
  }, [rotacionInventarioData, ventasFiltradas, tasas.tasaBcv]);

  // Low stock alerts for high rotation products
  const alertasRotacion = useMemo(() => {
    return rotacionInventarioData
      .filter((p) => p.unidadesVendidas >= 3 && p.stockActual <= 5)
      .slice(0, 4);
  }, [rotacionInventarioData]);

  // Custom Tooltips for charts
  const CustomDailyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
          <p className="font-mono font-bold text-amber-300">{data.fecha}</p>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Ventas USD:</span>
            <span className="font-mono font-black text-emerald-400">$ {formatearVE(data.totalUSD)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Ventas Bs:</span>
            <span className="font-mono font-black text-blue-400">Bs. {formatearVE(data.totalBs)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-slate-800 pt-1">
            <span className="text-slate-400">Transacciones:</span>
            <span className="font-black text-white">{data.cantidadVentas} ticket(s)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomTendenciasTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[210px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-1">
            <span className="font-mono font-bold text-amber-300">{data.fecha}</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
              {data.transacciones} venta(s)
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-blue-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
              Ventas del Día:
            </span>
            <span className="font-mono font-black text-emerald-400">$ {formatearVE(data.totalUSD)}</span>
          </div>
          <div className="flex justify-between gap-4 text-[11px]">
            <span className="text-slate-400">Total en Bs:</span>
            <span className="font-mono text-blue-300">Bs. {formatearVE(data.totalBs)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-slate-800 pt-1 text-[11px]">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              Tendencia (7d):
            </span>
            <span className="font-mono font-bold text-amber-300">$ {formatearVE(data.promedioMovilUSD)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomCategoryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
          <p className="font-black text-amber-300 uppercase">{data.categoria}</p>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Ingresos Totales:</span>
            <span className="font-mono font-black text-emerald-400">$ {formatearVE(data.ingresosUSD)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Costo Estimado:</span>
            <span className="font-mono font-bold text-slate-300">$ {formatearVE(data.costoUSD)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-slate-800 pt-1">
            <span className="text-slate-400">Ganancia Bruta:</span>
            <span className="font-mono font-black text-blue-400">$ {formatearVE(data.gananciaUSD)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Margen de Rentabilidad:</span>
            <span className="font-black text-amber-400">{data.margenPct}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const periodoLabels: Record<PeriodoFiltro, string> = {
    todos: 'Todos los Registros',
    '7dias': 'Últimos 7 Días',
    '30dias': 'Últimos 30 Días',
    mesActual: 'Este Mes',
  };

  const handleExportarInformePDF = () => {
    exportarDashboardPDF({
      periodoNombre: periodoLabels[periodo],
      kpis,
      ventasDiarias: ventasDiariasData,
      rentabilidadCategorias: rentabilidadCategoriasData,
      rotacionInventario: rotacionInventarioData,
      tasas,
    });
  };

  const handleExportarVentasPDF = () => {
    exportarReporteVentasPDF(ventasFiltradas, tasas);
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Period Filter Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-900" />
            <h2 className="text-base sm:text-lg font-black text-blue-950 uppercase tracking-wide">
              Panel de Inteligencia Comercial & Dashboard
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Métricas ejecutivas de ventas diarias, rotación de dulces y rentabilidad por categoría
          </p>
        </div>

        {/* Action Buttons & Period Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setPeriodo('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                periodo === 'todos' ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setPeriodo('7dias')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                periodo === '7dias' ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setPeriodo('30dias')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                periodo === '30dias' ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Días
            </button>
            <button
              onClick={() => setPeriodo('mesActual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                periodo === 'mesActual' ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Este Mes
            </button>
          </div>

          {/* Export PDF Buttons */}
          <button
            onClick={handleExportarInformePDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer"
            title="Exportar informe administrativo completo en PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>INFORME PDF</span>
          </button>
          <button
            onClick={handleExportarVentasPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 hover:bg-blue-950 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer"
            title="Exportar libro detallado de ventas en PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>REPORTE VENTAS PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Sales USD */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Ventas Totales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-mono font-black text-emerald-700 block">
              $ {formatearVE(kpis.ingresos)}
            </span>
            <span className="text-[10px] font-mono text-slate-500 font-bold block truncate">
              Bs. {formatearVE(kpis.totalBs)}
            </span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Ganancia Bruta</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-mono font-black text-blue-900 block">
              $ {formatearVE(kpis.ganancia)}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 block">
              Margen: {formatearVE(kpis.margenGlobal, 1)}%
            </span>
          </div>
        </div>

        {/* Global Margin */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Rentabilidad</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-mono font-black text-amber-600 block">
              {formatearVE(kpis.margenGlobal, 1)}%
            </span>
            <span className="text-[10px] font-bold text-slate-500 block">
              Objetivo: 35.0%
            </span>
          </div>
        </div>

        {/* Units Sold */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Unidades Vendidas</span>
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-mono font-black text-purple-900 block">
              {kpis.unidades} uds
            </span>
            <span className="text-[10px] font-bold text-slate-500 block">
              {kpis.transacciones} compras en total
            </span>
          </div>
        </div>

        {/* Average Ticket */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Ticket Promedio</span>
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-mono font-black text-slate-800 block">
              $ {formatearVE(kpis.ticketPromedio)}
            </span>
            <span className="text-[10px] font-mono text-slate-500 block">
              por transacción
            </span>
          </div>
        </div>

        {/* Top Product */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Golosina Estrella</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-xs font-black text-slate-900 block truncate" title={kpis.topProducto?.nombre || '---'}>
              {kpis.topProducto ? kpis.topProducto.nombre : 'SIN VENTAS'}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 block">
              {kpis.topProducto ? `${kpis.topProducto.unidadesVendidas} unidades ($${formatearVE(kpis.topProducto.ingresoUSD)})` : '---'}
            </span>
          </div>
        </div>
      </div>

      {/* CHART: Ventas Totales por Día (Última Semana) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                Ventas Totales por Día (Última Semana)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Visualización de ventas totales en dólares ($) durante los últimos 7 días.
            </p>
          </div>
        </div>
        <div className="w-full h-72">
          {ventasDiariasData.slice(-7).length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
              No hay datos suficientes para mostrar la última semana.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ventasDiariasData.slice(-7)}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-2 rounded-lg text-xs shadow-xl">
                          <p className="font-bold">{payload[0].payload.fecha}</p>
                          <p className="font-mono text-emerald-400">$ {formatearVE(payload[0].value as number)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="totalUSD" name="Ventas ($)" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ================= GRÁFICO DE LÍNEAS RECHARTS: TENDENCIAS DE CONSUMO ÚLTIMOS 30 DÍAS ================= */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap justify-between items-start sm:items-center gap-3 border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-700" />
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                Tendencias de Consumo de los Últimos 30 Días
              </h3>
              <span className="text-[10px] bg-blue-100 text-blue-900 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Líneas Recharts
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Visualización diaria continua para identificar evolución de la demanda, picos de compra y patrones de consumo.
            </p>
          </div>

          {/* KPI Pills for 30 Days Trend */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <div className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Total 30 Días</span>
              <span className="font-mono font-black text-blue-950">
                $ {formatearVE(tendencias30Dias.total30DiasUSD)}
              </span>
            </div>
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Promedio Diario</span>
              <span className="font-mono font-black text-slate-800">
                $ {formatearVE(tendencias30Dias.promedioDiarioUSD)} / día
              </span>
            </div>
            <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              <span className="text-[9px] text-amber-800 block uppercase font-bold">Pico de Demanda</span>
              <span className="font-mono font-black text-amber-950">
                {tendencias30Dias.diaPico.fecha} (${formatearVE(tendencias30Dias.diaPico.totalUSD)})
              </span>
            </div>
            <div
              className={`px-3 py-1.5 rounded-xl border font-bold ${
                tendencias30Dias.direccionTendencia === 'ALZA'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : tendencias30Dias.direccionTendencia === 'BAJA'
                  ? 'bg-rose-50 text-rose-900 border-rose-300'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Comportamiento</span>
              <span className="font-black text-[11px]">
                {tendencias30Dias.direccionTendencia === 'ALZA' && `📈 Crecimiento (+${tendencias30Dias.variacionPct}%)`}
                {tendencias30Dias.direccionTendencia === 'BAJA' && `📉 Descenso (${tendencias30Dias.variacionPct}%)`}
                {tendencias30Dias.direccionTendencia === 'ESTABLE' && '⚖️ Demanda Estable'}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={tendencias30Dias.datos}
              margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="fechaCorta"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip content={<CustomTendenciasTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="totalUSD"
                name="Ventas Diarias Totales ($)"
                stroke="#1d4ed8"
                strokeWidth={3}
                dot={{ r: 3, fill: '#1d4ed8' }}
                activeDot={{ r: 6, fill: '#2563eb' }}
              />
              <Line
                type="monotone"
                dataKey="promedioMovilUSD"
                name="Tendencia de Consumo (Media Móvil 7 Días)"
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CHART 1: Ventas Totales Diarias */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-900" />
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                  Ventas Totales Diarias
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Volumen de facturación diaria en dólares ($) y bolívares (Bs)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-blue-900">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                Total USD ($)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                Tickets
              </span>
            </div>
          </div>

          <div className="w-full h-72">
            {ventasDiariasData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
                <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                No hay ventas registradas en el período seleccionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ventasDiariasData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVentasUSD" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="fecha"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="totalUSD"
                    name="Total USD"
                    stroke="#1e3a8a"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorVentasUSD)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Low Stock & High Turnover Alerts */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 border-b pb-3 mb-3">
              <Flame className="w-4 h-4 text-amber-500" />
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                Alertas de Alta Rotación
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Productos con alta demanda que tienen stock crítico (≤ 5 unidades):
            </p>

            {alertasRotacion.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-slate-100">
                <Package className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                ¡Inventario saludable! No hay productos de alta rotación en nivel crítico.
              </div>
            ) : (
              <div className="space-y-2.5">
                {alertasRotacion.map((item, idx) => (
                  <div
                    key={`${item.sku}_${item.nombre}_${idx}`}
                    className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-black text-slate-900 block truncate max-w-[180px]">
                        {item.nombre}
                      </span>
                      <span className="text-[10px] text-amber-800 font-bold block">
                        {item.unidadesVendidas} vendidos • Quedan solo {item.stockActual}
                      </span>
                    </div>
                    <span className="bg-red-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                      REORDENAR
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs space-y-1">
            <span className="font-black text-blue-950 uppercase text-[10px] block">
              💡 Recomendación Comercial:
            </span>
            <p className="text-[11px] text-blue-900">
              El {kpis.margenGlobal >= 30 ? 'excelente' : 'actual'} margen global del{' '}
              <strong>{kpis.margenGlobal}%</strong> se maximiza manteniendo stock continuo de las golosinas con índice de rotación superior al 40%.
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CHART 2: Inventario con Mayor Rotación */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="border-b pb-3 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500" />
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                  Top Golosinas de Mayor Rotación
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Unidades vendidas vs. Existencia actual en mostrador
              </p>
            </div>
            <span className="bg-blue-100 text-blue-900 text-xs font-black px-2.5 py-0.5 rounded-full">
              Top {Math.min(rotacionInventarioData.length, 6)}
            </span>
          </div>

          <div className="w-full h-64">
            {rotacionInventarioData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                Sin datos de rotación disponibles.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rotacionInventarioData.slice(0, 6)}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    width={110}
                    tick={{ fontSize: 9, fill: '#1e293b', fontWeight: 'bold' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={(val) => (val.length > 15 ? val.substring(0, 15) + '…' : val)}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${value} unidades`,
                      name === 'unidadesVendidas' ? 'Vendidas' : 'En Stock',
                    ]}
                  />
                  <Bar dataKey="unidadesVendidas" name="Vendidas" fill="#1e3a8a" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="stockActual" name="En Stock" fill="#93c5fd" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Mini Ranking Table */}
          <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="p-2">Artículo</th>
                  <th className="p-2 text-center">Vendidas</th>
                  <th className="p-2 text-center">Stock</th>
                  <th className="p-2 text-right">Facturado ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 uppercase font-bold">
                {rotacionInventarioData.slice(0, 4).map((p, idx) => (
                  <tr key={`${p.sku}_${p.nombre}_${idx}`} className="hover:bg-slate-50">
                    <td className="p-2 text-slate-800 truncate max-w-[150px]">{p.nombre}</td>
                    <td className="p-2 text-center">
                      <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded text-[10px]">
                        {p.unidadesVendidas}
                      </span>
                    </td>
                    <td className="p-2 text-center font-mono text-slate-600">{p.stockActual}</td>
                    <td className="p-2 text-right font-mono text-emerald-700 font-black">
                      $ {formatearVE(p.ingresoUSD)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CHART 3: Rentabilidad por Categoría */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="border-b pb-3 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-600" />
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                  Rentabilidad & Ganancia por Categoría
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ingresos netos, costos y margen porcentual de ganancia
              </p>
            </div>
            <span className="bg-emerald-100 text-emerald-900 text-xs font-black px-2.5 py-0.5 rounded-full">
              {rentabilidadCategoriasData.length} Categorías
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Donut chart */}
            <div className="w-full h-56 flex items-center justify-center">
              {rentabilidadCategoriasData.length === 0 ? (
                <div className="text-slate-400 text-xs italic">Sin datos de categorías</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rentabilidadCategoriasData}
                      dataKey="ingresosUSD"
                      nameKey="categoria"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {rentabilidadCategoriasData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.categoria}-${index}`}
                          fill={COLORES_CATEGORIA[index % COLORES_CATEGORIA.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomCategoryTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category breakdown summary */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {rentabilidadCategoriasData.map((cat, idx) => (
                <div
                  key={`${cat.categoria}_${idx}`}
                  className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-black text-slate-800 uppercase">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: COLORES_CATEGORIA[idx % COLORES_CATEGORIA.length] }}
                      ></span>
                      {cat.categoria}
                    </span>
                    <span className="font-black text-emerald-700 font-mono">
                      $ {formatearVE(cat.gananciaUSD)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                    <span>Ventas: ${formatearVE(cat.ingresosUSD)}</span>
                    <span className="text-amber-800 font-mono">Margen: {cat.margenPct}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, cat.margenPct))}%`,
                        backgroundColor: COLORES_CATEGORIA[idx % COLORES_CATEGORIA.length],
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Category Table */}
          <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="p-2">Categoría</th>
                  <th className="p-2 text-right">Venta ($)</th>
                  <th className="p-2 text-right">Costo ($)</th>
                  <th className="p-2 text-right">Ganancia ($)</th>
                  <th className="p-2 text-center">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 uppercase font-bold">
                {rentabilidadCategoriasData.map((c, idx) => (
                  <tr key={`${c.categoria}_${idx}`} className="hover:bg-slate-50">
                    <td className="p-2 text-blue-900">{c.categoria}</td>
                    <td className="p-2 text-right font-mono text-slate-700">$ {formatearVE(c.ingresosUSD)}</td>
                    <td className="p-2 text-right font-mono text-slate-500">$ {formatearVE(c.costoUSD)}</td>
                    <td className="p-2 text-right font-mono text-emerald-700 font-black">
                      $ {formatearVE(c.gananciaUSD)}
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          c.margenPct >= 35
                            ? 'bg-emerald-100 text-emerald-900'
                            : c.margenPct >= 20
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-red-100 text-red-900'
                        }`}
                      >
                        {c.margenPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
