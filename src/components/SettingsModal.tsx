import React, { useState, useRef } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle, Link, Printer, Building, X, Cloud, Lock, Image, Upload, Trash2, KeyRound } from 'lucide-react';
import { StorageService, AppSettings, DEFAULT_SCRIPT_URL } from '../services/storage';
import { comprimirImagen } from '../utils/imageUtils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: () => void;
  onOpenDriveBackup?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
  onOpenDriveBackup,
}) => {
  const currentSettings = StorageService.getSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scriptUrl, setScriptUrl] = useState(currentSettings.scriptUrl || DEFAULT_SCRIPT_URL);
  const [formato, setFormato] = useState(currentSettings.formatoImpresora || '58mm');
  const [autoSync, setAutoSync] = useState(currentSettings.autoSync ?? true);
  const [empresaNombre, setEmpresaNombre] = useState(currentSettings.empresaNombre || 'GOLOCHINAS 289, C.A.');
  const [empresaRif, setEmpresaRif] = useState(currentSettings.empresaRif || 'J-50412389-0');
  const [empresaUbicacion, setEmpresaUbicacion] = useState(currentSettings.empresaUbicacion || 'SAN DIEGO - ESTADO CARABOBO');
  
  // Seguridad y PIN
  const [pinSeguridad, setPinSeguridad] = useState(currentSettings.pinSeguridad || StorageService.getAdminPin() || '1234');
  const [bloqueoModulosActivo, setBloqueoModulosActivo] = useState(currentSettings.bloqueoModulosActivo ?? true);
  
  // IVA
  const [ivaGeneral, setIvaGeneral] = useState(currentSettings.ivaGeneral ?? 16);
  const [ivaReducida, setIvaReducida] = useState(currentSettings.ivaReducida ?? 8);
  const [margins, setMargins] = useState(currentSettings.impresoraFiscalMargins || { top: 0, bottom: 0, left: 0, right: 0 });

  // Logo
  const [logoActual, setLogoActual] = useState<string | null>(() => StorageService.getLogo());

  if (!isOpen) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await comprimirImagen(file, 350, 0.9);
        setLogoActual(compressedBase64);
        StorageService.saveLogo(compressedBase64);
      } catch (err) {
        console.error("Error optimizando logo:", err);
      }
    }
  };

  const handleEliminarLogo = () => {
    StorageService.removeLogo();
    setLogoActual(null);
  };

  const handleSave = () => {
    const cleanPin = pinSeguridad.trim() || '1234';
    const updated: AppSettings = {
      scriptUrl: scriptUrl.trim(),
      formatoImpresora: formato,
      autoSync,
      empresaNombre: empresaNombre.trim(),
      empresaRif: empresaRif.trim(),
      empresaUbicacion: empresaUbicacion.trim(),
      pinSeguridad: cleanPin,
      bloqueoModulosActivo,
      logoBase64: logoActual || undefined,
      ivaGeneral,
      ivaReducida,
      impresoraFiscalMargins: margins,
    };
    StorageService.saveSettings(updated);
    StorageService.saveAdminPin(cleanPin);
    if (logoActual) {
      StorageService.saveLogo(logoActual);
    }
    onSettingsSaved();
    onClose();
  };

  const handleResetUrl = () => {
    setScriptUrl(DEFAULT_SCRIPT_URL);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-sm uppercase">Configuración del Sistema</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Script URL */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-blue-700" />
                URL Web App Google Apps Script:
              </label>
              <button
                type="button"
                onClick={handleResetUrl}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                Restablecer URL Original
              </button>
            </div>
            <textarea
              rows={3}
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              className="w-full border-2 border-slate-300 p-2 rounded-xl text-xs font-mono outline-none focus:border-blue-600"
              placeholder="https://script.google.com/macros/s/.../exec"
            />
            <p className="text-[10px] text-slate-500">
              Conexión directa a tu hoja de Google Sheets central (ID: 1nymSmGEVekK_XihvVSutsIep_gdRNkAHI-xqki9eV3c).
            </p>
          </div>

          {/* Business Info */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-purple-700" />
              Datos de Factura / Ticket Fiscal
            </span>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Nombre Comercial</label>
              <input
                type="text"
                value={empresaNombre}
                onChange={(e) => setEmpresaNombre(e.target.value)}
                className="w-full border border-slate-300 bg-white p-1.5 rounded-lg text-xs font-bold uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">RIF Fiscal</label>
                <input
                  type="text"
                  value={empresaRif}
                  onChange={(e) => setEmpresaRif(e.target.value)}
                  className="w-full border border-slate-300 bg-white p-1.5 rounded-lg text-xs font-mono font-bold uppercase"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Ubicación</label>
                <input
                  type="text"
                  value={empresaUbicacion}
                  onChange={(e) => setEmpresaUbicacion(e.target.value)}
                  className="w-full border border-slate-300 bg-white p-1.5 rounded-lg text-xs font-bold uppercase"
                />
              </div>
            </div>
          </div>

          {/* Logo del Negocio con Guardado Permanente */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-indigo-700" />
                Logotipo del Negocio (Tickets y Cabecera)
              </span>
              {logoActual && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Guardado Permanente
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              El logotipo se guarda de forma permanente en el almacenamiento local del dispositivo. Se incluirá automáticamente en tickets impresos y PDF sin necesidad de volver a cargarlo.
            </p>

            <div className="flex items-center gap-3 pt-1">
              {logoActual ? (
                <div className="relative group">
                  <img
                    src={logoActual}
                    alt="Logo"
                    className="h-16 w-16 object-contain rounded-xl bg-white p-1.5 border-2 border-indigo-200 shadow-sm"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-white">
                  <Image className="w-6 h-6 text-slate-300" />
                  <span className="text-[8px] font-bold mt-1">SIN LOGO</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{logoActual ? 'CAMBIAR LOGO' : 'SUBIR LOGOTIPO'}</span>
                </button>
                {logoActual && (
                  <button
                    type="button"
                    onClick={handleEliminarLogo}
                    className="px-2.5 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 font-bold text-[11px] rounded-lg border border-red-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Quitar Logo</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Seguridad y PIN de Acceso Restringido */}
          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-amber-950 uppercase flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                Seguridad: Acceso Restringido a Módulos
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={bloqueoModulosActivo}
                  onChange={(e) => setBloqueoModulosActivo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
            <p className="text-[10px] text-amber-900 leading-snug">
              <strong>Módulo de Ventas libre para cajeros:</strong> Al activar esta opción, solo el módulo de ventas permanece de libre uso. Inventario, Compras, Dashboard y Conciliación requerirán este PIN para desbloquearse.
            </p>

            {bloqueoModulosActivo && (
              <div className="pt-1">
                <label className="text-[10px] font-black text-amber-950 block mb-1 uppercase">
                  PIN de Administrador (4 a 6 dígitos):
                </label>
                <div className="relative max-w-[200px]">
                  <KeyRound className="w-4 h-4 text-amber-700 absolute left-2.5 top-2.5" />
                  <input
                    type="password"
                    maxLength={8}
                    value={pinSeguridad}
                    onChange={(e) => setPinSeguridad(e.target.value)}
                    placeholder="1234"
                    className="w-full border-2 border-amber-300 bg-white p-2 pl-9 rounded-xl font-mono font-black text-sm outline-none focus:border-amber-600 tracking-widest text-center"
                  />
                </div>
                <span className="text-[9px] text-amber-800 font-bold block mt-1">
                  * PIN predeterminado: 1234
                </span>
              </div>
            )}
          </div>
          
          {/* Configuración Tributaria SENIAT */}
          <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-200 space-y-2.5">
            <span className="text-xs font-black text-blue-900 uppercase flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-700" />
              Tasas IVA (Gaceta 43848)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Alícuota General (%)</label>
                <input
                  type="number"
                  value={ivaGeneral}
                  onChange={(e) => setIvaGeneral(Number(e.target.value))}
                  className="w-full border border-blue-300 bg-white p-1.5 rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Alícuota Reducida (%)</label>
                <input
                  type="number"
                  value={ivaReducida}
                  onChange={(e) => setIvaReducida(Number(e.target.value))}
                  className="w-full border border-blue-300 bg-white p-1.5 rounded-lg text-xs font-bold"
                />
              </div>
            </div>
          </div>

          {/* Márgenes Fiscales */}
          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-2.5">
            <span className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-amber-700" />
              Ajustes de Márgenes Fiscales (mm)
            </span>
            <div className="grid grid-cols-2 gap-3">
              {(['top', 'bottom', 'left', 'right'] as const).map(m => (
                <div key={m}>
                  <label className="text-[10px] font-bold text-slate-700 block mb-0.5 capitalize">{m}</label>
                  <input type="number" value={margins[m]} onChange={(e) => setMargins({...margins, [m]: Number(e.target.value)})} className="w-full border border-amber-300 bg-white p-1.5 rounded-lg text-xs font-bold" />
                </div>
              ))}
            </div>
          </div>


          {/* Printer format & Preview */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="space-y-1.5">
              <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-emerald-700" />
                Formato de Impresión Predeterminado
              </span>
              <select
                value={formato}
                onChange={(e) => setFormato(e.target.value as any)}
                className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl text-xs font-bold"
              >
                <option value="58mm">Impresora Térmica 58 mm (Área Útil 44 mm)</option>
                <option value="80mm">Tiquera Térmica 80 mm (Estándar POS)</option>
                <option value="pdf">Documento PDF / Carta A4</option>
              </select>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <span className="text-[10px] font-black text-slate-500 uppercase">Previsualización de Ticket ({formato})</span>
              <div className="mt-2 p-3 bg-white border border-slate-300 rounded-lg shadow-inner overflow-hidden flex justify-center" style={{ width: formato === '58mm' ? '140px' : (formato === '80mm' ? '200px' : '200px'), margin: '0 auto' }}>
                <div className="text-[6px] font-mono leading-tight" style={{ width: '100%' }}>
                  <div className="text-center font-bold">GOLOCHINAS 289</div>
                  <div className="text-center text-[5px]">RIF: J-50814951-3</div>
                  <div className="border-b border-black my-1"></div>
                  <div className="flex justify-between"><span>Cliente:</span><span>VALENTINA</span></div>
                  <div className="border-b border-black my-1"></div>
                  {logoActual && <img src={logoActual} className="w-10 h-10 mx-auto my-1 object-contain" />}
                  <div className="flex justify-between"><span>1x DULCE EJEMPLO</span><span>$ 1.50</span></div>
                  <div className="border-t border-black mt-1 pt-1 text-right font-bold">TOTAL: $ 1.50</div>
                </div>
              </div>
            </div>
          </div>

          {/* Google Drive Backup Section */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-600" />
                Respaldo en la Nube (Google Drive)
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Copia programada y manual de todo el almacenamiento del sistema en tu Google Drive.
              </p>
            </div>
            {onOpenDriveBackup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDriveBackup();
                }}
                className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Cloud className="w-3 h-3" />
                <span>CONFIGURAR</span>
              </button>
            )}
          </div>
          {/* Impresión Logs */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-slate-700" />
              Historial de Impresión
            </span>
            <div className="max-h-40 overflow-y-auto text-[10px] font-mono space-y-1">
              {StorageService.getPrintLogs().map(log => (
                <div key={log.id} className={`p-1 rounded ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {log.timestamp} | {log.printerModel} | {log.status} {log.errorMessage ? `: ${log.errorMessage}` : ''}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white font-black text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>GUARDAR CONFIGURACIÓN</span>
          </button>
        </div>
      </div>
    </div>
  );
};
