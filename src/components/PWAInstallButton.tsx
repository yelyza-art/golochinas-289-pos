import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallAPKModal } from './InstallAPKModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        {isInstallable && !isInstalled ? (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3 py-1.5 rounded-lg shadow-sm border border-emerald-500 cursor-pointer transition active:scale-95 animate-pulse"
            title="Instalar como aplicación en este dispositivo"
          >
            <Download className="w-3.5 h-3.5" />
            <span>INSTALAR APP</span>
          </button>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-blue-800 hover:bg-blue-700 text-blue-100 hover:text-white font-bold text-xs px-2.5 py-1.5 rounded-lg border border-blue-700 cursor-pointer transition"
            title="Instrucciones para instalar en Android, Tablet y PC"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">INSTALAR APK / PC</span>
            <span className="sm:hidden">APP</span>
          </button>
        )}
      </div>

      <InstallAPKModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};
