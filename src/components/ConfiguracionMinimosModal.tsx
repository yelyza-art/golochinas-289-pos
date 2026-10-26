import React, { useState, useMemo, useEffect } from 'react';
import { Sliders, CheckCircle2, AlertTriangle, Package, X, Sparkles, RefreshCw, Save, Layers } from 'lucide-react';
import { InventarioItem } from '../types';

interface ConfiguracionMinimosModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventario: InventarioItem[];
  onGuardarMinimosMasivos: (ajustes: Record<string, number>) => Promise<void>;
}

export const ConfiguracionMinimosModal: React.FC<ConfiguracionMinimosModalProps> = ({
  isOpen,
  onClose,
  inventario,
  onGuardarMinimosMasivos,
}) => {
  // Mapping of category to user-configured minimum stock
  const [minimosPorCategoria, setMinimosPorCategoria] = useState<Record<string, number>>({});
  const [presetGlobal, setPresetGlobal] = useState<string>('10');
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Group inventory items by category
  const categoriasDetalle = useMemo(() => {
    const map: Record<
      string,
      {
        categoria: string;
        productosCount: number;
        stockTotal: number;
        minimoPromedio: number;
        productosCriticosActuales: number;
        productos: InventarioItem[];
      }
    > = {};

    inventario.forEach((prod) => {
      const cat = (prod.categoria || 'GOLOSINAS').toUpperCase().trim();
      if (!map[cat]) {
        map[cat] = {
          categoria: cat,
          productosCount: 0,
          stockTotal: 0,
          minimoPromedio: 0,
          productosCriticosActuales: 0,
          productos: [],
        };
      }
      map[cat].productosCount += 1;
      map[cat].stockTotal += prod.stock || 0;
      map[cat].productos.push(prod);

      const min = prod.stock_minimo !== undefined ? prod.stock_minimo : 0;
      if ((prod.stock || 0) <= min) {
        map[cat].productosCriticosActuales += 1;
      }
    });

    // Compute average minimum
    Object.keys(map).forEach((k) => {
      const totalMin = map[k].productos.reduce(
        (acc, p) => acc + (p.stock_minimo !== undefined ? p.stock_minimo : 5),
        0
      );
      map[k].minimoPromedio = Math.round(totalMin / map[k].productosCount);
    });

    return Object.values(map).sort((a, b) => a.categoria.localeCompare(b.categoria));
  }, [inventario]);

  // Initialize inputs with current average or existing minimums
  useEffect(() => {
    if (isOpen) {
      const inicial: Record<string, number> = {};
      categoriasDetalle.forEach((c) => {
        inicial[c.categoria] = c.minimoPromedio || 5;
      });
      setMinimosPorCategoria(inicial);
      setMensajeExito(null);
    }
  }, [isOpen, categoriasDetalle]);

  if (!isOpen) return null;

  const handleCambiarMinimo = (categoria: string, valorStr: string) => {
    const num = Math.max(0, parseInt(valorStr, 10) || 0);
    setMinimosPorCategoria((prev) => ({
      ...prev,
      [categoria]: num,
    }));
  };

  const handleAjustarStepper = (categoria: string, delta: number) => {
    setMinimosPorCategoria((prev) => {
      const actual = prev[categoria] ?? 5;
      return {
        ...prev,
        [categoria]: Math.max(0, actual + delta),
      };
    });
  };

  const handleAplicarPresetGlobal = () => {
    const num = Math.max(0, parseInt(presetGlobal, 10) || 0);
    const updated: Record<string, number> = {};
    categoriasDetalle.forEach((c) => {
      updated[c.categoria] = num;
    });
    setMinimosPorCategoria(updated);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setMensajeExito(null);
    try {
      await onGuardarMinimosMasivos(minimosPorCategoria);
      setMensajeExito("¡Niveles de stock mínimo actualizados exitosamente en todos los productos!");
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      alert("❌ Error actualizando mínimos: " + (err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  // Compute how many total products will be modified
  const totalProductosAfectados = categoriasDetalle.reduce((acc, c) => acc + c.productosCount, 0);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 to-indigo-950 text-white p-5 flex justify-between items-center border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-800/80 rounded-xl border border-blue-700 shadow-inner">
              <Sliders className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-wide">
                Configuración Masiva de Stock Mínimo
              </h3>
              <p className="text-xs text-blue-200">
                Define el umbral de alerta y reposición automática para cada categoría de productos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white p-1 rounded-lg hover:bg-blue-800/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Success Banner */}
          {mensajeExito && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-bounce">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* Quick Preset Toolbar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-black text-slate-800 uppercase">
                Ajuste Rápido Global:
              </span>
              <span className="text-[11px] text-slate-500">
                Establecer el mismo mínimo a todas las categorías
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={presetGlobal}
                onChange={(e) => setPresetGlobal(e.target.value)}
                className="w-16 border-2 border-slate-300 bg-white p-1 rounded-lg font-black text-xs text-center outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={handleAplicarPresetGlobal}
                className="px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-black text-xs rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
              >
                APLICAR A TODAS
              </button>
            </div>
          </div>

          {/* Category Cards List */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-black text-slate-700 uppercase">
                Categorías Detectadas ({categoriasDetalle.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Total de {totalProductosAfectados} artículos vinculados
              </span>
            </div>

            {categoriasDetalle.map((catInfo) => {
              const nuevoMinimo = minimosPorCategoria[catInfo.categoria] ?? catInfo.minimoPromedio ?? 5;
              
              // Count how many products will be flagged as critical under this new minimum
              const proyectadosCriticos = catInfo.productos.filter(
                (p) => (p.stock || 0) <= nuevoMinimo
              ).length;

              return (
                <div
                  key={catInfo.categoria}
                  className="p-3.5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl shadow-sm transition flex flex-wrap items-center justify-between gap-3"
                >
                  {/* Category Info */}
                  <div className="space-y-0.5 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-blue-950 uppercase">
                        {catInfo.categoria}
                      </span>
                      <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {catInfo.productosCount} productos
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>Stock en mostrador: <strong>{catInfo.stockTotal} uds</strong></span>
                      <span>•</span>
                      <span>Mínimo previo: <strong>{catInfo.minimoPromedio} uds</strong></span>
                    </div>
                  </div>

                  {/* Projected Status Badge */}
                  <div className="flex items-center gap-2">
                    {proyectadosCriticos > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-red-50 text-red-800 border border-red-200 text-[10px] font-black px-2.5 py-1 rounded-lg">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        <span>{proyectadosCriticos} productos quedarán bajo el mínimo</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Stock suficiente para este mínimo</span>
                      </span>
                    )}
                  </div>

                  {/* Minimum Stock Stepper Control */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600 uppercase">
                      Stock Mínimo:
                    </span>
                    <div className="inline-flex items-center border-2 border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                      <button
                        type="button"
                        onClick={() => handleAjustarStepper(catInfo.categoria, -1)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 font-black text-xs border-r border-slate-300 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={nuevoMinimo}
                        onChange={(e) => handleCambiarMinimo(catInfo.categoria, e.target.value)}
                        className="w-14 text-center font-black text-xs p-1 bg-white outline-none text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleAjustarStepper(catInfo.categoria, 1)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 font-black text-xs border-l border-slate-300 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
          <p className="text-[11px] text-slate-500 font-medium">
            💡 Al guardar, todos los artículos de las categorías seleccionadas adoptarán el nuevo nivel mínimo y actualizarán las alertas visuales en rojo.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className={`px-5 py-2 rounded-xl font-black text-xs text-white shadow-md flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                guardando ? 'bg-slate-700 cursor-wait' : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{guardando ? 'APLICANDO CAMBIOS...' : '💾 GUARDAR MÍNIMOS MASIVOS'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
