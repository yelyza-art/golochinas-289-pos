import React, { useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Upload, Image, Settings, Cloud } from 'lucide-react';
import { TasasCambio, OfflineAction } from '../types';
import { StorageService } from '../services/storage';
import { comprimirImagen } from '../utils/imageUtils';
import { formatearVE } from '../utils/formatters';
import { PWAInstallButton } from './PWAInstallButton';
import { imprimirTasaBCV } from '../utils/printHelpers';

interface HeaderProps {
  tasas: TasasCambio;
  onUpdateTasas: (newTasas: TasasCambio) => void;
  logo: string | null;
  onUpdateLogo: (newLogo: string) => void;
  isOnline: boolean;
  offlineQueue: OfflineAction[];
  onOpenOfflineQueue: () => void;
  onOpenSettings: () => void;
  onOpenDriveBackup?: () => void;
  onSyncCloud: () => void;
  syncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  tasas,
  onUpdateTasas,
  logo,
  onUpdateLogo,
  isOnline,
  offlineQueue,
  onOpenOfflineQueue,
  onOpenSettings,
  onOpenDriveBackup,
  onSyncCloud,
  syncing,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await comprimirImagen(file, 350, 0.9);
        StorageService.saveLogo(compressedBase64);
        onUpdateLogo(compressedBase64);
      } catch (err) {
        console.error("Error optimizando logo:", err);
      }
    }
  };

  const handleTasaChange = (field: keyof TasasCambio, value: string) => {
    const num = parseFloat(value);
    const updated = {
      ...tasas,
      [field]: isNaN(num) ? 0 : num,
    };
    onUpdateTasas(updated);
  };

  // Calculate currency spread (brecha cambiaria)
  const brecha = tasas.tasaBcv > 0 ? ((tasas.tasaUsdt - tasas.tasaBcv) / tasas.tasaBcv) * 100 : 0;

  return (
    <header className="no-print space-y-3">
      {/* Top Navbar */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white p-3.5 sm:p-4 shadow-lg border-b border-blue-800 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center space-x-3">
          {logo ? (
            <div className="relative group">
              <img
                src={logo}
                alt="Logo"
                className="h-12 w-12 object-contain rounded-xl bg-white p-1 border border-white/20 shadow-md"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-[9px] text-white font-bold"
                title="Cambiar Logo"
              >
                CAMBIAR
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-12 w-12 rounded-xl bg-blue-800/80 border border-blue-600/60 flex flex-col items-center justify-center text-blue-200 hover:text-white hover:bg-blue-700 transition cursor-pointer shadow-inner"
              title="Cargar Logo de la Empresa"
            >
              <Image className="w-5 h-5 text-amber-300" />
              <span className="text-[8px] font-black tracking-wider uppercase mt-0.5">LOGO</span>
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-wider text-white drop-shadow">
                GOLOCHINAS 289
              </h1>
              <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded border border-amber-400/40 uppercase hidden sm:inline-block">
                POS PRO V2
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-blue-200 font-bold tracking-tight">
              SISTEMA INTEGRADO DE VENTAS, INVENTARIO Y COMPRAS
            </p>
          </div>
        </div>

        {/* Action Controls & Indicators */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Connection status badge */}
          <button
            onClick={onOpenOfflineQueue}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border transition cursor-pointer ${
              isOnline
                ? offlineQueue.length > 0
                  ? 'bg-amber-800/90 text-amber-200 border-amber-600 hover:bg-amber-800'
                  : 'bg-emerald-800/90 text-emerald-100 border-emerald-600 hover:bg-emerald-800'
                : 'bg-red-900/90 text-red-200 border-red-700 hover:bg-red-800'
            }`}
            title="Ver estado de conexión y cola offline"
          >
            {isOnline ? (
              offlineQueue.length > 0 ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-amber-300" />
                  <span>ONLINE ({offlineQueue.length} PENDIENTES)</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>EN LÍNEA (SHEET)</span>
                </>
              )
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-300 animate-pulse" />
                <span>OFFLINE ({offlineQueue.length})</span>
              </>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={onSyncCloud}
            disabled={syncing || !isOnline}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
              isOnline
                ? 'bg-blue-800/80 hover:bg-blue-700 text-blue-100 border-blue-600 cursor-pointer'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            }`}
            title="Sincronizar y recargar datos de Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-amber-300' : ''}`} />
            <span className="hidden md:inline">{syncing ? 'ACTUALIZANDO...' : 'RECARGAR'}</span>
          </button>

          {/* PWA / APK Install Button */}
          <PWAInstallButton />

          {/* Google Drive Backup Button */}
          {onOpenDriveBackup && (
            <button
              onClick={onOpenDriveBackup}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-800/80 hover:bg-blue-700 text-blue-100 hover:text-white rounded-lg border border-blue-600 cursor-pointer transition text-xs font-bold"
              title="Copia de seguridad automática y manual en Google Drive"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-300" />
              <span className="hidden sm:inline">RESPALDO DRIVE</span>
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 bg-blue-800/80 hover:bg-blue-700 text-blue-200 hover:text-white rounded-lg border border-blue-600 cursor-pointer transition"
            title="Configuración & Enlace Google Apps Script"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Exchange Rates Ribbon */}
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="bg-gradient-to-r from-blue-950 to-slate-900 text-white p-3 rounded-xl shadow-md border border-blue-800 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-black block text-blue-300 uppercase tracking-wider flex justify-between">
              <span>Tasa USD BCV Global</span>
              <button 
                onClick={() => imprimirTasaBCV(tasas)}
                className="text-white hover:text-amber-400 transition"
                title="Imprimir Tasa BCV"
              >
                🖨️
              </button>
            </label>
            <input
              type="number"
              step="any"
              value={tasas.tasaBcv}
              onChange={(e) => handleTasaChange('tasaBcv', e.target.value)}
              className="w-full bg-blue-900/60 border border-blue-600 rounded-lg p-1.5 font-mono font-black text-sm text-center text-white outline-none focus:border-emerald-400 transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-black block text-blue-300 uppercase tracking-wider">
              Tasa Euro BCV
            </label>
            <input
              type="number"
              step="any"
              value={tasas.tasaEuro}
              onChange={(e) => handleTasaChange('tasaEuro', e.target.value)}
              className="w-full bg-blue-900/60 border border-blue-700 rounded-lg p-1.5 font-mono font-black text-sm text-center text-white outline-none focus:border-emerald-400 transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-black block text-blue-300 uppercase tracking-wider">
              Tasa USDT (Inm.)
            </label>
            <input
              type="number"
              step="any"
              value={tasas.tasaUsdt}
              onChange={(e) => handleTasaChange('tasaUsdt', e.target.value)}
              className="w-full bg-blue-900/60 border border-blue-700 rounded-lg p-1.5 font-mono font-black text-sm text-center text-white outline-none focus:border-emerald-400 transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-black block text-amber-300 uppercase tracking-wider">
              Brecha Cambiaria
            </label>
            <div className="w-full bg-slate-800/90 border border-amber-600/50 text-amber-400 font-mono font-black text-sm text-center py-1.5 rounded-lg">
              {formatearVE(brecha, 2)}%
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
