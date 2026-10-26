import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { VentasModulo } from './components/VentasModulo';
import { InventarioModulo } from './components/InventarioModulo';
import { ComprasModulo } from './components/ComprasModulo';
import { HistorialProvModulo } from './components/HistorialProvModulo';
import { DashboardModulo } from './components/DashboardModulo';
import { ConciliacionModulo } from './components/ConciliacionModulo';
import { GastosBalanceModulo } from './components/GastosBalanceModulo';
import { DeudoresModulo } from './components/DeudoresModulo';
import { CameraScannerModal } from './components/CameraScannerModal';
import { OfflineQueueModal } from './components/OfflineQueueModal';
import { SettingsModal } from './components/SettingsModal';
import { GoogleDriveBackupModal } from './components/GoogleDriveBackupModal';
import { ModalPinSeguridad } from './components/ModalPinSeguridad';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { StorageService } from './services/storage';
import { ApiService } from './services/api';
import {
  InventarioItem,
  CompraItem,
  Proveedor,
  VentaRegistro,
  TasasCambio,
  OfflineAction,
  CarritoItem,
  CierreCajaConciliacion,
  GastoItem,
} from './types';
import { WifiOff, ShoppingBag, Package, ShoppingCart, History, BarChart3, CreditCard, TrendingDown, Lock, Unlock, ShieldCheck, Receipt } from 'lucide-react';
import { redondearExacto } from './utils/formatters';

type ModuloTipo =
  | 'ventas'
  | 'inventario'
  | 'compras'
  | 'historial-prov'
  | 'dashboard'
  | 'conciliacion'
  | 'gastos-balance'
  | 'deudores';

