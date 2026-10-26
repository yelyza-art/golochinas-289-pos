import React, { useMemo } from 'react';
import { Printer, Receipt } from 'lucide-react';
import { VentaRegistro, TasasCambio } from '../types';
import { formatearVE, formatearFechaDDMMYYYY } from '../utils/formatters';

interface DeudoresModuloProps {
  ventas: VentaRegistro[];
  tasas: TasasCambio;
}

export const DeudoresModulo: React.FC<DeudoresModuloProps> = ({ ventas, tasas }) => {
  const deudores = useMemo(() => {
    return ventas.filter((v) => v.condicion_pago === 'CRÉDITO' && v.estado !== 'CANCELADA');
  }, [ventas]);

  const totalDeudaUSD = deudores.reduce((acc, v) => acc + (v.total_usd || 0), 0);
  const totalDeudaBs = deudores.reduce((acc, v) => acc + (v.total_bs || 0), 0);

  const imprimirListadoDeudores = () => {
    const area = document.getElementById('area-impresion');
    if (!area) return;

    let filasHtml = '';
    deudores.forEach(v => {
      filasHtml += `
        <tr style="border-bottom:1px solid #ddd;">
            <td style="padding:4px;">${v.fecha}</td>
            <td style="padding:4px; font-weight:bold;">${v.cliente}</td>
            <td style="padding:4px; text-align:right;">$ ${formatearVE(v.total_usd)}</td>
            <td style="padding:4px; text-align:right;">Bs. ${formatearVE(v.total_bs)}</td>
        </tr>
      `;
    });

    area.innerHTML = `
      <div style="font-family:Arial,sans-serif; padding:5mm; font-size:9pt;">
        <h2 style="text-align:center; color:#1e3a8a;">LISTADO DE DEUDORES</h2>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#1e3a8a; color:#fff;">
                <th style="padding:5px; text-align:left;">Fecha</th>
                <th style="padding:5px; text-align:left;">Cliente</th>
                <th style="padding:5px; text-align:right;">Total ($)</th>
                <th style="padding:5px; text-align:right;">Total (Bs)</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
        <div style="margin-top:5mm; font-weight:bold; text-align:right;">
          TOTAL DEUDA: $ ${formatearVE(totalDeudaUSD)} / Bs. ${formatearVE(totalDeudaBs)}
        </div>
      </div>
    `;
    setTimeout(() => { window.print(); setTimeout(() => area.innerHTML = '', 500); }, 150);
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h2 className="font-black text-slate-800 uppercase text-sm flex items-center gap-2">
          <Receipt className="w-4 h-4 text-red-600" />
          Listado de Deudores (Ventas a Crédito)
        </h2>
        <button
          onClick={imprimirListadoDeudores}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm"
        >
          <Printer className="w-3.5 h-3.5" />
          IMPRIMIR LISTADO
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800 text-white uppercase font-black text-[10px]">
            <tr>
              <th className="p-2">Fecha</th>
              <th className="p-2">Cliente</th>
              <th className="p-2 text-right">Monto ($)</th>
              <th className="p-2 text-right">Monto (Bs)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-bold uppercase">
            {deudores.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-slate-400 italic">No hay deudores registrados. 🎉</td></tr>
            ) : (
              deudores.map((v, i) => (
                <tr key={`${v.id_venta}_${i}`} className="hover:bg-slate-50">
                  <td className="p-2 text-slate-600">{v.fecha}</td>
                  <td className="p-2 text-slate-800">{v.cliente}</td>
                  <td className="p-2 text-right text-emerald-700 font-mono font-black">$ {formatearVE(v.total_usd)}</td>
                  <td className="p-2 text-right text-blue-700 font-mono font-black">Bs. {formatearVE(v.total_bs)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
