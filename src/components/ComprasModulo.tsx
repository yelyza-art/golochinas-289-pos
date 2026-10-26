import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Trash2, Edit2, Calendar, FileText, Building2, CreditCard, DollarSign, CheckCircle, AlertTriangle } from 'lucide-react';
import { CompraItem, Proveedor, HistorialAbono, TasasCambio } from '../types';
import {
  formatearVE,
  formatearFechaDDMMYYYY,
  convertirDDMMYYYYToYYYYMMDD,
  formatearIDCorrelativo,
  redondearExacto,
} from '../utils/formatters';

interface ComprasModuloProps {
  compras: CompraItem[];
  proveedores: Proveedor[];
  tasas: TasasCambio;
  onGuardarCompra: (compra: CompraItem) => Promise<void>;
  onEliminarCompra: (idRegistro: string) => Promise<void>;
  onGuardarProveedor: (proveedor: Proveedor) => Promise<void>;
  onRecargar: () => void;
}

export const ComprasModulo: React.FC<ComprasModuloProps> = ({
  compras,
  proveedores,
  tasas,
  onGuardarCompra,
  onEliminarCompra,
  onGuardarProveedor,
  onRecargar,
}) => {
  const [buscador, setBuscador] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Form: Compra
  const [idRegistro, setIdRegistro] = useState('01');
  const [empresa, setEmpresa] = useState('GOLOCHINAS 289, C.A.');
  const [libro, setLibro] = useState<'FISCAL' | 'PRIVADO'>('FISCAL');
  const [documento, setDocumento] = useState<'FACTURA' | 'NOTA DE ENTREGA'>('FACTURA');
  const [nroDoc, setNroDoc] = useState('');

  const [proveedor, setProveedor] = useState('');
  const [provRif, setProvRif] = useState('');
  const [diasCredito, setDiasCredito] = useState<number>(15);

  const [fechaEmision, setFechaEmision] = useState('');
  const [fechaRecepcion, setFechaRecepcion] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');

  const [exento, setExento] = useState<string>('0');
  const [baseGravada, setBaseGravada] = useState<string>('0');
  const [totalFactura, setTotalFactura] = useState<string>('0');

  // Abonos list
  const [historialAbonos, setHistorialAbonos] = useState<HistorialAbono[]>([]);

  // New Abono sub-form
  const [abonoFecha, setAbonoFecha] = useState('');
  const [abonoUsd, setAbonoUsd] = useState<string>('');
  const [abonoTasa, setAbonoTasa] = useState<string>(tasas.tasaBcv.toString());
  const [abonoBs, setAbonoBs] = useState<string>('');
  const [abonoMetodo, setAbonoMetodo] = useState('TRANSFERENCIA');
  const [abonoRef, setAbonoRef] = useState('');

  // Provider Form
  const [provEditRif, setProvEditRif] = useState('');
  const [provEditRazon, setProvEditRazon] = useState('');
  const [provEditDias, setProvEditDias] = useState<number>(15);
  const [provEditMetodo, setProvEditMetodo] = useState('PAGO MÓVIL / TRANSFERENCIA');
  const [provEditCuenta, setProvEditCuenta] = useState('');

  // Initialize dates and next ID
  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    setFechaEmision(hoy);
    setFechaRecepcion(hoy);
    setAbonoFecha(hoy);
    calcularVencimiento(hoy, 15);
    calcularProximoID();
  }, [compras]);

  const calcularProximoID = () => {
    let max = 0;
    compras.forEach((c) => {
      const num = parseInt(c.id_registro, 10);
      if (!isNaN(num) && num > max) max = num;
    });
    setIdRegistro(formatearIDCorrelativo(max + 1));
  };

  const calcularVencimiento = (fRecepcionStr: string, dias: number) => {
    if (!fRecepcionStr) return;
    const partes = fRecepcionStr.split('-');
    if (partes.length === 3) {
      const f = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
      f.setDate(f.getDate() + (dias || 0));
      const yyyy = f.getFullYear();
      const mm = String(f.getMonth() + 1).padStart(2, '0');
      const dd = String(f.getDate()).padStart(2, '0');
      setFechaVencimiento(`${yyyy}-${mm}-${dd}`);
    }
  };

  // Recalculate global invoice totals
  const recalcularTotales = (exentoStr: string, baseStr: string) => {
    const ex = parseFloat(exentoStr) || 0;
    const base = parseFloat(baseStr) || 0;
    const tot = redondearExacto(ex + base * 1.16, 2);
    setTotalFactura(tot.toFixed(2));
  };

  // Autocomplete supplier details
  const handleSelectProveedor = (nombreProv: string) => {
    setProveedor(nombreProv);
    const found = proveedores.find(
      (p) => p.razon_social.toUpperCase() === nombreProv.toUpperCase().trim()
    );
    if (found) {
      setProvRif(found.rif || '');
      setDiasCredito(found.dias_credito_base || 15);
      if (found.metodo_habitual) setAbonoMetodo(found.metodo_habitual.toUpperCase());
      calcularVencimiento(fechaRecepcion, found.dias_credito_base || 15);
    }
  };

  // Abono calculations
  const handleAbonoUsdChange = (val: string) => {
    setAbonoUsd(val);
    const usd = parseFloat(val) || 0;
    const tasa = parseFloat(abonoTasa) || tasas.tasaBcv || 1;
    const bs = redondearExacto(usd * tasa, 2);
    setAbonoBs(bs > 0 ? bs.toFixed(2) : '');
  };

  const handleAbonoBsChange = (val: string) => {
    setAbonoBs(val);
    const bs = parseFloat(val) || 0;
    const usd = parseFloat(abonoUsd) || 0;
    if (usd > 0 && bs > 0) {
      const t = bs / usd;
      setAbonoTasa(redondearExacto(t, 4).toFixed(4));
    }
  };

  const agregarAbono = () => {
    const usd = redondearExacto(parseFloat(abonoUsd) || 0, 2);
    if (usd <= 0) {
      alert("❌ Ingrese un monto de abono mayor a $ 0,00.");
      return;
    }

    const tasa = parseFloat(abonoTasa) || tasas.tasaBcv || 1;
    const bs = redondearExacto(parseFloat(abonoBs) || usd * tasa, 2);

    const nuevoAbono: HistorialAbono = {
      fecha: abonoFecha ? formatearFechaDDMMYYYY(abonoFecha) : formatearFechaDDMMYYYY(new Date()),
      nro_doc: nroDoc.trim().toUpperCase() || 'S/N',
      monto_usd: usd,
      tasa_bcv: tasa,
      pagado_bs: bs,
      metodo_pago: abonoMetodo,
      referencia: abonoRef.trim().toUpperCase() || 'S/R',
    };

    setHistorialAbonos((prev) => [...prev, nuevoAbono]);
    setAbonoUsd('');
    setAbonoBs('');
    setAbonoRef('');
  };

  const eliminarAbono = (idx: number) => {
    setHistorialAbonos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Cumulative paid and debt
  const totalAbonadoAcumulado = useMemo(() => {
    return redondearExacto(
      historialAbonos.reduce((acc, a) => acc + (a.monto_usd || 0), 0),
      2
    );
  }, [historialAbonos]);

  const totalFacturaNum = parseFloat(totalFactura) || 0;
  const deudaPendiente = redondearExacto(Math.max(0, totalFacturaNum - totalAbonadoAcumulado), 2);

  // Clean purchase form
  const limpiarFormularioCompra = () => {
    calcularProximoID();
    setEmpresa('GOLOCHINAS 289, C.A.');
    setLibro('FISCAL');
    setDocumento('FACTURA');
    setNroDoc('');
    setProveedor('');
    setProvRif('');
    setDiasCredito(15);

    const hoy = new Date().toISOString().split('T')[0];
    setFechaEmision(hoy);
    setFechaRecepcion(hoy);
    calcularVencimiento(hoy, 15);

    setExento('0');
    setBaseGravada('0');
    setTotalFactura('0');
    setHistorialAbonos([]);

    setAbonoUsd('');
    setAbonoBs('');
    setAbonoRef('');
    setAbonoTasa(tasas.tasaBcv.toString());
  };

  // Load purchase to edit
  const cargarCompra = (c: CompraItem) => {
    setIdRegistro(formatearIDCorrelativo(c.id_registro));
    setEmpresa(c.empresa || 'GOLOCHINAS 289, C.A.');
    setLibro(c.libro || 'FISCAL');
    setDocumento(c.documento || 'FACTURA');
    setNroDoc(c.nro_doc);
    setProveedor(c.proveedor);

    setFechaEmision(convertirDDMMYYYYToYYYYMMDD(c.fecha_emision));
    setFechaRecepcion(convertirDDMMYYYYToYYYYMMDD(c.fecha_recepcion));
    setFechaVencimiento(convertirDDMMYYYYToYYYYMMDD(c.fecha_vencimiento));

    setExento(c.exento.toString());
    setBaseGravada(c.base_gravada.toString());
    setTotalFactura(c.total.toString());

    setHistorialAbonos(Array.isArray(c.historial_abonos) ? [...c.historial_abonos] : []);
  };

  // Save purchase
  const handleGuardarCompra = async () => {
    if (!nroDoc.trim() || !proveedor.trim() || totalFacturaNum <= 0) {
      alert("❌ Ingrese el Nro de Documento, el Proveedor y un Monto Total válido.");
      return;
    }

    setGuardando(true);
    try {
      const exNum = parseFloat(exento) || 0;
      const baseNum = parseFloat(baseGravada) || 0;

      const compraData: CompraItem = {
        id_registro: formatearIDCorrelativo(idRegistro),
        empresa,
        libro,
        documento,
        nro_doc: nroDoc.trim().toUpperCase(),
        fecha_emision: formatearFechaDDMMYYYY(fechaEmision),
        fecha_recepcion: formatearFechaDDMMYYYY(fechaRecepcion),
        fecha_vencimiento: formatearFechaDDMMYYYY(fechaVencimiento),
        proveedor: proveedor.trim().toUpperCase(),
        exento: exNum,
        base_gravada: baseNum,
        iva: redondearExacto(baseNum * 0.16, 2),
        total: totalFacturaNum,
        abonado_usd: totalAbonadoAcumulado,
        historial_abonos: historialAbonos,
        tasa_bcv: tasas.tasaBcv,
        pagado_bs: redondearExacto(totalAbonadoAcumulado * tasas.tasaBcv, 2),
      };

      await onGuardarCompra(compraData);
      limpiarFormularioCompra();
    } catch (err: any) {
      alert("❌ Error guardando compra: " + (err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  // Save provider
  const handleGuardarProveedor = async () => {
    if (!provEditRif.trim() || !provEditRazon.trim()) {
      alert("❌ Ingrese el RIF y la Razón Social del proveedor.");
      return;
    }

    try {
      await onGuardarProveedor({
        rif: provEditRif.trim().toUpperCase(),
        razon_social: provEditRazon.trim().toUpperCase(),
        dias_credito_base: provEditDias || 15,
        metodo_habitual: provEditMetodo.trim().toUpperCase() || 'TRANSFERENCIA',
        datos_cuenta: provEditCuenta.trim().toUpperCase() || 'BANCO BANESCO / VENEZUELA',
      });

      setProvEditRif('');
      setProvEditRazon('');
      setProvEditDias(15);
      setProvEditCuenta('');
    } catch (err: any) {
      alert("❌ Error guardando proveedor: " + (err?.message || err));
    }
  };

  // Filtered and sorted purchases: unpaid near due date on top
  const comprasOrdenadas = useMemo(() => {
    let list = compras;
    if (buscador.trim()) {
      const q = buscador.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.id_registro.toLowerCase().includes(q) ||
          c.nro_doc.toLowerCase().includes(q) ||
          c.proveedor.toLowerCase().includes(q) ||
          c.empresa.toLowerCase().includes(q)
      );
    }

    return list.slice().sort((a, b) => {
      const deudaA = (a.total || 0) - (a.abonado_usd || 0);
      const deudaB = (b.total || 0) - (b.abonado_usd || 0);
      const pendienteA = deudaA > 0.009;
      const pendienteB = deudaB > 0.009;

      if (pendienteA && !pendienteB) return -1;
      if (!pendienteA && pendienteB) return 1;

      const fA = new Date(convertirDDMMYYYYToYYYYMMDD(a.fecha_vencimiento)).getTime();
      const fB = new Date(convertirDDMMYYYYToYYYYMMDD(b.fecha_vencimiento)).getTime();
      return fA - fB;
    });
  }, [compras, buscador]);

  // Overall statistics
  const statsCompras = useMemo(() => {
    let totalCompras = 0;
    let totalAbonado = 0;
    let totalDeuda = 0;

    compras.forEach((c) => {
      const tot = c.total || 0;
      const ab = c.abonado_usd || 0;
      const d = Math.max(0, tot - ab);
      totalCompras += tot;
      totalAbonado += ab;
      totalDeuda += d;
    });

    return {
      totalCompras: redondearExacto(totalCompras, 2),
      totalAbonado: redondearExacto(totalAbonado, 2),
      totalDeuda: redondearExacto(totalDeuda, 2),
    };
  }, [compras]);

  // Debt by supplier summary
  const resumenProveedores = useMemo(() => {
    const map: Record<string, { count: number; totalDeuda: number; proxVenc: string }> = {};

    compras.forEach((c) => {
      const tot = c.total || 0;
      const ab = c.abonado_usd || 0;
      const deuda = redondearExacto(tot - ab, 2);

      if (deuda > 0.009) {
        const prov = c.proveedor;
        if (!map[prov]) {
          map[prov] = { count: 0, totalDeuda: 0, proxVenc: c.fecha_vencimiento };
        } else {
          const dExist = new Date(convertirDDMMYYYYToYYYYMMDD(map[prov].proxVenc)).getTime();
          const dNueva = new Date(convertirDDMMYYYYToYYYYMMDD(c.fecha_vencimiento)).getTime();
          if (dNueva < dExist) map[prov].proxVenc = c.fecha_vencimiento;
        }
        map[prov].count++;
        map[prov].totalDeuda += deuda;
      }
    });

    return Object.keys(map)
      .map((k) => ({
        proveedor: k,
        ...map[k],
      }))
      .sort((a, b) => {
        return (
          new Date(convertirDDMMYYYYToYYYYMMDD(a.proxVenc)).getTime() -
          new Date(convertirDDMMYYYYToYYYYMMDD(b.proxVenc)).getTime()
        );
      });
  }, [compras]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Forms Section */}
      <section className="lg:col-span-5 space-y-4">
        {/* Purchase Registration Card */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-900" />
              <h3 className="font-black text-blue-900 uppercase text-sm tracking-wide">
                Registro / Edición de Compra
              </h3>
            </div>
            <button
              onClick={limpiarFormularioCompra}
              className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 cursor-pointer"
            >
              NUEVA COMPRA 🧹
            </button>
          </div>

          {/* ID, Book & Doc type */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-black text-[10px] block mb-1 text-slate-700 uppercase">
                ID Registro
              </label>
              <input
                type="text"
                value={idRegistro}
                readOnly
                className="w-full border-2 border-blue-400 bg-blue-50/60 p-2 rounded-xl font-mono font-black text-xs text-center text-blue-950 outline-none"
              />
            </div>
            <div>
              <label className="font-black text-[10px] block mb-1 text-slate-700 uppercase">
                Libro
              </label>
              <select
                value={libro}
                onChange={(e) => setLibro(e.target.value as any)}
                className="w-full border-2 border-purple-500 bg-purple-50/60 p-2 rounded-xl font-black text-[11px] text-purple-950 outline-none"
              >
                <option value="FISCAL">FISCAL (SENIAT)</option>
                <option value="PRIVADO">PRIVADO (INTERNO)</option>
              </select>
            </div>
            <div>
              <label className="font-black text-[10px] block mb-1 text-slate-700 uppercase">
                Documento
              </label>
              <select
                value={documento}
                onChange={(e) => setDocumento(e.target.value as any)}
                className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl font-bold text-[11px] outline-none"
              >
                <option value="FACTURA">FACTURA LEGAL</option>
                <option value="NOTA DE ENTREGA">NOTA DE ENTREGA</option>
              </select>
            </div>
          </div>

          {/* Doc number & Company */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="font-black text-[10px] block mb-1 text-slate-700 uppercase">
                Nro. Documento
              </label>
              <input
                type="text"
                value={nroDoc}
                onChange={(e) => setNroDoc(e.target.value)}
                placeholder="F-000123"
                className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl font-mono font-black text-xs uppercase outline-none focus:border-blue-600"
              />
            </div>
            <div className="md:col-span-2">
              <label className="font-black text-[10px] block mb-1 text-slate-700 uppercase">
                Empresa Receptora
              </label>
              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl font-bold text-xs outline-none"
              >
                <option value="GOLOCHINAS 289, C.A.">GOLOCHINAS 289, C.A.</option>
                <option value="INVERSIONES JD 03">INVERSIONES JD 03</option>
                <option value="CHOW-COLATE">CHOW-COLATE</option>
              </select>
            </div>
          </div>

          {/* Supplier & RIF */}
          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="font-black text-[10px] block mb-1 text-blue-900 uppercase">
                Proveedor / Distribuidor
              </label>
              <input
                type="text"
                list="lista-proveedores-auto"
                value={proveedor}
                onChange={(e) => handleSelectProveedor(e.target.value)}
                placeholder="EJ: DISTRIBUIDORA VALENCIA"
                className="w-full border-2 border-blue-400 bg-white p-2 rounded-xl font-bold uppercase text-xs outline-none focus:border-blue-600"
              />
              <datalist id="lista-proveedores-auto">
                {proveedores.map((p) => (
                  <option key={p.rif} value={p.razon_social} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="font-black text-[10px] block mb-1 text-blue-900 uppercase">
                RIF Proveedor
              </label>
              <input
                type="text"
                value={provRif}
                onChange={(e) => setProvRif(e.target.value)}
                placeholder="J-12345678-0"
                className="w-full border-2 border-blue-400 bg-white p-2 rounded-xl font-mono font-bold uppercase text-xs outline-none"
              />
            </div>
          </div>

          {/* Dates: Emission, Reception, Credit days -> Due Date */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="text-[10px] font-black text-slate-600 block mb-1">F. Emisión</label>
              <input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="w-full border border-slate-300 p-1.5 rounded-lg font-mono text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-blue-900 block mb-1">F. Recepción</label>
              <input
                type="date"
                value={fechaRecepcion}
                onChange={(e) => {
                  setFechaRecepcion(e.target.value);
                  calcularVencimiento(e.target.value, diasCredito);
                }}
                className="w-full border-2 border-blue-500 bg-blue-50 p-1.5 rounded-lg font-mono text-xs font-black text-blue-950"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-600 block mb-1">Días Crédito</label>
              <input
                type="number"
                value={diasCredito}
                onChange={(e) => {
                  const d = parseInt(e.target.value, 10) || 0;
                  setDiasCredito(d);
                  calcularVencimiento(fechaRecepcion, d);
                }}
                className="w-full border border-slate-300 p-1.5 rounded-lg font-bold text-xs text-center"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-amber-800 block mb-1">Vencimiento (Auto)</label>
              <input
                type="date"
                value={fechaVencimiento}
                readOnly
                className="w-full border-2 border-amber-500 bg-amber-50 p-1.5 rounded-lg font-mono text-xs font-black text-amber-950"
              />
            </div>
          </div>

          {/* Invoice Amounts & Abonos */}
          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-300 space-y-3">
            <h4 className="text-[10px] font-black text-emerald-950 uppercase tracking-wide">
              Montos Globales de la Factura ($)
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Exento ($)</label>
                <input
                  type="number"
                  step="any"
                  value={exento}
                  onChange={(e) => {
                    setExento(e.target.value);
                    recalcularTotales(e.target.value, baseGravada);
                  }}
                  className="w-full border border-slate-300 bg-white p-1.5 rounded-lg font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Base Gravada ($)</label>
                <input
                  type="number"
                  step="any"
                  value={baseGravada}
                  onChange={(e) => {
                    setBaseGravada(e.target.value);
                    recalcularTotales(exento, e.target.value);
                  }}
                  className="w-full border border-slate-300 bg-white p-1.5 rounded-lg font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-emerald-950 block mb-1">Total Factura ($)</label>
                <input
                  type="number"
                  step="any"
                  value={totalFactura}
                  onChange={(e) => setTotalFactura(e.target.value)}
                  className="w-full border-2 border-emerald-600 bg-white p-1.5 rounded-lg font-mono font-black text-xs text-emerald-950"
                />
              </div>
            </div>

            {/* Abonos Section */}
            <div className="pt-2 border-t border-emerald-200 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-wide">
                  Añadir Pago / Abono Parcial
                </h4>
                <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                  {historialAbonos.length} Abonos
                </span>
              </div>

              {/* Sub-form New Abono */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-blue-300 shadow-sm">
                <div>
                  <label className="text-[9px] font-bold text-blue-900 block mb-0.5">Fecha Abono</label>
                  <input
                    type="date"
                    value={abonoFecha}
                    onChange={(e) => setAbonoFecha(e.target.value)}
                    className="w-full border border-blue-400 bg-blue-50 p-1 rounded font-mono font-bold text-xs text-blue-950"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-blue-900 block mb-0.5">Monto ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={abonoUsd}
                    onChange={(e) => handleAbonoUsdChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-blue-400 bg-blue-50 p-1 rounded font-mono font-bold text-xs text-blue-950"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-blue-900 block mb-0.5">Tasa BCV</label>
                  <input
                    type="number"
                    step="any"
                    value={abonoTasa}
                    onChange={(e) => setAbonoTasa(e.target.value)}
                    className="w-full border border-blue-400 bg-blue-50 p-1 rounded font-mono font-bold text-xs text-center text-blue-950"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-blue-900 block mb-0.5">Monto Bs</label>
                  <input
                    type="number"
                    step="any"
                    value={abonoBs}
                    onChange={(e) => handleAbonoBsChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full border-2 border-emerald-500 bg-emerald-50 p-1 rounded font-mono font-bold text-xs text-emerald-950"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-700 block mb-0.5">Método</label>
                  <select
                    value={abonoMetodo}
                    onChange={(e) => setAbonoMetodo(e.target.value)}
                    className="w-full border border-slate-300 bg-white p-1 rounded font-bold text-[11px]"
                  >
                    <option value="TRANSFERENCIA">TRANSFERENCIA BANCARIA</option>
                    <option value="PAGO MÓVIL">PAGO MÓVIL</option>
                    <option value="EFECTIVO USD">EFECTIVO USD ($)</option>
                    <option value="EFECTIVO BS">EFECTIVO BS.</option>
                    <option value="ZELLE">ZELLE</option>
                    <option value="PUNTO DE VENTA">PUNTO DE VENTA</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-700 block mb-0.5">Referencia</label>
                  <input
                    type="text"
                    value={abonoRef}
                    onChange={(e) => setAbonoRef(e.target.value)}
                    placeholder="REF-1234"
                    className="w-full border border-slate-300 bg-white p-1 rounded font-mono font-bold text-xs uppercase"
                  />
                </div>
                <div className="col-span-2 md:col-span-3 pt-1">
                  <button
                    onClick={agregarAbono}
                    className="w-full bg-blue-900 hover:bg-blue-950 text-white font-black py-2 rounded-lg text-xs shadow transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>REGISTRAR ABONO</span>
                  </button>
                </div>
              </div>

              {/* Abonos Table */}
              <div className="overflow-x-auto max-h-[160px] bg-white rounded-xl border border-slate-200">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-blue-900 text-white font-black uppercase sticky top-0">
                    <tr>
                      <th className="p-1.5">Fecha</th>
                      <th className="p-1.5">Método / Ref</th>
                      <th className="p-1.5 text-center">Tasa</th>
                      <th className="p-1.5 text-right">Monto ($)</th>
                      <th className="p-1.5 text-right">Monto (Bs)</th>
                      <th className="p-1.5 text-center">✕</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 uppercase">
                    {historialAbonos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-3 text-center text-slate-400 italic">
                          Sin abonos registrados aún.
                        </td>
                      </tr>
                    ) : (
                      historialAbonos.map((abono, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 font-bold">
                          <td className="p-1.5 font-mono text-slate-600">{abono.fecha}</td>
                          <td className="p-1.5">
                            {abono.metodo_pago}
                            <span className="block text-[9px] text-blue-600 font-mono">
                              REF: {abono.referencia}
                            </span>
                          </td>
                          <td className="p-1.5 text-center font-mono">{formatearVE(abono.tasa_bcv)}</td>
                          <td className="p-1.5 text-right font-mono text-emerald-700 font-black">
                            $ {formatearVE(abono.monto_usd)}
                          </td>
                          <td className="p-1.5 text-right font-mono text-blue-700 font-black">
                            Bs. {formatearVE(abono.pagado_bs)}
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              onClick={() => eliminarAbono(idx)}
                              className="text-red-500 hover:text-red-800 p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Cumulative totals */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-black text-blue-900 block mb-0.5">Total Abonado ($)</label>
                  <div className="w-full border-2 border-blue-500 bg-blue-50 p-1.5 rounded-lg font-mono font-black text-xs text-blue-950">
                    $ {formatearVE(totalAbonadoAcumulado)}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-red-700 block mb-0.5">Deuda Pendiente ($)</label>
                  <div className="w-full border-2 border-red-500 bg-red-50 p-1.5 rounded-lg font-mono font-black text-xs text-red-800">
                    $ {formatearVE(deudaPendiente)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleGuardarCompra}
            disabled={guardando}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl shadow-md transition active:scale-95 flex justify-center items-center gap-2 text-xs cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{guardando ? 'RESPALDANDO COMPRA...' : '💾 RESPALDAR COMPRA EN LA NUBE / OFFLINE'}</span>
          </button>
        </div>

        {/* Supplier Directory Quick Form */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-900" />
              <h3 className="font-black text-blue-900 uppercase text-xs tracking-wider">
                Directorio de Proveedores & Cuentas Bancarias
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="font-bold text-[10px] block mb-1 text-slate-700 uppercase">RIF</label>
              <input
                type="text"
                value={provEditRif}
                onChange={(e) => setProvEditRif(e.target.value)}
                placeholder="J-12345678-0"
                className="w-full border border-slate-300 p-2 rounded-lg font-mono font-bold text-xs uppercase"
              />
            </div>
            <div className="md:col-span-2">
              <label className="font-bold text-[10px] block mb-1 text-slate-700 uppercase">
                Razón Social / Nombre
              </label>
              <input
                type="text"
                value={provEditRazon}
                onChange={(e) => setProvEditRazon(e.target.value)}
                placeholder="EJ: DISTRIBUIDORA VALENCIA C.A."
                className="w-full border border-slate-300 p-2 rounded-lg font-bold text-xs uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="font-bold text-[10px] block mb-1 text-slate-700 uppercase">Días Crédito</label>
              <input
                type="number"
                value={provEditDias}
                onChange={(e) => setProvEditDias(parseInt(e.target.value, 10) || 0)}
                className="w-full border border-slate-300 p-2 rounded-lg font-bold text-xs text-center"
              />
            </div>
            <div className="md:col-span-2">
              <label className="font-bold text-[10px] block mb-1 text-slate-700 uppercase">
                Método Habitual
              </label>
              <input
                type="text"
                value={provEditMetodo}
                onChange={(e) => setProvEditMetodo(e.target.value)}
                placeholder="PAGO MÓVIL / TRANSFERENCIA"
                className="w-full border border-slate-300 p-2 rounded-lg font-bold text-xs uppercase"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-[10px] block mb-1 text-slate-700 uppercase">
              Datos Bancarios & Coordenadas de Pago
            </label>
            <input
              type="text"
              value={provEditCuenta}
              onChange={(e) => setProvEditCuenta(e.target.value)}
              placeholder="BANESCO 0134-XXXX... / RIF / TLF PAGO MÓVIL"
              className="w-full border-2 border-blue-400 bg-blue-50/50 p-2 rounded-lg font-mono font-bold text-xs text-blue-950 uppercase"
            />
          </div>

          <button
            onClick={handleGuardarProveedor}
            className="w-full bg-blue-900 hover:bg-blue-950 text-white font-black py-2.5 rounded-xl text-xs shadow transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>GUARDAR PROVEEDOR EN DIRECTORIO</span>
          </button>
        </div>
      </section>

      {/* Tables & Analytics Section */}
      <section className="lg:col-span-7 space-y-4 flex flex-col min-h-[500px]">
        {/* Metric Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
              Total Deuda Acumulada
            </span>
            <span className="text-lg font-mono font-black text-red-700 block mt-0.5">
              $ {formatearVE(statsCompras.totalDeuda)}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
              Total Abonado en Cuentas
            </span>
            <span className="text-lg font-mono font-black text-blue-800 block mt-0.5">
              $ {formatearVE(statsCompras.totalAbonado)}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
              Compras Registradas
            </span>
            <span className="text-lg font-mono font-black text-emerald-800 block mt-0.5">
              $ {formatearVE(statsCompras.totalCompras)}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex gap-2 items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={buscador}
              onChange={(e) => setBuscador(e.target.value)}
              placeholder="BUSCAR FACTURA POR ID, NRO DOC, RIF O PROVEEDOR..."
              className="w-full border-2 border-slate-300 bg-white p-2 pl-9 rounded-xl font-bold text-xs uppercase focus:border-blue-600 outline-none transition"
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
            onClick={onRecargar}
            className="bg-blue-900 hover:bg-blue-950 text-white font-black px-4 py-2 rounded-xl text-xs shadow flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>🔄 RECARGAR</span>
          </button>
        </div>

        {/* Purchases History Table */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col">
          <div className="border-b pb-2 mb-3 flex justify-between items-center">
            <h3 className="font-black text-slate-700 uppercase text-xs tracking-wider">
              Historial de Compras (Prioridad: Pendientes y Vencimientos Próximos)
            </h3>
            <span className="bg-blue-100 text-blue-900 text-xs font-black px-3 py-0.5 rounded-full">
              {comprasOrdenadas.length} Facturas
            </span>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[360px] border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-blue-900 text-white font-black uppercase sticky top-0 z-10 text-[10px]">
                <tr>
                  <th className="p-2.5">ID / Empresa</th>
                  <th className="p-2.5">Doc / Proveedor</th>
                  <th className="p-2.5">Emisión / Vence</th>
                  <th className="p-2.5">Libro</th>
                  <th className="p-2.5">Total ($)</th>
                  <th className="p-2.5">Abonado ($)</th>
                  <th className="p-2.5">Deuda ($)</th>
                  <th className="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 uppercase">
                {comprasOrdenadas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic font-medium">
                      No hay compras registradas en el sistema.
                    </td>
                  </tr>
                ) : (
                  comprasOrdenadas.map((c) => {
                    const totalUSD = c.total || 0;
                    const abonadoUSD = c.abonado_usd || 0;
                    const deudaUSD = redondearExacto(Math.max(0, totalUSD - abonadoUSD), 2);
                    const esCancelada = deudaUSD <= 0.009;

                    const fVencIso = convertirDDMMYYYYToYYYYMMDD(c.fecha_vencimiento);
                    const vencida = fVencIso ? new Date(fVencIso) < new Date() : false;

                    const badgeColor = esCancelada
                      ? 'bg-slate-100 text-slate-600'
                      : vencida
                      ? 'bg-red-100 text-red-800 font-black'
                      : 'bg-amber-100 text-amber-900 font-black';

                    return (
                      <tr
                        key={c.id_registro}
                        onClick={() => cargarCompra(c)}
                        className="hover:bg-blue-50/50 transition cursor-pointer"
                      >
                        <td className="p-2.5 font-mono font-black text-blue-900 text-center border-r border-slate-200 bg-blue-50/40">
                          {c.id_registro}
                          <span className="text-[9px] text-slate-500 font-bold block">{c.empresa}</span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {c.nro_doc}
                          <span className="text-[10px] text-blue-600 font-extrabold block">
                            {c.proveedor}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[10px]">
                          E: {formatearFechaDDMMYYYY(c.fecha_emision)}
                          <span className={`block px-1.5 py-0.5 rounded text-[9px] mt-0.5 ${badgeColor}`}>
                            V: {esCancelada ? 'CANCELADA' : formatearFechaDDMMYYYY(c.fecha_vencimiento)}
                          </span>
                        </td>
                        <td className="p-2.5 font-black text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              c.libro === 'FISCAL' ? 'bg-purple-100 text-purple-900' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {c.libro}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-emerald-700 font-black">
                          $ {formatearVE(totalUSD)}
                        </td>
                        <td className="p-2.5 font-mono text-blue-700 font-black">
                          $ {formatearVE(abonadoUSD)}
                        </td>
                        <td
                          className={`p-2.5 font-mono font-black ${
                            !esCancelada ? 'text-red-700' : 'text-slate-400'
                          }`}
                        >
                          $ {formatearVE(deudaUSD)}
                        </td>
                        <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => cargarCompra(c)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] px-2 py-1 rounded shadow-sm"
                            >
                              ✏️ EDITAR
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`¿Eliminar compra ID ${c.id_registro}?`)) {
                                  onEliminarCompra(c.id_registro);
                                }
                              }}
                              className="text-red-600 hover:text-red-900 font-black text-[10px] bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200"
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
        </div>

        {/* Debts Summary by Supplier */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-black text-blue-900 uppercase text-xs tracking-wider border-b pb-2 mb-3">
            📊 Resumen de Deudas por Proveedor (Primeras por Vencer Arriba)
          </h3>
          <div className="overflow-x-auto max-h-[190px] border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800 text-white font-black uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="p-2">Proveedor / Razón Social</th>
                  <th className="p-2 text-center">Facturas Pendientes</th>
                  <th className="p-2">Próximo Vencimiento</th>
                  <th className="p-2 text-right">Deuda Total ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold uppercase">
                {resumenProveedores.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                      Sin deudas pendientes con proveedores 🎉
                    </td>
                  </tr>
                ) : (
                  resumenProveedores.map((item) => (
                    <tr key={item.proveedor} className="hover:bg-slate-50">
                      <td className="p-2 font-black text-slate-800">{item.proveedor}</td>
                      <td className="p-2 font-bold text-center">
                        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px]">
                          {item.count} Facturas
                        </span>
                      </td>
                      <td className="p-2 font-mono text-red-700 font-black">
                        {formatearFechaDDMMYYYY(item.proxVenc)}
                      </td>
                      <td className="p-2 font-mono text-right font-black text-red-700">
                        $ {formatearVE(item.totalDeuda)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
