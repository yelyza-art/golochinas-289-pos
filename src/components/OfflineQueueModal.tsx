import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Trash2, Download, Upload, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { OfflineAction } from '../types';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { formatearFechaDDMMYYYY } from '../utils/formatters';

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: OfflineAction[];
  isOnline: boolean;
  onQueueUpdated: () => void;
}

export const OfflineQueueModal: React.FC<OfflineQueueModalProps> = ({
  isOpen,
  onClose,
  queue,
  isOnline,
  onQueueUpdated,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    if (!isOnline) {
      alert("⚠️ No hay conexión a internet actualmente. Conéctate a Wi-Fi o datos para sincronizar.");
      return;
    }
    setSyncing(true);
    setSyncStatus("Iniciando sincronización...");
    try {
      const result = await ApiService.syncOfflineQueue((current, total) => {
        setSyncStatus(`Sincronizando ${current} de ${total}...`);
      });
      setSyncStatus(`Completado: ${result.processed} sincronizados, ${result.failed} pendientes.`);
      onQueueUpdated();
    } catch (err: any) {
      setSyncStatus(`Error: ${err?.message || 'Fallo de sincronización'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    if (confirm("¿Deseas descartar esta acción pendiente?")) {
      StorageService.removeFromOfflineQueue(id);
      onQueueUpdated();
    }
  };

  const handleClearAll = () => {
    if (confirm("⚠️ ¿Estás seguro de vaciar toda la cola offline? Las transacciones no enviadas se perderán.")) {
      StorageService.clearOfflineQueue();
      onQueueUpdated();
    }
  };

  const handleExportBackup = () => {
    const jsonStr = StorageService.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_golochinas_pos_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const ok = StorageService.importBackupJSON(content);
        if (ok) {
          alert("✅ Respaldo importado exitosamente.");
          onQueueUpdated();
          window.location.reload();
        } else {
          alert("❌ El archivo de respaldo no es válido.");
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isOnline ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-700' : 'bg-amber-900/60 text-amber-400 border border-amber-700'}`}>
              {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-black text-sm uppercase">Estado de Conexión & Cola Offline</h3>
              <p className="text-[11px] text-slate-400">
                {isOnline ? '🟢 En línea - Conectado con Google Sheets' : '🟠 Modo Fuera de Línea - Operando con memoria local'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Alert */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs font-bold text-slate-600 block">Acciones pendientes de sincronización:</span>
              <span className="text-lg font-mono font-black text-blue-900">{queue.length} Operaciones</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncNow}
                disabled={syncing || queue.length === 0 || !isOnline}
                className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition ${
                  queue.length > 0 && isOnline && !syncing
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR AHORA'}
              </button>
              {queue.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs cursor-pointer"
                  title="Limpiar cola"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {syncStatus && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-900 text-center">
              {syncStatus}
            </div>
          )}

          {/* Queue List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-600 uppercase border-b border-slate-200">
              Operaciones en espera:
            </div>
            {queue.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs italic flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span>Todo está al día. No hay transacciones pendientes en la cola local.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {queue.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px]">
                          {item.action}
                        </span>
                        <span className="font-bold text-slate-800">{item.description}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatearFechaDDMMYYYY(new Date(item.timestamp))} • Intentos: {item.retryCount}
                        {item.lastError && (
                          <span className="text-red-500 font-bold ml-1">({item.lastError})</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backup & Restore section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-black text-slate-700 uppercase block">Copia de Seguridad Local (JSON)</span>
            <p className="text-[11px] text-slate-500">
              Guarda o restaura todo el inventario, compras, proveedores y ventas almacenados en este dispositivo.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleExportBackup}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                Descargar Respaldo JSON
              </button>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer shadow-sm">
                <Upload className="w-3.5 h-3.5 text-emerald-700" />
                Restaurar Respaldo
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
