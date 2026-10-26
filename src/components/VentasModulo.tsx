import React, { useState, useMemo } from 'react';
import {
  Search,
  Camera,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  Zap,
  FileText,
  AlertTriangle,
  Sparkles,
  DollarSign,
  X,
  CheckCircle2,
  PackageX,
  Edit3,
  Layers,
  ArrowRight,
  Calendar,
  Download,
  Printer,
  Receipt,
  History,
} from 'lucide-react';
import { InventarioItem, CarritoItem, VentaRegistro, TasasCambio, MultiPayment } from '../types';
import { formatearVE, redondearExacto } from '../utils/formatters';
import { imprimirTicketPOS } from '../utils/printHelpers';
import { StorageService } from '../services/storage';
import { exportarReporteVentasPDF, exportarTicketPDF } from '../utils/pdfExport';

interface VentasModuloProps {
  inventario: InventarioItem[];
  ventas?: VentaRegistro[];
  tasas: TasasCambio;
  onProcesarVenta: (venta: {
    cliente: string;
    condicion_pago: 'CONTADO' | 'CRÉDITO';
    items: CarritoItem[];
    total_usd: number;
    total_bs: number;
    tasa_bcv: number;
    libro: 'FISCAL' | 'PRIVADO';
  }) => Promise<{ idVenta: string }>;
  onOpenScanner: (targetField: string) => void;
  onActualizarPrecioProducto?: (sku: string, rowId: string, nuevoPrecio: number) => Promise<void>;
}

