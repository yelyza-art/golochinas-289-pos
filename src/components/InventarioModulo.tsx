import React, { useState, useMemo, useEffect } from 'react';
import { Search, Camera, Plus, Trash2, Printer, Save, RefreshCw, Sparkles, Tag, Package, AlertTriangle, ShieldAlert, FileSpreadsheet, Download, Sliders } from 'lucide-react';
import { InventarioItem } from '../types';
import { formatearVE, redondearExacto } from '../utils/formatters';
import { imprimirEtiquetaPOP } from '../utils/printHelpers';
import { exportarInventarioCSV } from '../utils/csvExport';
import { exportarEtiquetaPDF } from '../utils/pdfExport';
import { StorageService } from '../services/storage';
import { ConfiguracionMinimosModal } from './ConfiguracionMinimosModal';

interface InventarioModuloProps {
  inventario: InventarioItem[];
  onGuardarProducto: (producto: Partial<InventarioItem>, debeImprimir: boolean) => Promise<void>;
  onEliminarProducto: (rowId: string, nombre: string, sku: string) => Promise<void>;
  onGuardarMinimosMasivos?: (ajustes: Record<string, number>) => Promise<void>;
  onOpenScanner: (targetField: string) => void;
  onRecargar: () => void;
}

export const InventarioModulo: React.FC<InventarioModuloProps> = ({
  inventario,
  onGuardarProducto,
  onEliminarProducto,
  onGuardarMinimosMasivos,
  onOpenScanner,
  onRecargar,
}) => {
  const [buscador, setBuscador] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');
  const [formatoImpresora, setFormatoImpresora] = useState<'58mm' | '80mm' | 'pdf'>('58mm');
  const [guardando, setGuardando] = useState(false);
  const [filtroSoloCriticos, setFiltroSoloCriticos] = useState(false);
  const [modalMinimosAbierto, setModalMinimosAbierto] = useState(false);

  const { ivaGeneral, ivaReducida } = StorageService.getSettings();

  // Form state
  const [rowId, setRowId] = useState('');
  const [nombre, setNombre] = useState('');
  const [sku, setSku] = useState('');
  const [costoBase, setCostoBase] = useState<string>('');
  const [ivaTipo, setIvaTipo] = useState<string>(ivaGeneral.toString());
  const [costoConIva, setCostoConIva] = useState<string>('');
  const [empaqueUnidades, setEmpaqueUnidades] = useState<string>('1');

  const [basePvpDetal, setBasePvpDetal] = useState<string>('');
  const [pvpDetalConIva, setPvpDetalConIva] = useState<string>('');
  const [pvpMayorConIva, setPvpMayorConIva] = useState<string>('');

  const [presentacion, setPresentacion] = useState('Unidad');
  const [categoria, setCategoria] = useState('GOLOSINAS');
  const [stock, setStock] = useState<string>('0');
  const [stockMinimo, setStockMinimo] = useState<string>('5');
  const [lote, setLote] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [catDetal, setCatDetal] = useState(true);
  const [catMayor, setCatMayor] = useState(true);

  // Categories list
  const categorias = useMemo(() => {
    const set = new Set<string>();
    set.add('GOLOSINAS');
    set.add('CHOCOLATES');
    set.add('GALLETAS');
    set.add('BEBIDAS');
    set.add('SNACKS');
    inventario.forEach((p) => {
      if (p.categoria) set.add(p.categoria.toUpperCase().trim());
    });
    return Array.from(set);
  }, [inventario]);

  // Filtered inventory with optional critical stock filter and category filter
  const inventarioFiltrado = useMemo(() => {
    let list = inventario;
    if (filtroSoloCriticos) {
      list = list.filter((p) => (p.stock || 0) <= (p.stock_minimo !== undefined ? p.stock_minimo : 0));
    }
    // Filter by category
    if (filtroCategoria !== 'TODOS') {
      list = list.filter((p) => (p.categoria || '').toUpperCase().trim() === filtroCategoria.toUpperCase().trim());
    }
    
    if (!buscador.trim()) return list;
    const q = buscador.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
    );
  }, [inventario, buscador, filtroSoloCriticos, filtroCategoria]);

  // Inventory summary statistics including critical stock count
  const stats = useMemo(() => {
    let costoTotal = 0;
    let ventaTotal = 0;
    let criticos = 0;
    let agotados = 0;

    inventario.forEach((p) => {
      const s = p.stock || 0;
      const min = p.stock_minimo !== undefined ? p.stock_minimo : 0;
      costoTotal += s * (p.costo_u_prot || 0);
      ventaTotal += s * (p.base_pvp_detal || 0);
      if (s <= min) criticos++;
      if (s <= 0) agotados++;
    });

    return {
        articulos: inventario.length,
        costoTotal: redondearExacto(costoTotal, 2),
        ventaTotal: redondearExacto(ventaTotal, 2),
        articulosCriticos: criticos,
        articulosAgotados: agotados,
        criticosList: inventario.filter((p) => (p.stock || 0) <= (p.stock_minimo !== undefined ? p.stock_minimo : 0))
      };
  }, [inventario]);

  const imprimirReporteCriticos = () => {
    const area = document.getElementById('area-impresion');
    if (!area) return;
    let filasHtml = '';
    stats.criticosList.forEach(p => {
      filasHtml += `<tr><td style="padding:4px;">${p.sku}</td><td style="padding:4px;">${p.nombre}</td><td style="padding:4px;text-align:center;">${p.stock}</td><td style="padding:4px;text-align:center;">${p.stock_minimo || 0}</td></tr>`;
    });
    area.innerHTML = `<div style="font-family:Arial,sans-serif;padding:5mm;font-size:9pt;"><h2 style="text-align:center;">PRODUCTOS POR REPONER</h2><table style="width:100%;border-collapse:collapse;"><tr style="background:#eee;"><th>SKU</th><th>PRODUCTO</th><th>STOCK</th><th>MIN</th></tr>${filasHtml}</table></div>`;
    setTimeout(() => { window.print(); setTimeout(() => area.innerHTML = '', 500); }, 150);
  };

  // Cost & price calculations
  const procesarDesgloseAutomatico = (cBaseStr: string, ivaStr: string, empStr: string) => {
    const cBase = parseFloat(cBaseStr) || 0;
    const iva = parseFloat(ivaStr) || 0;
    const emp = parseInt(empStr, 10) || 1;

    const cTotalConIva = redondearExacto(cBase * (1 + iva / 100), 4);
    setCostoConIva(cTotalConIva > 0 ? cTotalConIva.toString() : '');

    const costoU = cBase / emp;
    // Auto calculate suggested 35% margin
    if (costoU > 0) {
      const pvpSinIva = redondearExacto(costoU / (1 - 0.35), 4);
      const pvpConIva = redondearExacto(pvpSinIva * (1 + iva / 100), 2);
      const pvpMayor = redondearExacto(pvpConIva * 0.95, 2);

      setBasePvpDetal(pvpSinIva.toString());
      setPvpDetalConIva(pvpConIva.toString());
      setPvpMayorConIva(pvpMayor.toString());
    }
  };

  const calcularCostoInversoDesdeIVA = (cTotalIvaStr: string) => {
    const cTotal = parseFloat(cTotalIvaStr) || 0;
    const iva = parseFloat(ivaTipo) || 0;
    const emp = parseInt(empaqueUnidades, 10) || 1;

    const cBase = redondearExacto(cTotal / (1 + iva / 100), 4);
    setCostoBase(cBase > 0 ? cBase.toString() : '');

    const costoU = cBase / emp;
    if (costoU > 0) {
      const pvpSinIva = redondearExacto(costoU / (1 - 0.35), 4);
      const pvpConIva = redondearExacto(pvpSinIva * (1 + iva / 100), 2);
      const pvpMayor = redondearExacto(pvpConIva * 0.95, 2);

      setBasePvpDetal(pvpSinIva.toString());
      setPvpDetalConIva(pvpConIva.toString());
      setPvpMayorConIva(pvpMayor.toString());
    }
  };

  const calcularPrecioInversoDesdeBase = (baseStr: string) => {
    const base = parseFloat(baseStr) || 0;
    const iva = parseFloat(ivaTipo) || 0;
    const conIva = redondearExacto(base * (1 + iva / 100), 2);
    const mayor = redondearExacto(conIva * 0.95, 2);

    setPvpDetalConIva(conIva > 0 ? conIva.toString() : '');
    setPvpMayorConIva(mayor > 0 ? mayor.toString() : '');
  };

  const calcularPrecioInversoDesdeIVA = (conIvaStr: string) => {
    const conIva = parseFloat(conIvaStr) || 0;
    const iva = parseFloat(ivaTipo) || 0;
    const base = redondearExacto(conIva / (1 + iva / 100), 4);
    const mayor = redondearExacto(conIva * 0.95, 2);

    setBasePvpDetal(base > 0 ? base.toString() : '');
    setPvpMayorConIva(mayor > 0 ? mayor.toString() : '');
  };

  // Margin calculation
  const cBaseNum = parseFloat(costoBase) || 0;
  const empNum = parseInt(empaqueUnidades, 10) || 1;
  const costoUnitarioPuro = empNum > 0 ? cBaseNum / empNum : 0;
  const basePvpNum = parseFloat(basePvpDetal) || 0;
  const margenDetal = basePvpNum > 0 && costoUnitarioPuro > 0
    ? ((basePvpNum - costoUnitarioPuro) / basePvpNum) * 100
    : 0;

  // Suggested price display
  const pvpSugeridoSinIva = costoUnitarioPuro > 0 ? redondearExacto(costoUnitarioPuro / (1 - 0.35), 2) : 0;
  const pvpSugeridoConIva = redondearExacto(pvpSugeridoSinIva * (1 + (parseFloat(ivaTipo) || 0) / 100), 2);

  const cargarFichaProducto = (prod: InventarioItem) => {
    setRowId(prod.rowid || '');
    setNombre(prod.nombre);
    setSku(prod.sku === 'S/N' ? '' : prod.sku);
    setCostoBase(prod.base_costo ? prod.base_costo.toString() : '');
    setCostoConIva(prod.costo_con_iva ? prod.costo_con_iva.toString() : '');
    setEmpaqueUnidades('1');
    setIvaTipo(prod.iva_tipo || ivaGeneral.toString());

    setBasePvpDetal(prod.base_pvp_detal ? prod.base_pvp_detal.toString() : '');
    setPvpDetalConIva(prod.pvp_detal ? prod.pvp_detal.toString() : '');
    setPvpMayorConIva(prod.pvp_mayor ? prod.pvp_mayor.toString() : '');

    setStock(prod.stock !== undefined ? prod.stock.toString() : '0');
    setStockMinimo(prod.stock_minimo !== undefined ? prod.stock_minimo.toString() : '5');
    setLote(prod.lote || '');
    setFechaVencimiento(prod.fecha_vencimiento || '');
    setPresentacion(prod.presentacion || 'Unidad');
    setCategoria(prod.categoria || 'GOLOSINAS');
    setCatDetal(prod.cat_detal);
    setCatMayor(prod.cat_mayor);
  };

  const limpiarFormulario = () => {
    setRowId('');
    setNombre('');
    setSku('');
    setCostoBase('');
    setCostoConIva('');
    setEmpaqueUnidades('1');
    setIvaTipo(ivaGeneral.toString());
    setBasePvpDetal('');
    setPvpDetalConIva('');
    setPvpMayorConIva('');
    setStock('0');
    setStockMinimo('5');
    setLote('');
    setFechaVencimiento('');
    setPresentacion('Unidad');
    setCategoria('GOLOSINAS');
    setCatDetal(true);
    setCatMayor(true);
  };

  const handleGuardar = async (imprimir = false) => {
    if (!nombre.trim()) {
      alert("❌ Ingrese al menos el nombre del artículo.");
      return;
    }

    setGuardando(true);
    try {
      const pvpDetalNum = redondearExacto(parseFloat(pvpDetalConIva) || 0, 2);
      const cBase = parseFloat(costoBase) || 0;
      const emp = parseInt(empaqueUnidades, 10) || 1;

      const productoData: Partial<InventarioItem> = {
        rowid: rowId,
        nombre: nombre.trim().toUpperCase(),
        sku: sku.trim().toUpperCase() || 'S/N',
        base_costo: cBase,
        costo_con_iva: parseFloat(costoConIva) || 0,
        costo_u_prot: cBase / emp,
        base_pvp_detal: parseFloat(basePvpDetal) || 0,
        pvp_detal: pvpDetalNum,
        pvp_mayor: parseFloat(pvpMayorConIva) ? redondearExacto(parseFloat(pvpMayorConIva), 2) : redondearExacto(pvpDetalNum * 0.95, 2),
        stock: parseFloat(stock) || 0,
        stock_minimo: parseFloat(stockMinimo) || 0,
        lote: lote.trim().toUpperCase() || undefined,
        fecha_vencimiento: fechaVencimiento || undefined,
        presentacion,
        categoria: categoria.trim().toUpperCase(),
        cat_detal: catDetal,
        cat_mayor: catMayor,
        iva_tipo: ivaTipo,
      };

      await onGuardarProducto(productoData, imprimir);

      if (imprimir) {
        imprimirEtiquetaPOP(nombre.trim().toUpperCase(), pvpDetalNum, formatoImpresora);
      }

      limpiarFormulario();
    } catch (err: any) {
      alert("❌ Error guardando producto: " + (err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (prod: InventarioItem) => {
    if (confirm(`⚠️ ¿Deseas eliminar el dulce "${prod.nombre}"?`)) {
      await onEliminarProducto(prod.rowid, prod.nombre, prod.sku);
      if (rowId === prod.rowid) limpiarFormulario();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Product Form Section */}
      <section className="lg:col-span-5 space-y-4">
        {/* Search Header */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex gap-2">
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="border-2 border-slate-300 rounded-xl p-2 font-bold text-xs uppercase focus:border-blue-600 outline-none max-w-[120px]"
            >
              <option value="TODOS">TODAS CAT.</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                id="buscador"
                value={buscador}
                onChange={(e) => setBuscador(e.target.value)}
                placeholder="ESCANEA SKU O BUSCA DULCE..."
                className="w-full border-2 border-slate-300 bg-white shadow-inner rounded-xl p-2 pl-9 font-bold text-xs uppercase focus:border-blue-600 outline-none pr-8 transition"
              />
              {buscador && (
                <button
                  onClick={() => setBuscador('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-red-600 font-black text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => onOpenScanner('buscador')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-3.5 rounded-xl flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Abrir lector de cámara"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">CAM</span>
            </button>
            <button
              onClick={() => setFiltroSoloCriticos(!filtroSoloCriticos)}
              className={`p-2.5 rounded-xl border ${
                filtroSoloCriticos ? 'bg-red-100 border-red-200 text-red-700' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
              title="Filtrar productos con stock crítico"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>
          </div>
          {filtroSoloCriticos && (
            <div className="mt-3 flex items-center justify-between bg-red-50 p-3 rounded-lg border border-red-200">
              <span className="text-xs font-bold text-red-800">⚠️ {stats.articulosCriticos} productos críticos</span>
              <button
                onClick={imprimirReporteCriticos}
                className="bg-red-600 hover:bg-red-700 text-white font-black text-[10px] px-3 py-1.5 rounded-md flex items-center gap-1.5"
              >
                <Printer className="w-3 h-3" />
                IMPRIMIR
              </button>
            </div>
          )}
        </div>

        {/* Product Card / Editor */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-900" />
              <h3 className="font-black text-blue-900 uppercase text-sm tracking-wide">
                {rowId ? 'Editar Ficha de Producto' : 'Nuevo Producto'}
              </h3>
            </div>
            <button
              onClick={limpiarFormulario}
              className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 cursor-pointer"
            >
              LIMPIAR 🧹
            </button>
          </div>

          {/* Name & Barcode */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="md:col-span-2">
              <label className="font-black text-[11px] block mb-1 text-slate-700 uppercase">
                Nombre del Artículo
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="EJ: CHOCOLATE SAVOY 130G"
                className="w-full border-2 border-slate-300 bg-white p-2.5 rounded-xl font-bold uppercase text-xs focus:border-blue-600 outline-none"
              />
            </div>
            <div>
              <label className="font-black text-[11px] block mb-1 text-slate-700 uppercase">
                Código Barra (SKU)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="S/N"
                  className="w-full border-2 border-slate-300 bg-white p-2.5 rounded-xl font-mono font-black text-xs uppercase pr-8 outline-none focus:border-blue-600"
                />
                <button
                  onClick={() => onOpenScanner('formulario')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                  title="Escanear SKU con cámara"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Desglose de Costo Puro & Tasa IVA
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Base Costo ($)</label>
                <input
                  type="number"
                  step="any"
                  value={costoBase}
                  onChange={(e) => {
                    setCostoBase(e.target.value);
                    procesarDesgloseAutomatico(e.target.value, ivaTipo, empaqueUnidades);
                  }}
                  placeholder="0.00"
                  className="w-full border border-slate-300 bg-white p-1.5 rounded-lg font-bold text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Tasa IVA</label>
                <select
                  value={ivaTipo}
                  onChange={(e) => {
                    setIvaTipo(e.target.value);
                    procesarDesgloseAutomatico(costoBase, e.target.value, empaqueUnidades);
                  }}
                  className="w-full border border-slate-300 bg-white p-1.5 rounded-lg font-bold text-xs outline-none"
                >
                  <option value="0">Exento (0%)</option>
                  <option value={ivaGeneral}>{ivaGeneral}% (General)</option>
                  <option value={ivaReducida}>{ivaReducida}% (Reducida)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Costo con IVA ($)</label>
                <input
                  type="number"
                  step="any"
                  value={costoConIva}
                  onChange={(e) => {
                    setCostoConIva(e.target.value);
                    calcularCostoInversoDesdeIVA(e.target.value);
                  }}
                  placeholder="0.00"
                  className="w-full border border-slate-300 bg-white p-1.5 rounded-lg font-bold text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Cant. Empaque</label>
                <input
                  type="number"
                  value={empaqueUnidades}
                  onChange={(e) => {
                    setEmpaqueUnidades(e.target.value);
                    procesarDesgloseAutomatico(costoBase, ivaTipo, e.target.value);
                  }}
                  className="w-full border border-slate-300 bg-white p-1.5 rounded-lg font-bold text-xs outline-none text-center"
                />
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <div>
              <label className="font-black text-[11px] block mb-1 text-blue-900 uppercase">
                Base PVP Detal
              </label>
              <input
                type="number"
                step="any"
                value={basePvpDetal}
                onChange={(e) => {
                  setBasePvpDetal(e.target.value);
                  calcularPrecioInversoDesdeBase(e.target.value);
                }}
                placeholder="0.00"
                className="w-full border-2 border-blue-400 bg-blue-50/60 p-2 rounded-xl font-mono font-black text-xs text-blue-900 outline-none"
              />
            </div>
            <div>
              <label className="font-black text-[11px] block mb-1 text-emerald-800 uppercase">
                PVP Detal (IVA)
              </label>
              <input
                type="number"
                step="any"
                value={pvpDetalConIva}
                onChange={(e) => {
                  setPvpDetalConIva(e.target.value);
                  calcularPrecioInversoDesdeIVA(e.target.value);
                }}
                placeholder="0.00"
                className="w-full border-2 border-emerald-500 bg-emerald-50/80 p-2 rounded-xl font-mono font-black text-xs text-emerald-950 outline-none"
              />
            </div>
            <div>
              <label className="font-black text-[11px] block mb-1 text-amber-800 uppercase">
                PVP Mayor (-5%)
              </label>
              <input
                type="number"
                step="any"
                value={pvpMayorConIva}
                onChange={(e) => setPvpMayorConIva(e.target.value)}
                placeholder="0.00"
                className="w-full border-2 border-amber-400 bg-amber-50/60 p-2 rounded-xl font-mono font-black text-xs text-amber-950 outline-none"
              />
            </div>
            <div>
              <label className="font-black text-[11px] block mb-1 text-slate-700 uppercase">
                Unidad
              </label>
              <select
                value={presentacion}
                onChange={(e) => setPresentacion(e.target.value)}
                className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl font-bold text-xs outline-none"
              >
                <option value="Unidad">Unidad</option>
                <option value="Caja">Caja</option>
                <option value="Bolsa">Bolsa</option>
                <option value="Paquete">Paquete</option>
                <option value="Display">Display</option>
                <option value="Tableta">Tableta</option>
                <option value="Lata">Lata</option>
              </select>
            </div>
            <div>
              <label className="font-black text-[11px] block mb-1 text-slate-700 uppercase">
                Categoría
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full border-2 border-blue-400 bg-blue-50/40 p-2 rounded-xl font-bold uppercase text-xs outline-none"
              >
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Margins & Suggested 35% helper */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <span className="text-[10px] font-black text-slate-400 block uppercase">
                  PVP Sugerido (35% Margen Neto)
                </span>
                <div className="text-xs font-bold text-slate-600 mt-0.5">
                  Sin IVA: <span className="text-blue-700 font-mono font-black">$ {formatearVE(pvpSugeridoSinIva)}</span> | 
                  Con IVA: <span className="text-emerald-700 font-mono font-black">$ {formatearVE(pvpSugeridoConIva)}</span>
                </div>
              </div>
              <div
                className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase ${
                  margenDetal >= 35
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : margenDetal >= 20
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}
              >
                MARGEN DETAL: {formatearVE(margenDetal, 1)}%
              </div>
            </div>
          </div>

          {/* Stock, Stock Mínimo & Catalog checkboxes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
            <div>
              <label className="font-black text-xs block mb-1 text-slate-700 uppercase">
                Stock Actual
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full border-2 border-blue-400 bg-blue-50/60 p-2 rounded-xl font-black text-center text-sm text-blue-950 outline-none"
              />
            </div>
            <div>
              <label className="font-black text-xs block mb-1 text-red-700 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Stock Mínimo</span>
              </label>
              <input
                type="number"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                placeholder="5"
                className="w-full border-2 border-red-400 bg-red-50/60 p-2 rounded-xl font-black text-center text-sm text-red-950 outline-none focus:border-red-600"
              />
            </div>
            <label className="flex items-center space-x-2 pt-4 justify-center cursor-pointer">
              <input
                type="checkbox"
                checked={catDetal}
                onChange={(e) => setCatDetal(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
              <span className="text-xs font-black text-slate-700 uppercase">Cat. Detal</span>
            </label>
            <label className="flex items-center space-x-2 pt-4 justify-center cursor-pointer">
              <input
                type="checkbox"
                checked={catMayor}
                onChange={(e) => setCatMayor(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded cursor-pointer"
              />
              <span className="text-xs font-black text-slate-700 uppercase">Cat. Mayor</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-black text-xs block mb-1 text-slate-700 uppercase">
                Lote
              </label>
              <input
                type="text"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="EJ: LT-2026-001"
                className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl font-black text-xs uppercase focus:border-blue-600 outline-none"
              />
            </div>
            <div>
              <label className="font-black text-xs block mb-1 text-slate-700 uppercase">
                Fecha Venc.
              </label>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl font-bold text-xs outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Printer format selection */}
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-300">
            <label className="font-black text-[11px] text-emerald-950 block mb-1 uppercase">
              🖨️ Formato de Impresión Etiqueta POP
            </label>
            <select
              value={formatoImpresora}
              onChange={(e) => setFormatoImpresora(e.target.value as any)}
              className="w-full border-2 border-emerald-600 bg-white p-2 rounded-xl font-black text-xs text-emerald-950 outline-none"
            >
              <option value="58mm">Impresora Térmica 58 mm (Área Útil Centrada 44 mm)</option>
              <option value="80mm">Tiquera Térmica 80 mm (Estándar POS)</option>
              <option value="pdf">Documento PDF / Hoja Carta (A4)</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleGuardar(false)}
              disabled={guardando}
              className="w-full bg-blue-900 hover:bg-blue-950 text-white font-black py-3 rounded-xl shadow-md transition active:scale-95 flex justify-center items-center gap-1.5 text-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{guardando ? 'GUARDANDO...' : '💾 RESPALDAR'}</span>
            </button>
            <button
              onClick={() => handleGuardar(true)}
              disabled={guardando}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl shadow-md transition active:scale-95 flex justify-center items-center gap-1.5 text-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ ETIQUETA POP</span>
            </button>
          </div>
        </div>
      </section>

      {/* Inventory Table Section */}
      <section className="lg:col-span-7 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-[500px] space-y-3">
        {/* Table Top Stats */}
        <div className="border-b pb-3 flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider mr-1">
              Existencias ({stats.articulos} Artículos)
            </h3>
            <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2.5 py-1 rounded-lg border border-blue-200 uppercase">
              Costo: <span className="font-mono">$ {formatearVE(stats.costoTotal)}</span>
            </span>
            <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-200 uppercase">
              PVP: <span className="font-mono">$ {formatearVE(stats.ventaTotal)}</span>
            </span>
            {stats.articulosCriticos > 0 && (
              <button
                onClick={() => setFiltroSoloCriticos(!filtroSoloCriticos)}
                className={`text-[10px] font-black px-2.5 py-1 rounded-lg border cursor-pointer transition flex items-center gap-1 ${
                  filtroSoloCriticos
                    ? 'bg-red-600 text-white border-red-700 shadow-md animate-pulse'
                    : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                }`}
                title="Hacer clic para filtrar productos bajo el mínimo"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{stats.articulosCriticos} CRÍTICOS</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {filtroSoloCriticos && (
              <button
                onClick={() => setFiltroSoloCriticos(false)}
                className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200 cursor-pointer"
              >
                VER TODOS ({inventario.length})
              </button>
            )}
            <button
              onClick={() => setModalMinimosAbierto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-black text-xs rounded-xl shadow transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Configurar masivamente el stock mínimo por categoría"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-300" />
              <span>MÍNIMOS POR CATEGORÍA</span>
            </button>
            <button
              onClick={() => exportarInventarioCSV(inventario, 'Auditoria_General')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Exportar base de datos de productos a archivo CSV compatible con Excel y auditoría externa"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
              <span>EXPORTAR CSV</span>
            </button>
            <button
              onClick={onRecargar}
              className="text-xs font-black text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>RECARGAR</span>
            </button>
          </div>
        </div>

        {/* Critical Stock Alert Banner */}
        {stats.articulosCriticos > 0 && (
          <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-red-900 font-bold">
              <div className="p-1.5 bg-red-600 text-white rounded-lg shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-black block uppercase text-red-950">
                  ⚠️ ALERTA DE STOCK: {stats.articulosCriticos} producto(s) en o por debajo de su mínimo
                </span>
                <span className="text-[11px] text-red-800">
                  Los productos resaltados en rojo requieren reposición inmediata para evitar pérdida de ventas.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportarInventarioCSV(inventario.filter(p => (p.stock || 0) <= (p.stock_minimo !== undefined ? p.stock_minimo : 0)), 'Productos_Criticos')}
                className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-800 border border-red-300 font-black text-[10px] rounded-lg shadow-sm cursor-pointer whitespace-nowrap flex items-center gap-1"
                title="Descargar solo los productos con stock crítico en CSV"
              >
                <Download className="w-3 h-3 text-red-600" />
                <span>CSV CRÍTICOS</span>
              </button>
              <button
                onClick={() => setFiltroSoloCriticos(!filtroSoloCriticos)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] rounded-lg shadow-sm cursor-pointer whitespace-nowrap"
              >
                {filtroSoloCriticos ? 'MOSTRAR TODOS' : 'FILTRAR CRÍTICOS ⚠️'}
              </button>
            </div>
          </div>
        )}

        {/* Inventory List */}
        <div className="overflow-x-auto flex-1 max-h-[680px] border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-blue-900 text-white font-black uppercase sticky top-0 z-10 text-[10px]">
              <tr>
                <th className="p-2.5">Artículo</th>
                <th className="p-2.5">Cód. Barra</th>
                <th className="p-2.5 text-center">Stock / Mínimo</th>
                <th className="p-2.5">Lote</th>
                <th className="p-2.5">Venc.</th>
                <th className="p-2.5">Costo Fac.</th>
                <th className="p-2.5">Detal (IVA)</th>
                <th className="p-2.5">Mayor (-5%)</th>
                <th className="p-2.5">Márgenes</th>
                <th className="p-2.5 text-center">Acciones</th>
                <th className="p-2.5 text-center">
                  <button
                    onClick={() => exportarInventarioCSV(inventarioFiltrado)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] px-2 py-1 rounded shadow-sm"
                  >
                    CSV
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 uppercase">
              {inventarioFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic font-medium">
                    {filtroSoloCriticos
                      ? 'No hay productos bajo el nivel mínimo establecido 🎉'
                      : 'No se encontraron artículos en inventario.'}
                  </td>
                </tr>
              ) : (
                inventarioFiltrado.map((prod, idx) => {
                  const stockNum = prod.stock || 0;
                  const stockMin = prod.stock_minimo !== undefined ? prod.stock_minimo : 0;
                  const esCritico = stockNum <= stockMin;
                  const esAdvertencia = !esCritico && stockNum <= stockMin + 3;

                  const costFact = prod.base_costo || 0;
                  const pvpDetal = prod.pvp_detal || 0;
                  const pvpMayor = prod.pvp_mayor || redondearExacto(pvpDetal * 0.95, 2);

                  const margenD = prod.base_pvp_detal > 0
                    ? ((prod.base_pvp_detal - prod.costo_u_prot) / prod.base_pvp_detal) * 100
                    : 0;
                  const margenM = (prod.base_pvp_detal * 0.95) > 0
                    ? (((prod.base_pvp_detal * 0.95) - prod.costo_u_prot) / (prod.base_pvp_detal * 0.95)) * 100
                    : 0;

                  return (
                    <tr
                      key={prod.rowid ? `${prod.rowid}_${idx}` : `${prod.sku}_${prod.nombre}_${idx}`}
                      onClick={() => cargarFichaProducto(prod)}
                      className={`transition cursor-pointer ${
                        esCritico
                          ? 'bg-red-50/90 hover:bg-red-100/90 border-l-4 border-l-red-600'
                          : esAdvertencia
                          ? 'bg-amber-50/50 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                          : 'hover:bg-blue-50/50'
                      }`}
                    >
                      <td className="p-2.5 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          {esCritico && (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          )}
                          <span>{prod.nombre}</span>
                        </div>
                        <span className="text-[10px] text-blue-600 font-extrabold">{prod.categoria}</span>
                      </td>
                      <td className="p-2.5 font-mono text-xs font-black text-slate-600">
                        {prod.sku}
                      </td>
                      <td className="p-2.5 text-center">
                        {esCritico ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded-lg shadow-sm animate-pulse whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{stockNum} / Mín: {stockMin}</span>
                            </span>
                            <span className="text-[8px] font-black text-red-700 uppercase tracking-tight mt-0.5">
                              {stockNum <= 0 ? 'AGOTADO (0)' : 'BAJO MÍNIMO'}
                            </span>
                          </div>
                        ) : esAdvertencia ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] px-2 py-0.5 rounded-lg whitespace-nowrap">
                              <span>{stockNum} (Mín: {stockMin})</span>
                            </span>
                            <span className="text-[8px] font-bold text-amber-800 uppercase tracking-tight mt-0.5">
                              POR AGOTARSE
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-0.5 rounded-lg font-black text-xs bg-blue-100 text-blue-900">
                              {stockNum}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                              Mín: {stockMin}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-xs text-slate-600 font-bold">{prod.lote || '-'}</td>
                      <td className="p-2.5 font-mono text-xs text-slate-600 font-bold">{prod.fecha_vencimiento || '-'}</td>
                      <td className="p-2.5 font-mono">$ {formatearVE(costFact)}</td>
                      <td className="p-2.5 font-mono text-emerald-700 font-black">
                        $ {formatearVE(pvpDetal)}
                      </td>
                      <td className="p-2.5 font-mono text-amber-700 font-black">
                        $ {formatearVE(pvpMayor)}
                      </td>
                      <td className="p-2.5 font-mono text-[10px] leading-tight">
                        <span className="block font-bold text-emerald-800">
                          DETAL: {formatearVE(margenD, 1)}%
                        </span>
                        <span className="block font-bold text-amber-800">
                          MAYOR: {formatearVE(margenM, 1)}%
                        </span>
                      </td>
                      <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => imprimirEtiquetaPOP(prod.nombre, pvpDetal, formatoImpresora)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] px-2 py-1 rounded shadow-sm cursor-pointer"
                            title="Imprimir etiqueta POP de estante en impresora del dispositivo"
                          >
                            🖨️ POP
                          </button>
                          <button
                            onClick={() => {
                              const tasa = StorageService.getTasas().tasaBcv || 1;
                              exportarEtiquetaPDF(prod.nombre, pvpDetal, tasa, prod.sku, prod.categoria);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] px-2 py-1 rounded shadow-sm cursor-pointer"
                            title="Descargar o guardar etiqueta POP como archivo PDF en cualquier dispositivo"
                          >
                            📄 PDF
                          </button>
                          <button
                            onClick={() => handleEliminar(prod)}
                            className="text-red-600 hover:text-red-900 font-black text-[10px] bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 cursor-pointer"
                            title="Eliminar artículo"
                          >
                            BORRAR
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal de Configuración Masiva de Mínimos */}
      <ConfiguracionMinimosModal
        isOpen={modalMinimosAbierto}
        onClose={() => setModalMinimosAbierto(false)}
        inventario={inventario}
        onGuardarMinimosMasivos={onGuardarMinimosMasivos || (async () => {})}
      />
    </div>
  );
};
