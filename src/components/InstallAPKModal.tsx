import React from 'react';
import { Smartphone, Monitor, Tablet, Download, CheckCircle, Wifi, ShieldCheck, ExternalLink, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallAPKModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAPKModal: React.FC<InstallAPKModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 to-blue-900 text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-800/80 rounded-xl border border-blue-700">
              <Download className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-wide uppercase">Instalar App / APK en Android, Tablet y PC</h3>
              <p className="text-xs text-blue-200 font-medium">Modo Standalone 100% Pantalla Completa & Offline Nativo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-blue-300 hover:text-white p-1 rounded-lg hover:bg-blue-800/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Direct Install CTA if installable */}
          {isInstallable && !isInstalled && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">Recomendado</span>
                <h4 className="font-black text-emerald-950 text-base mt-1">¡Tu dispositivo permite instalación directa en 1 clic!</h4>
                <p className="text-xs text-emerald-800 mt-0.5">Se creará el ícono APK en tu pantalla principal y menú de apps.</p>
              </div>
              <button
                onClick={handleInstallClick}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4" /> INSTALAR AHORA
              </button>
            </div>
          )}

          {isInstalled && (
            <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 flex items-center gap-3 text-blue-900">
              <CheckCircle className="w-6 h-6 text-blue-600 shrink-0" />
              <div>
                <p className="font-black text-sm">¡Esta aplicación ya está instalada en tu dispositivo!</p>
                <p className="text-xs text-blue-700">Puedes ejecutarla desde tu escritorio o menú de aplicaciones en modo offline sin conexión.</p>
              </div>
            </div>
          )}

          {/* Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <Wifi className="w-5 h-5 text-blue-700 mx-auto mb-1" />
              <div className="font-black text-xs text-slate-800 uppercase">Online & Offline</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Vende, edita inventario y cobra sin internet; sincroniza al conectar.</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <Smartphone className="w-5 h-5 text-emerald-700 mx-auto mb-1" />
              <div className="font-black text-xs text-slate-800 uppercase">Android & Tablet</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Lector de código de barras con cámara nativa y pantalla táctil optimizada.</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <Monitor className="w-5 h-5 text-purple-700 mx-auto mb-1" />
              <div className="font-black text-xs text-slate-800 uppercase">PC & Laptops</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Funciona en Windows, Mac y Linux con impresión de ticket térmica directa.</div>
            </div>
          </div>

          {/* Platform Guides */}
          <div className="space-y-4">
            <h4 className="font-black text-sm text-slate-800 uppercase tracking-wide border-b pb-2">
              Instrucciones por Dispositivo:
            </h4>

            {/* Android / Tablet */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 font-black text-sm text-blue-900">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>1. Android y Tabletas (APK Web Standalone):</span>
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside ml-1">
                <li>Abre esta página en <strong>Google Chrome</strong> o tu navegador móvil.</li>
                <li>Toca el menú de los <strong>3 puntos (⋮)</strong> en la esquina superior derecha.</li>
                <li>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</li>
                <li>Android generará un ícono nativo de <strong>GOLOCHINAS 289</strong> en tu cajón de apps, con soporte offline y pantalla completa.</li>
              </ol>
            </div>

            {/* PC Windows / Mac */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 font-black text-sm text-blue-900">
                <Monitor className="w-4 h-4 text-blue-600" />
                <span>2. Computadoras PC (Windows / Mac / Linux):</span>
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside ml-1">
                <li>En <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>, mira la barra de direcciones superior.</li>
                <li>Haz clic en el ícono de instalación <span className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-300">⊕ Instalar</span> a la derecha del enlace.</li>
                <li>O presiona los 3 puntos (⋮) → <strong>"Guardar y compartir" → "Instalar GOLOCHINAS 289"</strong>.</li>
                <li>Se abrirá en su propia ventana sin barras de navegador como un software de escritorio.</li>
              </ol>
            </div>

            {/* iOS */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 font-black text-sm text-blue-900">
                <Tablet className="w-4 h-4 text-amber-600" />
                <span>3. iPad / iPhone (Safari):</span>
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside ml-1">
                <li>En Safari, toca el botón de <strong>Compartir</strong> (rectángulo con flecha hacia arriba).</li>
                <li>Desliza hacia abajo y pulsa <strong>"Agregar al inicio" (Add to Home Screen)</strong>.</li>
              </ol>
            </div>

            {/* APK Generator note */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>¿Deseas compilar un archivo .APK firmado para Google Play o distribución privada?</span>
              </div>
              <p>
                Al ser una PWA conforme al 100% con los estándares de Google, puedes generar un archivo <strong>.APK binario</strong> usando herramientas oficiales como <strong>PWABuilder (de Microsoft)</strong> o <strong>Bubblewrap CLI (de Google)</strong> ingresando la URL de este sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition"
          >
            ENTENDIDO / CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};