export const VentasModulo: React.FC<VentasModuloProps> = ({
  inventario,
  ventas,
  tasas,
  onProcesarVenta,
  onOpenScanner,
  onActualizarPrecioProducto,
}) => {
  const [buscador, setBuscador] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODOS');
  const [filtroStock, setFiltroStock] = useState<'TODOS' | 'CON_STOCK' | 'SIN_STOCK'>('TODOS');
  const [cliente, setCliente] = useState('CLIENTE GENERAL');
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CRÉDITO'>('CONTADO');
  const [libroVenta, setLibroVenta] = useState<'FISCAL' | 'PRIVADO'>('FISCAL');
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [ventasFiltradasRango, setVentasFiltradasRango] = useState<VentaRegistro[]>([]);
  const [modalMultiPagoOpen, setModalMultiPagoOpen] = useState(false);
  const [pagosMultimoneda, setPagosMultimoneda] = useState<MultiPayment[]>([]);

  // Modal: Definir precio para producto que no tiene precio (o para personalizar)
  const [modalDefinirPrecio, setModalDefinirPrecio] = useState<{
    isOpen: boolean;
    producto: InventarioItem | null;
    precioUSD: string;
    cantidad: number;
    tarifa: 'DETAL' | 'MAYOR';
    guardarEnInventario: boolean;
    // Si viene de editar un item ya en el carrito
    carritoIndex?: number;
  }>({
    isOpen: false,
    producto: null,
    precioUSD: '',
    cantidad: 1,
    tarifa: 'DETAL',
    guardarEnInventario: true,
  });

  // Modal: Producto Rápido / Manual / Sin Registrar
  const [modalItemManualOpen, setModalItemManualOpen] = useState(false);
  const [manualNombre, setManualNombre] = useState('');
  const [manualPrecioUSD, setManualPrecioUSD] = useState('');
  const [manualCantidad, setManualCantidad] = useState(1);
  const [manualTarifa, setManualTarifa] = useState<'DETAL' | 'MAYOR'>('DETAL');

  // Modal: Advertencia / Confirmación de productos sin precio ($0.00) al cobrar
  const [modalConfirmarPreciosCero, setModalConfirmarPreciosCero] = useState(false);

  // Modal: Exportar Reporte de Ventas del Día a PDF
  const [modalExportarVentasDia, setModalExportarVentasDia] = useState(false);
  const [fechaExportarVentas, setFechaExportarVentas] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal: Venta completada con éxito y opciones directas de Imprimir / Guardar Ticket PDF
  const [ventaCompletadaModal, setVentaCompletadaModal] = useState<{
    idVenta: string;
    cliente: string;
    condicion: 'CONTADO' | 'CRÉDITO';
    items: CarritoItem[];
    totalUSD: number;
    totalBs: number;
    tasaBCV: number;
    metodo_pago: string;
  } | null>(null);

  // Panel colapsable de ventas recientes del día
  const [mostrarHistorialReciente, setMostrarHistorialReciente] = useState(false);

  // Available categories
  const categorias = useMemo(() => {
    const set = new Set<string>();
    set.add('TODOS');
    inventario.forEach((p) => {
      if (p.categoria) set.add(p.categoria.toUpperCase().trim());
    });
    return Array.from(set);
  }, [inventario]);

  // Counts for stock filter badges
  const stockCounts = useMemo(() => {
    let conStock = 0;
    let sinStock = 0;
    inventario.forEach((p) => {
      if (p.stock > 0) conStock++;
      else sinStock++;
    });
    return { total: inventario.length, conStock, sinStock };
  }, [inventario]);

  // Filtered catalog
  const catalogoFiltrado = useMemo(() => {
    const q = buscador.toLowerCase().trim();
    return inventario.filter((prod) => {
      // Category filter
      const matchCat = categoriaFiltro === 'TODOS' || prod.categoria?.toUpperCase().trim() === categoriaFiltro;
      if (!matchCat) return false;

      // Stock filter: TODOS, CON_STOCK (> 0), SIN_STOCK (<= 0)
      if (filtroStock === 'CON_STOCK' && prod.stock <= 0) return false;
      if (filtroStock === 'SIN_STOCK' && prod.stock > 0) return false;

      // Text / SKU filter
      if (!q) return true;
      return (
        prod.nombre.toLowerCase().includes(q) ||
        prod.sku.toLowerCase().includes(q) ||
        prod.categoria.toLowerCase().includes(q)
      );
    });
  }, [inventario, buscador, categoriaFiltro, filtroStock]);

  // Agregar directamente o solicitar definir precio si no tiene
  const handleSeleccionarProducto = (prod: InventarioItem) => {
    // Si el producto no tiene precio asignado (<= 0), abrimos el modal para definirlo
    if (!prod.pvp_detal || prod.pvp_detal <= 0) {
      setModalDefinirPrecio({
        isOpen: true,
        producto: prod,
        precioUSD: '',
        cantidad: 1,
        tarifa: 'DETAL',
        guardarEnInventario: true,
      });
      return;
    }

    // Si ya tiene precio, lo añadimos directamente al carrito
    // (Incluso si no tiene stock, se permite normalmente)
    agregarAlCarritoDirecto(prod, prod.pvp_detal, 1, 'DETAL', prod.stock <= 0);
  };

  const agregarAlCarritoDirecto = (
    prod: InventarioItem,
    precioUnitario: number,
    cantidad: number = 1,
    tarifa: 'DETAL' | 'MAYOR' = 'DETAL',
    sinStock: boolean = false
  ) => {
    setCarrito((prev) => {
      const index = prev.findIndex(
        (c) => (prod.rowid && c.rowId === prod.rowid) || (c.nombre === prod.nombre && c.sku === prod.sku)
      );
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          cantidad: updated[index].cantidad + cantidad,
          // Mantener o actualizar precio si es necesario
          precio_manual: precioUnitario > 0 ? precioUnitario : updated[index].precio_manual,
          sinStock: prod.stock <= 0,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            rowId: prod.rowid || '',
            sku: prod.sku || 'S/N',
            nombre: prod.nombre,
            precio_base_detal: precioUnitario,
            precio_manual: precioUnitario,
            tarifa,
            cantidad,
            sinStock,
            stockActual: prod.stock,
          },
        ];
      }
    });
    setBuscador('');
  };

  // Confirmar precio definido desde el modal
  const handleGuardarPrecioDefinido = async () => {
    const { producto, precioUSD, cantidad, tarifa, guardarEnInventario, carritoIndex } = modalDefinirPrecio;
    const precioNum = parseFloat(precioUSD) || 0;

    // Si venía de editar un item en el carrito
    if (carritoIndex !== undefined && carritoIndex >= 0) {
      setCarrito((prev) => {
        const updated = [...prev];
        if (updated[carritoIndex]) {
          updated[carritoIndex] = {
            ...updated[carritoIndex],
            precio_manual: precioNum,
            precio_base_detal: precioNum,
            tarifa,
          };
        }
        return updated;
      });
    } else if (producto) {
      // Viene del catálogo
      agregarAlCarritoDirecto(
        producto,
        precioNum,
        cantidad || 1,
        tarifa,
        producto.stock <= 0
      );

      // Si el usuario marcó guardar en inventario permanentemente
      if (guardarEnInventario && precioNum > 0 && onActualizarPrecioProducto) {
        try {
          await onActualizarPrecioProducto(producto.sku, producto.rowid, precioNum);
        } catch (err) {
          console.error('Error guardando precio en inventario:', err);
        }
      }
    }

    setModalDefinirPrecio({
      isOpen: false,
      producto: null,
      precioUSD: '',
      cantidad: 1,
      tarifa: 'DETAL',
      guardarEnInventario: true,
    });
  };

  // Abrir modal de precio para un item ya en el carrito
  const abrirEdicionPrecioCarrito = (index: number) => {
    const item = carrito[index];
    if (!item) return;

    // Buscar si existe en inventario
    const prod = inventario.find(
      (p) => (item.rowId && p.rowid === item.rowId) || (item.sku !== 'S/N' && p.sku === item.sku)
    ) || {
      nombre: item.nombre,
      sku: item.sku,
      stock: item.stockActual ?? 0,
      categoria: 'GENERAL',
      rowid: item.rowId,
      pvp_detal: item.precio_manual,
      base_pvp_detal: item.precio_base_detal,
      base_costo: 0,
      costo_con_iva: 0,
      costo_u_prot: 0,
      pvp_mayor: redondearExacto(item.precio_manual * 0.95, 2),
      cat_detal: true,
      cat_mayor: true,
      iva_tipo: '16',
    };

    setModalDefinirPrecio({
      isOpen: true,
      producto: prod as InventarioItem,
      precioUSD: item.precio_manual > 0 ? String(item.precio_manual) : '',
      cantidad: item.cantidad,
      tarifa: item.tarifa,
      guardarEnInventario: true,
      carritoIndex: index,
    });
  };

  // Agregar Producto Manual / Sin Stock / No Registrado
  const handleAgregarItemManual = () => {
    if (!manualNombre.trim()) {
      alert('Por favor introduce el nombre del producto.');
      return;
    }

    const pUSD = parseFloat(manualPrecioUSD) || 0;
    const cant = Math.max(1, manualCantidad || 1);

    setCarrito((prev) => [
      ...prev,
      {
        rowId: 'MANUAL_' + Date.now(),
        sku: 'MANUAL',
        nombre: manualNombre.trim().toUpperCase(),
        precio_base_detal: pUSD,
        precio_manual: pUSD,
        tarifa: manualTarifa,
        cantidad: cant,
        sinStock: true,
        stockActual: 0,
        esManual: true,
      },
    ]);

    setManualNombre('');
    setManualPrecioUSD('');
    setManualCantidad(1);
    setManualTarifa('DETAL');
    setModalItemManualOpen(false);
  };

  const actualizarCantidad = (index: number, delta: number) => {
    setCarrito((prev) => {
      const updated = [...prev];
      const newCant = updated[index].cantidad + delta;
      if (newCant <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], cantidad: newCant };
      }
      return updated;
    });
  };

  const actualizarCantidadManual = (index: number, val: string) => {
    const num = parseFloat(val);
    setCarrito((prev) => {
      const updated = [...prev];
      if (isNaN(num) || num <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], cantidad: num };
      }
      return updated;
    });
  };

  const cambiarTarifa = (index: number, tarifa: 'DETAL' | 'MAYOR') => {
    setCarrito((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const base = item.precio_base_detal > 0 ? item.precio_base_detal : item.precio_manual;
      const nuevoPrecio =
        tarifa === 'MAYOR'
          ? redondearExacto(base * 0.95, 2)
          : base;
      updated[index] = {
        ...item,
        tarifa,
        precio_manual: nuevoPrecio,
      };
      return updated;
    });
  };

  const actualizarPrecioManual = (index: number, val: string) => {
    const num = parseFloat(val);
    setCarrito((prev) => {
      const updated = [...prev];
      const nuevo = isNaN(num) ? 0 : num;
      updated[index] = {
        ...updated[index],
        precio_manual: nuevo,
        precio_base_detal: nuevo,
      };
      return updated;
    });
  };

  const eliminarItemCarrito = (index: number) => {
    setCarrito((prev) => prev.filter((_, idx) => idx !== index));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
  };

  // Cart totals
  const totalUSD = useMemo(() => {
    return redondearExacto(
      carrito.reduce((acc, item) => acc + item.precio_manual * item.cantidad, 0),
      2
    );
  }, [carrito]);

  const totalBs = useMemo(() => {
    return redondearExacto(totalUSD * (tasas.tasaBcv || 1), 2);
  }, [totalUSD, tasas.tasaBcv]);

  // Verificar si hay items con precio 0 antes de cobrar
  const itemsSinPrecio = useMemo(() => {
    return carrito.filter((it) => it.precio_manual <= 0);
  }, [carrito]);

  // Trigger checkout
  const [modoVentaPendiente, setModoVentaPendiente] = useState<'imprimir' | 'pdf'>('imprimir');

  const iniciarFinalizarVenta = (modo: 'imprimir' | 'pdf' = 'imprimir') => {
    if (carrito.length === 0) {
      alert('❌ La cesta de compras está vacía.');
      return;
    }

    setModoVentaPendiente(modo);

    if (itemsSinPrecio.length > 0) {
      setModalConfirmarPreciosCero(true);
      return;
    }

    ejecutarFinalizarVenta(modo);
  };

  const ejecutarFinalizarVenta = async (modo: 'imprimir' | 'pdf' = modoVentaPendiente) => {
    setModalConfirmarPreciosCero(false);
    setProcesando(true);

    const snapshotItems = [...carrito];
    const snapshotCliente = cliente.trim().toUpperCase() || 'CLIENTE GENERAL';
    const snapshotCondicion = condicionPago;
    const snapshotUSD = totalUSD;
    const snapshotBs = totalBs;
    const snapshotTasa = tasas.tasaBcv;

    try {
      const res = await onProcesarVenta({
        cliente: snapshotCliente,
        condicion_pago: snapshotCondicion,
        items: snapshotItems,
        total_usd: snapshotUSD,
        total_bs: snapshotBs,
        tasa_bcv: snapshotTasa,
        libro: libroVenta,
      });

      const formato = StorageService.getSettings().formatoImpresora;

      if (modo === 'pdf') {
        exportarTicketPDF(
          res.idVenta,
          snapshotCliente,
          snapshotCondicion,
          snapshotItems,
          snapshotUSD,
          snapshotBs,
          snapshotTasa,
          formato
        );
      } else {
        imprimirTicketPOS(
          res.idVenta,
          snapshotCliente,
          'V-XXXXXXXX-X',
          'VALENCIA, CARABOBO',
          '0000-0000000',
          snapshotCondicion,
          'EFECTIVO', // Payment method? Need to get it from somewhere.
          snapshotItems,
          snapshotUSD,
          snapshotBs,
          0,
          snapshotBs / 1.16,
          snapshotBs - (snapshotBs / 1.16),
          snapshotTasa,
          formato
        );
      }

      setVentaCompletadaModal({
        idVenta: res.idVenta,
        cliente: snapshotCliente,
        condicion: snapshotCondicion,
        items: snapshotItems,
        totalUSD: snapshotUSD,
        totalBs: snapshotBs,
        tasaBCV: snapshotTasa,
        metodo_pago: 'EFECTIVO' // Placeholder
      });

      vaciarCarrito();
    } catch (err: any) {
      alert('❌ Error procesando venta: ' + (err?.message || err));
    } finally {
      setProcesando(false);
    }
  };

  // Ventas disponibles para reportes
  const listaVentas = useMemo(() => ventas || StorageService.getVentas(), [ventas]);

  // Exportar reporte de ventas del día a PDF
  const handleExportarReporteDia = (fechaStr?: string) => {
    const f = fechaStr || new Date().toISOString().split('T')[0];
    exportarReporteVentasPDF(listaVentas, tasas, f);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Product Catalog Section */}
      <section className="lg:col-span-7 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
        {/* Top Controls: Search Bar, Camera, Manual Product */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              id="vender-buscador"
              value={buscador}
              onChange={(e) => setBuscador(e.target.value)}
              placeholder="ESCANEAR SKU O BUSCAR GOLOSINA..."
              className="w-full border-2 border-slate-300 bg-white p-2.5 pl-9 rounded-xl font-black text-xs uppercase focus:border-blue-600 outline-none pr-8 transition"
            />
            {buscador && (
              <button
                onClick={() => setBuscador('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-red-600 font-black text-sm"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onOpenScanner('vender-buscador')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-3 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Abrir lector de código de barras con la cámara"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">CAM</span>
            </button>

            <button
              onClick={() => setModalItemManualOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Añadir producto rápido sin registrar o sin inventario"
            >
              <Sparkles className="w-4 h-4" />
              <span>+ PRODUCTO RÁPIDO</span>
            </button>

            <button
              type="button"
              onClick={() => setModalExportarVentasDia(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Exportar reporte de ventas del día a formato PDF"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden md:inline">REPORTE DEL DÍA (PDF)</span>
              <span className="md:hidden">PDF DÍA</span>
            </button>
          </div>
        </div>

        {/* Stock Filter Pills & Category Pills */}
        <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
          {/* Stock Filter: TODOS / CON STOCK / SIN STOCK */}
          <div className="flex items-center gap-1 text-[11px] font-bold">
            <span className="text-slate-500 text-[10px] uppercase font-black mr-1 hidden md:inline">
              Filtro Existencias:
            </span>
            <button
              onClick={() => setFiltroStock('TODOS')}
              className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer text-[10px] ${
                filtroStock === 'TODOS'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              📦 TODOS ({stockCounts.total})
            </button>
            <button
              onClick={() => setFiltroStock('CON_STOCK')}
              className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer text-[10px] ${
                filtroStock === 'CON_STOCK'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              ✅ CON STOCK ({stockCounts.conStock})
            </button>
            <button
              onClick={() => setFiltroStock('SIN_STOCK')}
              className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer text-[10px] ${
                filtroStock === 'SIN_STOCK'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
              }`}
            >
              ⚠️ SIN STOCK ({stockCounts.sinStock})
            </button>
          </div>

          <div className="text-[10px] font-bold text-slate-500 italic">
            * Se permite vender productos con y sin stock.
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition whitespace-nowrap cursor-pointer ${
                categoriaFiltro === cat
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Catalog Table */}
        <div className="overflow-x-auto max-h-[480px] border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-blue-900 text-white font-black uppercase sticky top-0 z-10 text-[11px]">
              <tr>
                <th className="p-2.5">Golosina / Categ.</th>
                <th className="p-2.5 text-center">Stock</th>
                <th className="p-2.5">PVP Detal</th>
                <th className="p-2.5">PVP Mayor (-5%)</th>
                <th className="p-2.5 text-center">Añadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 uppercase">
              {catalogoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic font-medium">
                    No se encontraron golosinas con ese criterio de búsqueda.
                  </td>
                </tr>
              ) : (
                catalogoFiltrado.map((prod, idx) => {
                  const tienePrecio = prod.pvp_detal > 0;
                  const pvpMayor = tienePrecio ? redondearExacto(prod.pvp_detal * 0.95, 2) : 0;
                  const stockMin = prod.stock_minimo !== undefined ? prod.stock_minimo : 0;
                  const sinStock = prod.stock <= 0;
                  const stockBajo = !sinStock && prod.stock <= stockMin;

                  return (
                    <tr
                      key={prod.rowid ? `${prod.rowid}_${idx}` : `${prod.sku}_${prod.nombre}_${idx}`}
                      onClick={() => handleSeleccionarProducto(prod)}
                      className={`hover:bg-blue-50/70 transition cursor-pointer ${
                        sinStock ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="p-2.5 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{prod.nombre}</span>
                          {sinStock && (
                            <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-300">
                              SIN STOCK
                            </span>
                          )}
                          {!tienePrecio && (
                            <span className="text-[9px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                              SIN PRECIO
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-blue-600 font-mono font-bold tracking-tight">
                          {prod.sku} • {prod.categoria}
                        </span>
                      </td>

                      {/* Stock Column with clear visual state */}
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-black inline-flex items-center gap-1 ${
                            sinStock
                              ? 'bg-rose-600 text-white shadow-sm'
                              : stockBajo
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                          title={
                            sinStock
                              ? 'Producto sin stock disponible. ¡Venta permitida!'
                              : `Stock: ${prod.stock} / Mínimo: ${stockMin}`
                          }
                        >
                          {sinStock && <AlertTriangle className="w-3 h-3 text-white inline" />}
                          {prod.stock}
                        </span>
                      </td>

                      {/* Price Column */}
                      <td className="p-2.5 font-mono">
                        {tienePrecio ? (
                          <div>
                            <div className="text-emerald-700 font-black">
                              $ {formatearVE(prod.pvp_detal)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Bs. {formatearVE(redondearExacto(prod.pvp_detal * tasas.tasaBcv, 2))}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeleccionarProducto(prod);
                            }}
                            className="text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>DEFINIR PRECIO</span>
                          </button>
                        )}
                      </td>

                      {/* PVP Mayor Column */}
                      <td className="p-2.5 font-mono text-amber-700 font-black">
                        {tienePrecio ? `$ ${formatearVE(pvpMayor)}` : '—'}
                      </td>

                      {/* Add Button */}
                      <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSeleccionarProducto(prod)}
                          className={`font-black text-[10px] px-2.5 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer inline-flex items-center gap-1 ${
                            !tienePrecio
                              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                              : sinStock
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          title={
                            !tienePrecio
                              ? 'Definir precio y añadir'
                              : sinStock
                              ? 'Añadir producto sin stock'
                              : 'Añadir al carrito'
                          }
                        >
                          {!tienePrecio ? (
                            <>
                              <DollarSign className="w-3 h-3" />
                              <span>DEFINIR</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>{sinStock ? 'AÑADIR (0 STOCK)' : 'AÑADIR'}</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cart & Billing Section */}
      <section className="lg:col-span-5 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between space-y-4">
        <div>
          {/* Cart Header */}
          <div className="border-b pb-2 mb-3 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-900" />
              <h3 className="font-black text-blue-900 uppercase text-sm tracking-wide">
                Cesta de Compra Actual ({carrito.length})
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setModalExportarVentasDia(true)}
                className="text-xs font-bold text-emerald-900 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Exportar reporte de ventas del día a PDF (filtrado por fecha)"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>PDF DEL DÍA</span>
              </button>
              <button
                type="button"
                onClick={() => exportarReporteVentasPDF(listaVentas, tasas)}
                className="text-xs font-bold text-blue-900 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition cursor-pointer flex items-center gap-1"
                title="Descargar libro general de ventas en PDF"
              >
                <FileText className="w-3.5 h-3.5 text-blue-700" />
                <span>TODO PDF</span>
              </button>
              {carrito.length > 0 && (
                <button
                  onClick={vaciarCarrito}
                  className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg border border-red-200 transition cursor-pointer"
                >
                  VACIAR 🧹
                </button>
              )}
            </div>
          </div>

          {/* Customer & Payment Conditions */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">
                Libro
              </label>
              <select
                value={libroVenta}
                onChange={(e) => setLibroVenta(e.target.value as any)}
                className="w-full border-2 border-blue-500 bg-blue-50 p-2 rounded-xl font-black text-xs outline-none text-blue-950"
              >
                <option value="FISCAL">FISCAL</option>
                <option value="PRIVADO">PRIVADO</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">
                Condición de Pago
              </label>
              <select
                value={condicionPago}
                onChange={(e) => setCondicionPago(e.target.value as any)}
                className={`w-full border-2 p-2 rounded-xl font-black text-xs outline-none transition ${
                  condicionPago === 'CONTADO'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                    : 'border-purple-500 bg-purple-50 text-purple-950'
                }`}
              >
                <option value="CONTADO">CONTADO</option>
                <option value="CRÉDITO">CRÉDITO</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">
                Cliente
              </label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="CLIENTE GENERAL"
                className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl font-bold uppercase text-xs outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Cart Items Table */}
          <div className="overflow-x-auto max-h-[300px] border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-800 text-white font-black uppercase text-[10px] sticky top-0 z-10">
                <tr>
                  <th className="p-2">Producto</th>
                  <th className="p-2 text-center">Cant.</th>
                  <th className="p-2 text-center">Tarifa</th>
                  <th className="p-2">Precio U. ($)</th>
                  <th className="p-2 text-right">Subtotal</th>
                  <th className="p-2 text-center">✕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 uppercase">
                {carrito.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                      <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                      CESTA DE COMPRAS VACÍA 🛒
                    </td>
                  </tr>
                ) : (
                  carrito.map((item, idx) => {
                    const subtotal = redondearExacto(item.precio_manual * item.cantidad, 2);
                    const subtotalBs = redondearExacto(subtotal * tasas.tasaBcv, 2);
                    const tienePrecioCero = item.precio_manual <= 0;

                    return (
                      <tr
                        key={`${item.sku}_${idx}`}
                        className={`hover:bg-slate-50 ${
                          tienePrecioCero ? 'bg-amber-50/70' : item.sinStock ? 'bg-rose-50/30' : ''
                        }`}
                      >
                        <td className="p-2 font-bold text-slate-800">
                          <div className="flex items-center gap-1">
                            <span>{item.nombre}</span>
                            {item.esManual && (
                              <span className="text-[8px] bg-purple-100 text-purple-900 px-1 rounded font-black">
                                MANUAL
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-slate-400 font-mono">{item.sku}</span>
                            {item.sinStock && (
                              <span className="text-[8px] bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-black border border-rose-300">
                                SIN STOCK
                              </span>
                            )}
                            {tienePrecioCero && (
                              <span className="text-[8px] bg-amber-200 text-amber-950 px-1 py-0.2 rounded font-black animate-pulse">
                                REQUIERE PRECIO
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="p-2 text-center">
                          <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                            <button
                              onClick={() => actualizarCantidad(idx, -1)}
                              className="px-1.5 py-1 text-slate-500 hover:bg-slate-100 font-bold cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              step="any"
                              value={item.cantidad}
                              onChange={(e) => actualizarCantidadManual(idx, e.target.value)}
                              className="w-10 text-center font-black text-xs outline-none"
                            />
                            <button
                              onClick={() => actualizarCantidad(idx, 1)}
                              className="px-1.5 py-1 text-slate-500 hover:bg-slate-100 font-bold cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Tarifa */}
                        <td className="p-2 text-center">
                          <select
                            value={item.tarifa}
                            onChange={(e) => cambiarTarifa(idx, e.target.value as any)}
                            className={`border rounded p-1 text-[10px] font-black ${
                              item.tarifa === 'MAYOR'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-blue-100 text-blue-900 border-blue-300'
                            }`}
                          >
                            <option value="DETAL">DETAL</option>
                            <option value="MAYOR">MAYOR (-5%)</option>
                          </select>
                        </td>

                        {/* Price Input with Direct Edit & Definition Helper */}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="any"
                              value={item.precio_manual === 0 ? '' : item.precio_manual}
                              onChange={(e) => actualizarPrecioManual(idx, e.target.value)}
                              placeholder="0.00"
                              className={`w-16 border-2 p-1 rounded font-mono font-black text-xs text-center outline-none transition ${
                                tienePrecioCero
                                  ? 'border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-300'
                                  : 'border-emerald-500 bg-emerald-50 text-emerald-950'
                              }`}
                              title="Modificar precio unitario en USD para este producto"
                            />
                            <button
                              onClick={() => abrirEdicionPrecioCarrito(idx)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 cursor-pointer"
                              title="Definir precio con cálculo en Bs. y opción de guardar en inventario"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Subtotal */}
                        <td className="p-2 font-mono text-right">
                          <div className="font-black text-emerald-700">
                            $ {formatearVE(subtotal)}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Bs. {formatearVE(subtotalBs)}
                          </div>
                        </td>

                        {/* Delete */}
                        <td className="p-2 text-center">
                          <button
                            onClick={() => eliminarItemCarrito(idx)}
                            className="text-red-500 hover:text-red-800 p-1 rounded hover:bg-red-50 cursor-pointer"
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

        {/* Totals & Submit Button */}
        <div className="bg-gradient-to-br from-slate-950 to-slate-900 text-white p-4 rounded-2xl space-y-3 border border-slate-800 shadow-lg">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Venta en USD:</span>
            <span className="text-2xl font-mono font-black text-emerald-400">
              $ {formatearVE(totalUSD)}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-800 pt-2">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase block">Total en Bolívares:</span>
              <span className="text-[10px] text-blue-300 font-mono">
                Tasa BCV: {formatearVE(tasas.tasaBcv)}
              </span>
            </div>
            <span className="text-2xl font-mono font-black text-blue-400">
              Bs. {formatearVE(totalBs)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => iniciarFinalizarVenta('imprimir')}
              disabled={procesando || carrito.length === 0}
              className={`py-3 px-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg ${
                carrito.length > 0 && !procesando
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/30 active:scale-98 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title="Registrar venta e imprimir ticket en impresora térmica"
            >
              <Printer className="w-4 h-4 text-emerald-200" />
              <span>{procesando ? 'PROCESANDO...' : '🖨️ IMPRIMIR TICKET'}</span>
            </button>

            <button
              onClick={() => iniciarFinalizarVenta('pdf')}
              disabled={procesando || carrito.length === 0}
              className={`py-3 px-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg ${
                carrito.length > 0 && !procesando
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-700/30 active:scale-98 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title="Registrar venta y descargar/guardar ticket como archivo PDF en este dispositivo"
            >
              <Download className="w-4 h-4 text-blue-200" />
              <span>{procesando ? 'PROCESANDO...' : '📄 GUARDAR TICKET PDF'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ================= SECCIÓN: HISTORIAL DE VENTAS RECIENTES (IMPRIMIR / TICKET PDF) ================= */}
      <section className="col-span-1 lg:col-span-12 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-900" />
            <h3 className="font-black text-xs text-slate-900 uppercase">
              Ventas Recientes Registradas ({listaVentas.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setMostrarHistorialReciente(!mostrarHistorialReciente)}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>{mostrarHistorialReciente ? 'Ocultar Listado ▲' : 'Ver Últimas Facturas ▼'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="border p-1.5 rounded text-xs" />
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="border p-1.5 rounded text-xs" />
          <button onClick={() => setVentasFiltradasRango(listaVentas.filter(v => v.fecha >= fechaInicio && v.fecha <= fechaFin))} className="bg-blue-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">Filtrar</button>
          {ventasFiltradasRango.length > 0 && (
            <button onClick={async () => {
              const formato = StorageService.getSettings().formatoImpresora;
              for (const v of ventasFiltradasRango) {
                let vItems: any[] = [];
                try { vItems = typeof v.items_json === 'string' ? JSON.parse(v.items_json) : (v.items_json || []); } catch {}
                imprimirTicketPOS(v.id_venta, v.cliente, 'V-XXXXXXXX-X', 'VALENCIA, CARABOBO', '0000-0000000', v.condicion_pago as any, v.metodo_pago, vItems, v.total_usd, v.total_bs, 0, (v.total_bs || 0) / 1.16, (v.total_bs || 0) - ((v.total_bs || 0) / 1.16), v.tasa_bcv || tasas.tasaBcv, formato);
                await new Promise(r => setTimeout(r, 2000));
              }
            }} className="bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">Reimprimir {ventasFiltradasRango.length} tickets</button>
          )}
        </div>

        {mostrarHistorialReciente && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[300px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800 text-white uppercase text-[10px] sticky top-0 z-10">
                <tr>
                  <th className="p-2.5">Factura N°</th>
                  <th className="p-2.5">Fecha y Hora</th>
                  <th className="p-2.5">Cliente</th>
                  <th className="p-2.5">Condición</th>
                  <th className="p-2.5 text-right">Total ($)</th>
                  <th className="p-2.5 text-right">Total (Bs)</th>
                  <th className="p-2.5 text-center">Acciones Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 uppercase">
                {listaVentas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                      No hay ventas registradas aún en el sistema.
                    </td>
                  </tr>
                ) : (
                  listaVentas.slice(0, 20).map((v, i) => {
                    let vItems: any[] = [];
                    try {
                      vItems = typeof v.items_json === 'string' ? JSON.parse(v.items_json) : (v.items_json || []);
                    } catch {
                      vItems = [];
                    }

                    return (
                      <tr key={v.id_venta} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-bold text-blue-900">{v.id_venta || '---'}</td>
                        <td className="p-2 text-slate-500 text-[11px]">{v.fecha}</td>
                        <td className="p-2 font-bold text-slate-800">{v.cliente || 'CLIENTE GENERAL'}</td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                              v.condicion_pago === 'CRÉDITO'
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}
                          >
                            {v.condicion_pago || 'CONTADO'}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700">
                          $ {formatearVE(v.total_usd || 0)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-blue-900">
                          Bs. {formatearVE(v.total_bs || 0)}
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const formato = StorageService.getSettings().formatoImpresora;
                                imprimirTicketPOS(
                                  v.id_venta || 'REC',
                                  v.cliente || 'CLIENTE GENERAL',
                                  (v.condicion_pago as any) || 'CONTADO',
                                  vItems,
                                  v.total_usd || 0,
                                  v.total_bs || 0,
                                  v.tasa_bcv || tasas.tasaBcv,
                                  formato
                                );
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] px-2 py-1 rounded shadow-2xs cursor-pointer flex items-center gap-1"
                              title="Imprimir ticket térmico en impresora"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Imprimir</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const formato = StorageService.getSettings().formatoImpresora;
                                exportarTicketPDF(
                                  v.id_venta || 'REC',
                                  v.cliente || 'CLIENTE GENERAL',
                                  (v.condicion_pago as any) || 'CONTADO',
                                  vItems,
                                  v.total_usd || 0,
                                  v.total_bs || 0,
                                  v.tasa_bcv || tasas.tasaBcv,
                                  formato
                                );
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] px-2 py-1 rounded shadow-2xs cursor-pointer flex items-center gap-1"
                              title="Descargar o guardar ticket como archivo PDF"
                            >
                              <Download className="w-3 h-3" />
                              <span>PDF</span>
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
        )}
      </section>

      {/* ================= MODAL: DEFINIR PRECIO DE PRODUCTO ================= */}
      {modalDefinirPrecio.isOpen && modalDefinirPrecio.producto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-sm uppercase">Definir Precio de Venta</h3>
              </div>
              <button
                onClick={() =>
                  setModalDefinirPrecio((prev) => ({ ...prev, isOpen: false, producto: null }))
                }
                className="text-blue-200 hover:text-white font-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Product Info Card */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-black text-sm text-slate-900">
                  {modalDefinirPrecio.producto.nombre}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                  <span>SKU: {modalDefinirPrecio.producto.sku}</span>
                  <span>•</span>
                  <span>Categ: {modalDefinirPrecio.producto.categoria}</span>
                </div>

                {/* Stock notice */}
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded ${
                      modalDefinirPrecio.producto.stock <= 0
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Stock actual: {modalDefinirPrecio.producto.stock}
                  </span>
                  {modalDefinirPrecio.producto.stock <= 0 && (
                    <span className="text-[10px] text-rose-600 font-bold">
                      (Sin stock físico - Venta autorizada)
                    </span>
                  )}
                </div>
              </div>

              {/* Price Definition Form */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                    Precio Unitario en USD ($):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-black text-slate-400">$</span>
                    <input
                      type="number"
                      step="any"
                      autoFocus
                      value={modalDefinirPrecio.precioUSD}
                      onChange={(e) =>
                        setModalDefinirPrecio((prev) => ({ ...prev, precioUSD: e.target.value }))
                      }
                      placeholder="0.00"
                      className="w-full border-2 border-emerald-500 bg-emerald-50/50 p-2.5 pl-8 rounded-xl font-mono font-black text-lg text-emerald-950 outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  {/* Realtime conversion to Bs. */}
                  {parseFloat(modalDefinirPrecio.precioUSD) > 0 && (
                    <div className="mt-1 text-xs font-bold text-blue-700 bg-blue-50 p-2 rounded-lg border border-blue-200">
                      ≈ Bs.{' '}
                      {formatearVE(
                        redondearExacto(
                          parseFloat(modalDefinirPrecio.precioUSD) * tasas.tasaBcv,
                          2
                        )
                      )}{' '}
                      <span className="text-[10px] text-slate-500">
                        (Tasa BCV: {formatearVE(tasas.tasaBcv)})
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase block mb-1">
                      Cantidad:
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={modalDefinirPrecio.cantidad}
                      onChange={(e) =>
                        setModalDefinirPrecio((prev) => ({
                          ...prev,
                          cantidad: Math.max(1, parseFloat(e.target.value) || 1),
                        }))
                      }
                      className="w-full border-2 border-slate-300 p-2 rounded-xl font-black text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase block mb-1">
                      Tarifa:
                    </label>
                    <select
                      value={modalDefinirPrecio.tarifa}
                      onChange={(e) =>
                        setModalDefinirPrecio((prev) => ({
                          ...prev,
                          tarifa: e.target.value as any,
                        }))
                      }
                      className="w-full border-2 border-slate-300 p-2 rounded-xl font-black text-xs outline-none bg-white"
                    >
                      <option value="DETAL">DETAL (100%)</option>
                      <option value="MAYOR">MAYOR (-5%)</option>
                    </select>
                  </div>
                </div>

                {/* Option to persist price in inventory */}
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                  <input
                    type="checkbox"
                    checked={modalDefinirPrecio.guardarEnInventario}
                    onChange={(e) =>
                      setModalDefinirPrecio((prev) => ({
                        ...prev,
                        guardarEnInventario: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-slate-700">
                    💾 Guardar este precio permanentemente en el inventario para futuras ventas
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    setModalDefinirPrecio((prev) => ({ ...prev, isOpen: false, producto: null }))
                  }
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarPrecioDefinido}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Añadir a la Cesta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PAGO MULTIMONEDA ================= */}
      {modalMultiPagoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden p-5 space-y-4">
            <h3 className="font-black text-sm uppercase">Cobro Multimoneda</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <select id="metodo-pago-input" className="col-span-1 border p-2 rounded-xl text-xs">
                  <option value="EFECTIVO_BS">Efectivo Bs</option>
                  <option value="EFECTIVO_USD">Efectivo USD</option>
                  <option value="PAGO_MOVIL">Pago Móvil</option>
                  <option value="DEBITO">Débito</option>
                </select>
                <input type="number" id="monto-bs-input" placeholder="Monto Bs." className="border p-2 rounded-xl text-xs" />
                <input type="number" id="monto-usd-input" placeholder="Monto USD" className="border p-2 rounded-xl text-xs" />
              </div>
              <button onClick={() => {
                const metodo = (document.getElementById('metodo-pago-input') as HTMLSelectElement).value as any;
                const montoBs = parseFloat((document.getElementById('monto-bs-input') as HTMLInputElement).value) || 0;
                const montoUsd = parseFloat((document.getElementById('monto-usd-input') as HTMLInputElement).value) || 0;
                setPagosMultimoneda([...pagosMultimoneda, { metodo, montoBs, montoUsd }]);
              }} className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-xs">Añadir Pago</button>
            </div>
            <div className="space-y-2 border-t pt-2">
              {pagosMultimoneda.map((p, i) => (
                <div key={i} className="flex gap-2 text-xs items-center">
                  <span className="flex-1 font-bold">{p.metodo}</span>
                  <span className="w-20 font-mono">Bs. {formatearVE(p.montoBs)}</span>
                  <span className="w-20 font-mono">$ {formatearVE(p.montoUsd)}</span>
                  <button onClick={() => setPagosMultimoneda(pagosMultimoneda.filter((_, idx) => idx !== i))} className="text-red-500 font-bold">✕</button>
                </div>
              ))}
            </div>
            
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between text-xs font-bold"><span>Total Venta:</span><span>Bs. {formatearVE(totalBs)}</span></div>
              <div className="flex justify-between text-xs font-bold"><span>Total Pagado:</span><span>Bs. {formatearVE(pagosMultimoneda.reduce((acc, p) => acc + p.montoBs + (p.montoUsd * tasas.tasaBcv), 0))}</span></div>
              <div className="flex justify-between text-xs font-black text-emerald-700"><span>Vuelto:</span><span>Bs. {formatearVE(Math.max(0, pagosMultimoneda.reduce((acc, p) => acc + p.montoBs + (p.montoUsd * tasas.tasaBcv), 0) - totalBs))}</span></div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setModalMultiPagoOpen(false)} className="flex-1 py-2 bg-slate-200 rounded-xl font-bold text-xs">Cancelar</button>
              <button 
                onClick={() => {
                  if (pagosMultimoneda.reduce((acc, p) => acc + p.montoBs + (p.montoUsd * tasas.tasaBcv), 0) >= totalBs) {
                    ejecutarFinalizarVenta();
                    setModalMultiPagoOpen(false);
                  } else {
                    alert("El monto pagado es insuficiente.");
                  }
                }}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs"
              >Finalizar Venta</button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: PRODUCTO RÁPIDO / MANUAL ================= */}
      {modalItemManualOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-amber-500 text-slate-950 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-black text-sm uppercase">Producto Rápido / Manual</h3>
              </div>
              <button
                onClick={() => setModalItemManualOpen(false)}
                className="text-slate-900 hover:text-black font-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 font-medium">
                Vende un producto que no está registrado en el inventario o que no tiene stock físico,
                definiendo su precio y nombre al instante.
              </p>

              <div>
                <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                  Nombre del Producto / Golosina: *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={manualNombre}
                  onChange={(e) => setManualNombre(e.target.value)}
                  placeholder="EJ: CARAMELO SUELTO / CHUPETÍN ESPECIAL"
                  className="w-full border-2 border-slate-300 p-2.5 rounded-xl font-bold uppercase text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                  Precio Unitario en USD ($): *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-black text-slate-400">$</span>
                  <input
                    type="number"
                    step="any"
                    value={manualPrecioUSD}
                    onChange={(e) => setManualPrecioUSD(e.target.value)}
                    placeholder="0.00"
                    className="w-full border-2 border-emerald-500 bg-emerald-50/50 p-2.5 pl-8 rounded-xl font-mono font-black text-lg text-emerald-950 outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                {parseFloat(manualPrecioUSD) > 0 && (
                  <div className="mt-1 text-xs font-bold text-blue-700 bg-blue-50 p-2 rounded-lg border border-blue-200">
                    ≈ Bs.{' '}
                    {formatearVE(
                      redondearExacto(parseFloat(manualPrecioUSD) * tasas.tasaBcv, 2)
                    )}{' '}
                    <span className="text-[10px] text-slate-500">
                      (Tasa BCV: {formatearVE(tasas.tasaBcv)})
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-600 uppercase block mb-1">
                    Cantidad:
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={manualCantidad}
                    onChange={(e) =>
                      setManualCantidad(Math.max(1, parseFloat(e.target.value) || 1))
                    }
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-black text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-600 uppercase block mb-1">
                    Tarifa:
                  </label>
                  <select
                    value={manualTarifa}
                    onChange={(e) => setManualTarifa(e.target.value as any)}
                    className="w-full border-2 border-slate-300 p-2 rounded-xl font-black text-xs outline-none bg-white"
                  >
                    <option value="DETAL">DETAL (100%)</option>
                    <option value="MAYOR">MAYOR (-5%)</option>
                  </select>
                </div>
              </div>

              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Este producto se añadirá como ítem sin stock previo y se incluirá en el ticket POS.
                </span>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalItemManualOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAgregarItemManual}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir a la Cesta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADVERTENCIA PRODUCTOS SIN PRECIO AL COBRAR ================= */}
      {modalConfirmarPreciosCero && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-amber-600 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-200" />
                <h3 className="font-black text-sm uppercase">Productos sin Precio Asignado</h3>
              </div>
              <button
                onClick={() => setModalConfirmarPreciosCero(false)}
                className="text-amber-100 hover:text-white font-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 font-bold">
                Los siguientes productos en la cesta tienen precio <span className="text-red-600">$0.00</span>:
              </p>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {itemsSinPrecio.map((item, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="font-black text-slate-800">{item.nombre}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {item.cantidad} unidad(es) • {item.sku}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const originalIdx = carrito.indexOf(item);
                        setModalConfirmarPreciosCero(false);
                        if (originalIdx >= 0) abrirEdicionPrecioCarrito(originalIdx);
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      DEFINIR $
                    </button>
                  </div>
                ))}
              </div>

              <div className="text-xs text-slate-600">
                Puedes definir el precio de cada producto ahora o continuar registrándolos con valor $0.00 (muestra o cortesía).
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalConfirmarPreciosCero(false)}
                  className="w-full py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black text-xs cursor-pointer shadow-sm"
                >
                  Regresar a la Cesta y Definir Precios
                </button>
                <button
                  type="button"
                  onClick={() => ejecutarFinalizarVenta()}
                  className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-800 font-bold text-xs cursor-pointer hover:bg-slate-100"
                >
                  Continuar con $0.00 (Gratis / Muestra)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EXPORTAR REPORTE DE VENTAS DEL DÍA A PDF ================= */}
      {modalExportarVentasDia && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-800 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-300" />
                <h3 className="font-black text-sm uppercase">Exportar Reporte de Ventas a PDF</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalExportarVentasDia(false)}
                className="text-emerald-200 hover:text-white font-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Selecciona la fecha para emitir el reporte oficial de facturas, totales en divisas y bolívares:
              </p>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Fecha de Ventas a Exportar:
                </label>
                <input
                  type="date"
                  value={fechaExportarVentas}
                  onChange={(e) => setFechaExportarVentas(e.target.value)}
                  className="w-full border-2 border-slate-300 bg-white p-2.5 rounded-xl font-black text-xs outline-none focus:border-emerald-600"
                />
              </div>

              {/* Conteo de ventas en esa fecha */}
              {(() => {
                const ventasEseDia = listaVentas.filter((v) => {
                  const vFecha = (v.fecha || '').trim();
                  return vFecha === fechaExportarVentas || vFecha.startsWith(fechaExportarVentas);
                });
                const totalUsdDia = ventasEseDia.reduce((acc, v) => acc + (v.total_usd || 0), 0);
                const totalBsDia = ventasEseDia.reduce((acc, v) => acc + (v.total_bs || 0), 0);

                return (
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-emerald-950 flex justify-between">
                      <span>Ventas encontradas:</span>
                      <span className="font-mono font-black">{ventasEseDia.length} factura(s)</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-mono">
                      <span>Total Facturado:</span>
                      <span className="font-black text-emerald-700">
                        $ {formatearVE(totalUsdDia)} / Bs. {formatearVE(totalBsDia)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    handleExportarReporteDia(fechaExportarVentas);
                    setModalExportarVentasDia(false);
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>DESCARGAR REPORTE DEL DÍA (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    exportarReporteVentasPDF(listaVentas, tasas);
                    setModalExportarVentasDia(false);
                  }}
                  className="w-full py-2 rounded-xl text-blue-900 hover:bg-blue-50 font-black text-xs cursor-pointer border border-blue-200 transition"
                >
                  Descargar Histórico Completo (Todas las Ventas)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: VENTA COMPLETADA CON ÉXITO ================= */}
      {ventaCompletadaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-5 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-white/40 shadow-inner">
                <CheckCircle2 className="w-9 h-9 text-emerald-100" />
              </div>
              <h3 className="font-black text-base uppercase tracking-wide">
                ¡Venta Registrada con Éxito!
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5 font-mono">
                Factura #{ventaCompletadaModal.idVenta} • {ventaCompletadaModal.cliente}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary box */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Cobrado</span>
                  <span className="text-xl font-mono font-black text-emerald-700 block">
                    $ {formatearVE(ventaCompletadaModal.totalUSD)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">En Bolívares</span>
                  <span className="text-lg font-mono font-black text-blue-900 block">
                    Bs. {formatearVE(ventaCompletadaModal.totalBs)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 text-center">
                ¿Deseas imprimir el comprobante físico o guardar el ticket como archivo PDF en este dispositivo?
              </p>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const formato = StorageService.getSettings().formatoImpresora;
                    imprimirTicketPOS(
                      ventaCompletadaModal.idVenta,
                      ventaCompletadaModal.cliente,
                      'V-XXXXXXXX-X', // Client RIF
                      'VALENCIA, CARABOBO', // Client Address
                      '0000-0000000', // Client Phone
                      ventaCompletadaModal.condicion,
                      ventaCompletadaModal.metodo_pago,
                      ventaCompletadaModal.items,
                      ventaCompletadaModal.totalUSD,
                      ventaCompletadaModal.totalBs,
                      0, // Total Exento
                      ventaCompletadaModal.totalBs / 1.16, // Base Imponible (est.)
                      ventaCompletadaModal.totalBs - (ventaCompletadaModal.totalBs / 1.16), // Total IVA (est.)
                      ventaCompletadaModal.tasaBCV,
                      formato
                    );
                  }}
                  className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition cursor-pointer flex flex-col items-center gap-1 shadow-sm"
                >
                  <Printer className="w-5 h-5 text-emerald-200" />
                  <span>🖨️ IMPRIMIR TICKET</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const formato = StorageService.getSettings().formatoImpresora;
                    exportarTicketPDF(
                      ventaCompletadaModal.idVenta,
                      ventaCompletadaModal.cliente,
                      ventaCompletadaModal.condicion,
                      ventaCompletadaModal.items,
                      ventaCompletadaModal.totalUSD,
                      ventaCompletadaModal.totalBs,
                      ventaCompletadaModal.tasaBCV,
                      formato
                    );
                  }}
                  className="p-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition cursor-pointer flex flex-col items-center gap-1 shadow-sm"
                >
                  <Download className="w-5 h-5 text-blue-200" />
                  <span>📄 GUARDAR TICKET PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setVentaCompletadaModal(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>➕ NUEVA VENTA / CONTINUAR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
