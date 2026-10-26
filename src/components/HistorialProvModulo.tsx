import React, { useState, useMemo } from 'react';
import { RefreshCw, Printer, FileSpreadsheet, Building2, DollarSign } from 'lucide-react';
import { CompraItem, Proveedor, MovimientoKardex } from '../types';
import {
  formatearVE,
  formatearFechaDDMMYYYY,
  convertirDDMMYYYYToYYYYMMDD,
  redondearExacto,
} from '../utils/formatters';
import { imprimirEstadoCuenta } from '../utils/printHelpers';

interface HistorialProvModuloProps {
  compras: CompraItem[];
  proveedores: Proveedor[];
  onRecargar: () => void;
}

export const HistorialProvModulo: React.FC<HistorialProvModuloProps> = ({
  compras,
  proveedores,
  onRecargar,
}) => {
  const [proveedorFiltro, setProveedorFiltro] = useState<string>('');

  // Provider options
  const proveedoresList = useMemo(() => {
    const set = new Set<string>();
    compras.forEach((c) => {
      if (c.proveedor) set.add(c.proveedor.toUpperCase().trim());
    });
    return Array.from(set).sort();
  }, [compras]);

  // Map of RIFs and Bank details
  const infoProveedores = useMemo(() => {
    const map: Record<string, { rif: string; cuenta: string }> = {};
    proveedores.forEach((p) => {
      map[p.razon_social.toUpperCase().trim()] = {
        rif: p.rif || 'J-00000000-0',
        cuenta: p.datos_cuenta || 'BANCO BANESCO / VENEZUELA',
      };
    });
    return map;
  }, [proveedores]);

  // Consolidated chronological movements (Kardex)
  const movimientos = useMemo(() => {
    const list: Omit<MovimientoKardex, 'saldo'>[] = [];

    compras.forEach((c) => {
      const provName = String(c.proveedor || 'DESCONOCIDO').toUpperCase().trim();

      if (!proveedorFiltro || provName === proveedorFiltro.toUpperCase().trim()) {
        const rifProv = infoProveedores[provName]?.rif || 'J-00000000-0';

        // Cargo (Factura)
        list.push({
          id: c.id_registro,
          fecha: c.fecha_emision || c.fecha_recepcion,
          proveedor: provName,
          rif: rifProv,
          tipo: 'CARGO (FACTURA)',
          nro_doc: c.nro_doc,
          detalle: `RECEPCIÓN FACTURA/NOTA: ${c.nro_doc}`,
          cargo: parseFloat(c.total as any) || 0,
          abono: 0,
        });

        // Abonos (Pagos)
        if (Array.isArray(c.historial_abonos)) {
          c.historial_abonos.forEach((ab) => {
            const docAsoc = ab.nro_doc || c.nro_doc;
            list.push({
              id: c.id_registro,
              fecha: ab.fecha,
              proveedor: provName,
              rif: rifProv,
              tipo: 'ABONO (PAGO)',
              nro_doc: docAsoc,
              detalle: `PAGO FACTURA/NOTA [${docAsoc}] VÍA ${ab.metodo_pago || 'TRANSFERENCIA'} [REF: ${ab.referencia || 'S/R'}]`,
              cargo: 0,
              abono: parseFloat(ab.monto_usd as any) || 0,
            });
          });
        }
      }
    });

    // Sort chronologically
    list.sort((a, b) => {
      const dateA = new Date(convertirDDMMYYYYToYYYYMMDD(a.fecha)).getTime();
      const dateB = new Date(convertirDDMMYYYYToYYYYMMDD(b.fecha)).getTime();
      return dateA - dateB;
    });

    // Calculate running balance
    let saldoAcumulado = 0;
    return list.map((m) => {
      saldoAcumulado += m.cargo - m.abono;
      return {
        ...m,
        saldo: redondearExacto(saldoAcumulado > 0.009 ? saldoAcumulado : 0, 2),
      };
    });
  }, [compras, proveedorFiltro, infoProveedores]);

  // Summary statistics
  const stats = useMemo(() => {
    let cargos = 0;
    let abonos = 0;
    movimientos.forEach((m) => {
      cargos += m.cargo;
      abonos += m.abono;
    });
    const saldo = redondearExacto(Math.max(0, cargos - abonos), 2);
    return {
      cargos: redondearExacto(cargos, 2),
      abonos: redondearExacto(abonos, 2),
      saldo,
    };
  }, [movimientos]);

  const datosBancariosSeleccionado = useMemo(() => {
    if (!proveedorFiltro) return 'VISUALIZANDO TODOS LOS PROVEEDORES';
    const found = infoProveedores[proveedorFiltro.toUpperCase().trim()];
    return found?.cuenta || 'BANCO BANESCO / VENEZUELA';
  }, [proveedorFiltro, infoProveedores]);

  const handleImprimir = () => {
    imprimirEstadoCuenta(
      proveedorFiltro,
      movimientos,
      stats.cargos,
      stats.abonos,
      stats.saldo
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <label className="font-black text-xs text-blue-900 uppercase whitespace-nowrap">
            SELECCIONAR PROVEEDOR:
          </label>
          <select
            value={proveedorFiltro}
            onChange={(e) => setProveedorFiltro(e.target.value)}
            className="w-full lg:w-96 border-2 border-blue-600 bg-blue-50/60 p-2.5 rounded-xl font-black text-xs text-blue-950 uppercase outline-none focus:border-blue-700"
          >
            <option value="">-- TODOS LOS PROVEEDORES (TODOS LOS MOVIMIENTOS) --</option>
            {proveedoresList.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={onRecargar}
            className="bg-blue-900 hover:bg-blue-950 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RECARGAR</span>
          </button>
          <button
            onClick={handleImprimir}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>🖨️ IMPRIMIR ESTADO DE CUENTA</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
            Total Cargos (Facturas)
          </span>
          <span className="text-xl font-mono font-black text-emerald-700 block mt-0.5">
            $ {formatearVE(stats.cargos)}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
            Total Abonos (Pagos)
          </span>
          <span className="text-xl font-mono font-black text-blue-800 block mt-0.5">
            $ {formatearVE(stats.abonos)}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
            Saldo Pendiente Neto
          </span>
          <span className="text-xl font-mono font-black text-red-700 block mt-0.5">
            $ {formatearVE(stats.saldo)}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
            Coordenadas / Datos Bancarios
          </span>
          <span className="text-xs font-mono font-extrabold text-slate-800 truncate block mt-1">
            {datosBancariosSeleccionado}
          </span>
        </div>
      </div>

      {/* Kardex Chronological Table */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
        <div className="border-b pb-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-900" />
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">
              📜 Kardex Cronológico de Cargos y Abonos
            </h3>
          </div>
          <span className="bg-blue-100 text-blue-950 text-xs font-black px-3 py-1 rounded-full">
            {movimientos.length} Movimientos
          </span>
        </div>

        <div className="overflow-x-auto max-h-[580px] border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-blue-900 text-white font-black uppercase text-[10px] sticky top-0 z-10">
              <tr>
                <th className="p-2.5">Fecha</th>
                <th className="p-2.5">Proveedor / RIF</th>
                <th className="p-2.5">Tipo Movimiento</th>
                <th className="p-2.5">Nro. Doc</th>
                <th className="p-2.5">Detalle / Método / Referencia</th>
                <th className="p-2.5 text-right">Cargo (+) ($)</th>
                <th className="p-2.5 text-right">Abono (-) ($)</th>
                <th className="p-2.5 text-right">Saldo Acumulado ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold uppercase">
              {movimientos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic font-medium">
                    No se encontraron movimientos de cargos ni abonos para este proveedor.
                  </td>
                </tr>
              ) : (
                movimientos.map((m) => {
                  const esCargo = m.tipo.includes('CARGO');
                  return (
                    <tr key={`${m.id}_${m.fecha}`} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-mono text-slate-700">{formatearFechaDDMMYYYY(m.fecha)}</td>
                      <td className="p-2.5 font-black text-blue-900">
                        {m.proveedor}
                        <span className="text-[9px] text-slate-400 font-mono block">{m.rif}</span>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            esCargo
                              ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                              : 'bg-blue-100 text-blue-950 border border-blue-300'
                          }`}
                        >
                          {m.tipo}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-800">{m.nro_doc}</td>
                      <td className="p-2.5 font-bold text-slate-700 max-w-xs truncate">{m.detalle}</td>
                      <td className="p-2.5 font-mono text-right text-emerald-700 font-black">
                        {m.cargo > 0 ? `$ ${formatearVE(m.cargo)}` : '---'}
                      </td>
                      <td className="p-2.5 font-mono text-right text-blue-700 font-black">
                        {m.abono > 0 ? `$ ${formatearVE(m.abono)}` : '---'}
                      </td>
                      <td
                        className={`p-2.5 font-mono text-right font-black ${
                          m.saldo > 0.009 ? 'text-red-700' : 'text-slate-400'
                        }`}
                      >
                        $ {formatearVE(m.saldo)}
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
  );
};