export default function App() {
  const isOnline = useOnlineStatus();

  // Active module
  const [moduloActivo, setModuloActivo] = useState<ModuloTipo>('ventas');

  // Application Data States (initialized immediately from local storage for offline first)
  const [inventario, setInventario] = useState<InventarioItem[]>(() => StorageService.getInventario());
  const [compras, setCompras] = useState<CompraItem[]>(() => StorageService.getCompras());
  const [proveedores, setProveedores] = useState<Proveedor[]>(() => StorageService.getProveedores());
  const [ventas, setVentas] = useState<VentaRegistro[]>(() => StorageService.getVentas());
  const [tasas, setTasas] = useState<TasasCambio>(() => StorageService.getTasas());
  const [logo, setLogo] = useState<string | null>(() => StorageService.getLogo());
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>(() => StorageService.getOfflineQueue());

  // UI States
  const [syncing, setSyncing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<string>('');
  const [offlineQueueOpen, setOfflineQueueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [driveBackupOpen, setDriveBackupOpen] = useState(false);

  // Seguridad y Acceso Restringido (Solo Módulo de Ventas Libre, otros con PIN)
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(() => StorageService.isAdminUnlocked());
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [moduloPendiente, setModuloPendiente] = useState<ModuloTipo | null>(null);

  // Initialize scheduled Google Drive backup if configured
  useEffect(() => {
    const cfg = StorageService.getDriveBackupConfig();
    if (cfg.activo) {
      ApiService.iniciarRespaldoProgramadoDrive(cfg.intervaloMinutos, cfg.carpeta, false);
    }
    return () => {
      ApiService.detenerRespaldoProgramadoDrive();
    };
  }, []);

  // Fetch latest data from cloud if online
  const cargarDatosNube = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const data = await ApiService.fetchCloudData();
      if (data.inventario.length > 0) setInventario(data.inventario);
      if (data.compras.length > 0) setCompras(data.compras);
      if (data.proveedores.length > 0) setProveedores(data.proveedores);
      if (data.ventas.length > 0) setVentas(data.ventas);
    } catch (err) {
      console.warn("Error fetching cloud data, using local storage:", err);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    cargarDatosNube();
  }, [cargarDatosNube]);

  // Auto sync on reconnection
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && StorageService.getSettings().autoSync) {
      ApiService.syncOfflineQueue().then((res) => {
        if (res.processed > 0) {
          setOfflineQueue(StorageService.getOfflineQueue());
          cargarDatosNube();
        }
      });
    }
  }, [isOnline, offlineQueue.length, cargarDatosNube]);

  // Rate updates
  const handleUpdateTasas = (newTasas: TasasCambio) => {
    setTasas(newTasas);
    StorageService.saveTasas(newTasas);
  };

  // Logo update
  const handleUpdateLogo = (newLogo: string) => {
    setLogo(newLogo);
    StorageService.saveLogo(newLogo);
  };

  // Control de Acceso y Navegación entre Módulos
  const handleCambiarModulo = (modulo: ModuloTipo) => {
    if (modulo === 'ventas') {
      setModuloActivo('ventas');
      return;
    }

    const settings = StorageService.getSettings();
    const bloqueoActivo = settings.bloqueoModulosActivo ?? true;

    if (!bloqueoActivo || adminUnlocked) {
      setModuloActivo(modulo);
      return;
    }

    setModuloPendiente(modulo);
    setPinModalOpen(true);
  };

  const handleDesbloquearAdmin = () => {
    setAdminUnlocked(true);
    StorageService.setAdminUnlocked(true);
    if (moduloPendiente) {
      setModuloActivo(moduloPendiente);
      setModuloPendiente(null);
    }
    setPinModalOpen(false);
  };

  const handleBloquearAdmin = () => {
    setAdminUnlocked(false);
    StorageService.setAdminUnlocked(false);
    setModuloActivo('ventas');
  };

  // Camera scanner handler
  const handleOpenScanner = (target: string) => {
    setScannerTarget(target);
    setScannerOpen(true);
  };

  const handleScanSuccess = (code: string) => {
    if (scannerTarget === 'vender-buscador') {
      const input = document.getElementById('vender-buscador') as HTMLInputElement;
      if (input) {
        input.value = code;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (scannerTarget === 'buscador') {
      const input = document.getElementById('buscador') as HTMLInputElement;
      if (input) {
        input.value = code;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  // 1. Process Sale
  const handleProcesarVenta = async (venta: {
    cliente: string;
    condicion_pago: 'CONTADO' | 'CRÉDITO';
    items: CarritoItem[];
    total_usd: number;
    total_bs: number;
    tasa_bcv: number;
    libro: 'FISCAL' | 'PRIVADO';
    metodo_pago: string;
  }) => {
    const nextCorrelativo = String(ventas.length + 1).padStart(8, '0');
    const hoyStr = new Date().toLocaleDateString('es-VE');

    // 1. Instantly decrement local inventory stock
    const updatedInv = inventario.map((prod) => {
      const sold = venta.items.find(
        (it) => (prod.rowid && it.rowId === prod.rowid) || (it.nombre === prod.nombre && it.sku === prod.sku)
      );
      if (sold) {
        const nuevoStock = Math.max(0, prod.stock - sold.cantidad);
        return { ...prod, stock: nuevoStock };
      }
      return prod;
    });
    setInventario(updatedInv);
    StorageService.saveInventario(updatedInv);

    // 2. Add to local sales register
    const nuevoRegistro: VentaRegistro = {
      id_venta: nextCorrelativo,
      fecha: hoyStr,
      cliente: venta.cliente,
      tipo_precio: 'MIXTO',
      condicion_pago: venta.condicion_pago,
      metodo_pago: venta.metodo_pago,
      items_json: JSON.stringify(venta.items),
      total_usd: venta.total_usd,
      total_bs: venta.total_bs,
      tasa_bcv: venta.tasa_bcv,
      estado: 'PROCESADA',
      libro: venta.libro,
    };
    const updatedVentas = [nuevoRegistro, ...ventas];
    setVentas(updatedVentas);
    StorageService.saveVentas(updatedVentas);

    // 3. Dispatch to API or offline queue
    await ApiService.executeAction(
      'GUARDAR_VENTA',
      `Venta #${nextCorrelativo} - ${venta.cliente} ($${venta.total_usd})`,
      {
        venta: {
          cliente: venta.cliente,
          tipo_precio: 'MIXTO',
          condicion_pago: venta.condicion_pago,
          metodo_pago: 'SENIAT POS',
          items: venta.items,
          total_usd: venta.total_usd,
          total_bs: venta.total_bs,
          tasa_bcv: venta.tasa_bcv,
          libro: venta.libro,
        },
      }
    );

    setOfflineQueue(StorageService.getOfflineQueue());
    return { idVenta: nextCorrelativo };
  };

  // 2. Save / Edit Product
  const handleGuardarProducto = async (producto: Partial<InventarioItem>) => {
    let finalRowId = producto.rowid;
    if (!finalRowId) {
      finalRowId = 'ROW_' + Date.now();
      producto.rowid = finalRowId;
    }

    const itemCompleto: InventarioItem = {
      nombre: producto.nombre || 'SIN NOMBRE',
      base_pvp_detal: producto.base_pvp_detal || 0,
      pvp_detal: producto.pvp_detal || 0,
      categoria: producto.categoria || 'GOLOSINAS',
      sku: producto.sku || 'S/N',
      base_costo: producto.base_costo || 0,
      costo_con_iva: producto.costo_con_iva || 0,
      costo_u_prot: producto.costo_u_prot || 0,
      stock: producto.stock || 0,
      stock_minimo: typeof producto.stock_minimo === 'number' ? producto.stock_minimo : (parseFloat(producto.stock_minimo as any) || 0),
      unidad: 1,
      presentacion: producto.presentacion || 'Unidad',
      iva_tipo: producto.iva_tipo || '16',
      se_pesa: 'FALSE',
      activo: 'TRUE',
      base_pvp_mayor: (producto.pvp_mayor || 0) / 1.16,
      pvp_mayor: producto.pvp_mayor || redondearExacto((producto.pvp_detal || 0) * 0.95, 2),
      cat_detal: producto.cat_detal ?? true,
      cat_mayor: producto.cat_mayor ?? true,
      rowid: finalRowId,
    };

    // Upsert local
    const existsIndex = inventario.findIndex(
      (p) => (p.rowid && p.rowid === finalRowId) || (producto.sku !== 'S/N' && p.sku === producto.sku)
    );

    let updatedList: InventarioItem[];
    if (existsIndex >= 0) {
      updatedList = [...inventario];
      updatedList[existsIndex] = itemCompleto;
    } else {
      updatedList = [itemCompleto, ...inventario];
    }

    setInventario(updatedList);
    StorageService.saveInventario(updatedList);

    // Send to cloud
    await ApiService.executeAction(
      'GUARDAR_PRODUCTO',
      `Producto: ${itemCompleto.nombre} (${itemCompleto.sku})`,
      {
        rowId: finalRowId,
        sku: itemCompleto.sku,
        nombre: itemCompleto.nombre,
        base_costo: itemCompleto.base_costo,
        costo_con_iva: itemCompleto.costo_con_iva,
        costo_u_prot: itemCompleto.costo_u_prot,
        base_pvp_detal: itemCompleto.base_pvp_detal,
        pvp_detal: itemCompleto.pvp_detal,
        pvp_mayor: itemCompleto.pvp_mayor,
        stock: itemCompleto.stock,
        stock_minimo: itemCompleto.stock_minimo,
        presentacion: itemCompleto.presentacion,
        categoria: itemCompleto.categoria,
        cat_detal: itemCompleto.cat_detal,
        cat_mayor: itemCompleto.cat_mayor,
        iva_tipo: itemCompleto.iva_tipo,
      }
    );

    setOfflineQueue(StorageService.getOfflineQueue());
  };

  // 2b. Quick Update Product Price from Ventas
  const handleActualizarPrecioProducto = async (sku: string, rowId: string, nuevoPrecio: number) => {
    const item = inventario.find(
      (p) => (rowId && p.rowid === rowId) || (sku && sku !== 'S/N' && p.sku === sku)
    );
    if (item) {
      const pvpMayorCalc = redondearExacto(nuevoPrecio * 0.95, 2);
      const updated: InventarioItem = {
        ...item,
        pvp_detal: nuevoPrecio,
        base_pvp_detal: redondearExacto(nuevoPrecio / 1.16, 2),
        pvp_mayor: pvpMayorCalc,
        base_pvp_mayor: redondearExacto(pvpMayorCalc / 1.16, 2),
      };
      await handleGuardarProducto(updated);
    }
  };

  // 3. Batch Update Minimum Stocks per Category
  const handleGuardarMinimosMasivos = async (ajustes: Record<string, number>) => {
    const updated = inventario.map((p) => {
      const cat = (p.categoria || 'GOLOSINAS').toUpperCase().trim();
      if (ajustes[cat] !== undefined) {
        return {
          ...p,
          stock_minimo: ajustes[cat],
        };
      }
      return p;
    });

    setInventario(updated);
    StorageService.saveInventario(updated);

    const modifiedProducts = updated.filter((p) => {
      const cat = (p.categoria || 'GOLOSINAS').toUpperCase().trim();
      return ajustes[cat] !== undefined;
    });

    for (const prod of modifiedProducts) {
      await ApiService.executeAction(
        'GUARDAR_PRODUCTO',
        `Mínimo masivo (${prod.categoria}): ${prod.nombre} -> Mín: ${prod.stock_minimo}`,
        {
          rowId: prod.rowid,
          sku: prod.sku,
          nombre: prod.nombre,
          base_costo: prod.base_costo,
          costo_con_iva: prod.costo_con_iva,
          costo_u_prot: prod.costo_u_prot,
          base_pvp_detal: prod.base_pvp_detal,
          pvp_detal: prod.pvp_detal,
          pvp_mayor: prod.pvp_mayor,
          stock: prod.stock,
          stock_minimo: prod.stock_minimo,
          presentacion: prod.presentacion,
          categoria: prod.categoria,
          cat_detal: prod.cat_detal,
          cat_mayor: prod.cat_mayor,
          iva_tipo: prod.iva_tipo,
        }
      );
    }

    setOfflineQueue(StorageService.getOfflineQueue());
  };

  // 4. Delete Product
  const handleEliminarProducto = async (rowIdVal: string, nombreVal: string, skuVal: string) => {
    const updated = inventario.filter((p) => {
      if (rowIdVal && p.rowid === rowIdVal) return false;
      if (skuVal && skuVal !== 'S/N' && p.sku === skuVal) return false;
      if (p.nombre === nombreVal) return false;
      return true;
    });

    setInventario(updated);
    StorageService.saveInventario(updated);

    await ApiService.executeAction('ELIMINAR_PRODUCTO', `Eliminar: ${nombreVal}`, {
      rowId: rowIdVal || '',
      sku: skuVal || 'S/N',
      nombre: nombreVal,
    });

    setOfflineQueue(StorageService.getOfflineQueue());
  };

  // 4. Save / Edit Purchase
  const handleGuardarCompra = async (compra: CompraItem) => {
    const index = compras.findIndex((c) => c.id_registro === compra.id_registro);
    let updated: CompraItem[];
    if (index >= 0) {
      updated = [...compras];
      updated[index] = compra;
    } else {
      updated = [compra, ...compras];
    }

    setCompras(updated);
    StorageService.saveCompras(updated);

    await ApiService.executeAction(
      'GUARDAR_COMPRA',
      `Compra ID ${compra.id_registro} - ${compra.proveedor} ($${compra.total})`,
      {
        factura: compra,
      }
    );

    setOfflineQueue(StorageService.getOfflineQueue());
  };

  // 5. Delete Purchase
  const handleEliminarCompra = async (idRegistro: string) => {
    const updated = compras.filter((c) => c.id_registro !== idRegistro);
    setCompras(updated);
    StorageService.saveCompras(updated);

    await ApiService.executeAction('BORRAR_COMPRA', `Eliminar Compra ID: ${idRegistro}`, {
      id_registro: idRegistro,
    });

    setOfflineQueue(StorageService.getOfflineQueue());
  };

  // 6. Save Provider
  const handleGuardarProveedor = async (prov: Proveedor) => {
    const index = proveedores.findIndex((p) => p.rif === prov.rif);
    let updated: Proveedor[];
    if (index >= 0) {
      updated = [...proveedores];
      updated[index] = prov;
    } else {
      updated = [prov, ...proveedores];
    }

    setProveedores(updated);
    StorageService.saveProveedores(updated);

    await ApiService.executeAction('GUARDAR_PROVEEDOR', `Proveedor: ${prov.razon_social} (${prov.rif})`, {
      ...prov,
    });

    setOfflineQueue(StorageService.getOfflineQueue());
  };

  // 7. Save Cash / Bank Reconciliation Closure
  const handleGuardarCierre = async (cierre: CierreCajaConciliacion) => {
    StorageService.addConciliacion(cierre);
    await ApiService.executeAction(
      'GUARDAR_CONCILIACION',
      `Conciliación ${cierre.id} (${cierre.fecha}) - Banco: ${cierre.banco}`,
      { cierre }
    );
    setOfflineQueue(StorageService.getOfflineQueue());
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* Printable Area Target */}
      <div id="area-impresion"></div>

      {/* Header with rates & connection controls */}
      <Header
        tasas={tasas}
        onUpdateTasas={handleUpdateTasas}
        logo={logo}
        onUpdateLogo={handleUpdateLogo}
        isOnline={isOnline}
        offlineQueue={offlineQueue}
        onOpenOfflineQueue={() => setOfflineQueueOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDriveBackup={() => setDriveBackupOpen(true)}
        onSyncCloud={cargarDatosNube}
        syncing={syncing}
      />

      {/* Offline Mode Banner */}
      {!isOnline && (
        <div className="no-print bg-amber-500 text-amber-950 font-black px-4 py-2 text-xs flex items-center justify-between shadow-sm border-b border-amber-600">
          <div className="flex items-center gap-2 max-w-[1600px] mx-auto w-full">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-950 animate-pulse" />
            <span>
              MODO OFFLINE ACTIVO: Puedes registrar ventas, editar stock e inventario con normalidad. Todas las transacciones se guardarán localmente y se sincronizarán al conectarte.
            </span>
          </div>
        </div>
      )}

      {/* Module Navigation Tabs */}
      <section className="px-4 max-w-[1600px] mx-auto w-full no-print pt-3">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 border-b border-slate-300 pb-0">
          <div className="flex gap-1.5 overflow-x-auto pb-0 scrollbar-none flex-1">
            <button
              onClick={() => handleCambiarModulo('ventas')}
              className={`font-black text-xs px-4 sm:px-6 py-3 rounded-t-2xl transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                moduloActivo === 'ventas'
                  ? 'bg-blue-900 text-white border-t-2 border-x border-blue-900 shadow-md'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>💵 VENTAS POS (LIBRE)</span>
            </button>
            <button
              onClick={() => handleCambiarModulo('inventario')}
              className={`font-black text-xs px-4 sm:px-5 py-3 rounded-t-2xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                moduloActivo === 'inventario'
                  ? 'bg-blue-900 text-white border-t-2 border-x border-blue-900 shadow-md'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {!adminUnlocked && <Lock className="w-3.5 h-3.5 text-amber-600" />}
              <Package className="w-4 h-4" />
              <span>📦 INVENTARIO & POP</span>
            </button>
            <button
              onClick={() => handleCambiarModulo('compras')}
              className={`font-black text-xs px-4 sm:px-5 py-3 rounded-t-2xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                moduloActivo === 'compras'
                  ? 'bg-blue-900 text-white border-t-2 border-x border-blue-900 shadow-md'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {!adminUnlocked && <Lock className="w-3.5 h-3.5 text-amber-600" />}
              <ShoppingCart className="w-4 h-4" />
              <span>🛒 COMPRAS & CXP</span>
            </button>
            <button
              onClick={() => handleCambiarModulo('historial-prov')}
              className={`font-black text-xs px-4 sm:px-5 py-3 rounded-t-2xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                moduloActivo === 'historial-prov'
                  ? 'bg-blue-900 text-white border-t-2 border-x border-blue-900 shadow-md'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {!adminUnlocked && <Lock className="w-3.5 h-3.5 text-amber-600" />}
              <History className="w-4 h-4" />
              <span>📜 HISTORIAL PROV</span>
            </button>
            <button
              onClick={() => handleCambiarModulo('dashboard')}
              className={`font-black text-xs px-4 sm:px-5 py-3 rounded-t-2xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                moduloActivo === 'dashboard'
                  ? 'bg-blue-900 text-white border-t-2 border-x border-blue-900 shadow-md'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {!adminUnlocked && <Lock className="w-3.5 h-3.5 text-amber-600" />}
              <BarChart3 className="w-4 h-4 text-amber-300" />
              <span>📊 DASHBOARD & TENDENCIAS</span>
            </button>
            <button
              onClick={() => handleCambiarModulo('conciliacion')}
              className={`font-black text-xs px-4 sm:px-5 py-3 rounded-t-2xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                moduloActivo === 'conciliacion'
                  ? 'bg-blue-900 text-white border-t-2 border-x border-blue-900 shadow-md'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {!adminUnlocked && <Lock className="w-3.5 h-3.5 text-amber-600" />}
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>🏛️ CONCILIACIÓN & CIERRE</span>
            </button>
            <button
              onClick={() => handleCambiarModulo('deudores')}
              className={`font-black text-xs px-4 sm:px-5 py-3 rounded-t-2xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                moduloActivo === 'deudores'
                  ? 'bg-blue-900 text-white border-t-2 border-x border-blue-900 shadow-md'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Receipt className="w-4 h-4 text-red-400" />
              <span>💰 DEUDORES</span>
            </button>
          </div>

          {/* Admin Lock / Unlock Status Badge */}
          <div className="flex items-center gap-2 shrink-0 pb-1.5 pt-1 sm:pt-0">
            {adminUnlocked ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-xl flex items-center gap-1 border border-emerald-300 shadow-2xs">
                  <Unlock className="w-3 h-3 text-emerald-700" />
                  <span className="hidden md:inline">MODO ADMIN DESBLOQUEADO</span>
                  <span className="md:hidden">ADMIN</span>
                </span>
                <button
                  type="button"
                  onClick={handleBloquearAdmin}
                  className="text-[10px] font-black text-rose-700 hover:text-white hover:bg-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1 border border-rose-200 shadow-2xs"
                  title="Bloquear módulos administrativos inmediatamente"
                >
                  <Lock className="w-3 h-3" />
                  <span>BLOQUEAR</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                <Lock className="w-3 h-3 text-amber-600" />
                <span className="hidden sm:inline">Módulos protegidos por PIN</span>
                <span className="sm:hidden">PIN</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Active Module Main Container */}
      <main className="p-4 max-w-[1600px] mx-auto w-full flex-1 no-print">
        {moduloActivo === 'ventas' && (
          <VentasModulo
            inventario={inventario}
            ventas={ventas}
            tasas={tasas}
            onProcesarVenta={handleProcesarVenta}
            onOpenScanner={handleOpenScanner}
            onActualizarPrecioProducto={handleActualizarPrecioProducto}
          />
        )}
        {moduloActivo === 'inventario' && (
          <InventarioModulo
            inventario={inventario}
            onGuardarProducto={handleGuardarProducto}
            onEliminarProducto={handleEliminarProducto}
            onGuardarMinimosMasivos={handleGuardarMinimosMasivos}
            onOpenScanner={handleOpenScanner}
            onRecargar={cargarDatosNube}
          />
        )}
        {moduloActivo === 'compras' && (
          <ComprasModulo
            compras={compras}
            proveedores={proveedores}
            tasas={tasas}
            onGuardarCompra={handleGuardarCompra}
            onEliminarCompra={handleEliminarCompra}
            onGuardarProveedor={handleGuardarProveedor}
            onRecargar={cargarDatosNube}
          />
        )}
        {moduloActivo === 'historial-prov' && (
          <HistorialProvModulo
            compras={compras}
            proveedores={proveedores}
            onRecargar={cargarDatosNube}
          />
        )}
        {moduloActivo === 'dashboard' && (
          <DashboardModulo
            ventas={ventas}
            inventario={inventario}
            tasas={tasas}
          />
        )}
        {moduloActivo === 'conciliacion' && (
          <ConciliacionModulo
            ventas={ventas}
            tasas={tasas}
            onGuardarCierre={handleGuardarCierre}
          />
        )}
        {moduloActivo === 'deudores' && (
          <DeudoresModulo
            ventas={ventas}
            tasas={tasas}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print bg-slate-900 text-slate-400 text-center py-2.5 text-[11px] border-t border-slate-800">
        <p className="font-medium">
          GOLOCHINAS 289 • Sistema POS Integrado Online/Offline • Respaldo Central en Google Sheets
        </p>
      </footer>

      {/* Camera Barcode / QR Scanner Modal */}
      <CameraScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      {/* Offline Queue & Connectivity Management Modal */}
      <OfflineQueueModal
        isOpen={offlineQueueOpen}
        onClose={() => setOfflineQueueOpen(false)}
        queue={offlineQueue}
        isOnline={isOnline}
        onQueueUpdated={() => {
          setOfflineQueue(StorageService.getOfflineQueue());
          setInventario(StorageService.getInventario());
          setCompras(StorageService.getCompras());
          setProveedores(StorageService.getProveedores());
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenDriveBackup={() => setDriveBackupOpen(true)}
        onSettingsSaved={() => {
          cargarDatosNube();
        }}
      />

      {/* Google Drive Backup & Sync Modal */}
      <GoogleDriveBackupModal
        isOpen={driveBackupOpen}
        onClose={() => setDriveBackupOpen(false)}
        onRestoreSuccess={cargarDatosNube}
      />

      {/* PIN Security Modal for Restricted Modules */}
      <ModalPinSeguridad
        isOpen={pinModalOpen}
        onClose={() => {
          setPinModalOpen(false);
          setModuloPendiente(null);
        }}
        onUnlockSuccess={handleDesbloquearAdmin}
        moduloDestinoNombre={
          moduloPendiente === 'inventario'
            ? 'Inventario y Etiquetas POP'
            : moduloPendiente === 'compras'
            ? 'Compras y Cuentas por Pagar'
            : moduloPendiente === 'historial-prov'
            ? 'Historial Cargos y Abonos'
            : moduloPendiente === 'dashboard'
            ? 'Dashboard & Métricas'
            : moduloPendiente === 'conciliacion'
            ? 'Conciliación & Cierre POS'
            : 'Módulo Administrativo'
        }
      />
    </div>
  );
}
