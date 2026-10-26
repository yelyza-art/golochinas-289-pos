import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Eye, EyeOff, X, Check, ShieldAlert } from 'lucide-react';
import { StorageService } from '../services/storage';

interface ModalPinSeguridadProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
  moduloDestinoNombre?: string;
}

export const ModalPinSeguridad: React.FC<ModalPinSeguridadProps> = ({
  isOpen,
  onClose,
  onUnlockSuccess,
  moduloDestinoNombre = 'Módulo Administrativo',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [mostrarPin, setMostrarPin] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleValidar = (codigo: string) => {
    const adminPin = StorageService.getAdminPin() || '1234';
    if (codigo === adminPin) {
      StorageService.setAdminUnlocked(true);
      setError(false);
      onUnlockSuccess();
    } else {
      setError(true);
      setPin('');
    }
  };

  const handleNumeroClick = (num: string) => {
    if (pin.length < 8) {
      const nuevoPin = pin + num;
      setPin(nuevoPin);
      setError(false);
      if (nuevoPin.length === 4) {
        // Auto-validar si alcanza los 4 dígitos clásicos
        const adminPin = StorageService.getAdminPin() || '1234';
        if (nuevoPin === adminPin) {
          handleValidar(nuevoPin);
        }
      }
    }
  };

  const handleBorrar = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleValidar(pin);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30 text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide">Acceso Restringido</h3>
              <p className="text-[10px] text-slate-300">Se requiere PIN de Administrador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Módulo Solicitado:
            </span>
            <span className="text-xs font-black text-blue-950 uppercase block mt-0.5">
              {moduloDestinoNombre}
            </span>
            <p className="text-[10px] text-slate-500 mt-1">
              El módulo de ventas está libre. Para entrar a inventario, compras, reportes o métricas ingresa el código.
            </p>
          </div>

          {/* Form input */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                type={mostrarPin ? 'text' : 'password'}
                value={pin}
                autoFocus
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(false);
                }}
                maxLength={8}
                placeholder="••••"
                className={`w-full text-center font-mono font-black text-2xl tracking-widest p-3 rounded-2xl border-2 outline-none transition ${
                  error
                    ? 'border-rose-500 bg-rose-50 text-rose-900'
                    : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-600 focus:bg-white'
                }`}
              />
              <button
                type="button"
                onClick={() => setMostrarPin(!mostrarPin)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={mostrarPin ? 'Ocultar PIN' : 'Ver PIN'}
              >
                {mostrarPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-1.5 text-rose-600 text-xs font-black animate-shake">
                <ShieldAlert className="w-4 h-4" />
                <span>PIN incorrecto. Intenta de nuevo.</span>
              </div>
            )}

            {/* Virtual Numpad */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleNumeroClick(n.toString())}
                  className="py-3 bg-slate-100 hover:bg-slate-200 active:bg-blue-100 text-slate-800 font-mono font-black text-lg rounded-xl transition cursor-pointer shadow-2xs"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBorrar}
                className="py-3 bg-slate-200 hover:bg-rose-100 active:bg-rose-200 text-slate-700 hover:text-rose-700 font-black text-xs rounded-xl transition cursor-pointer flex items-center justify-center"
              >
                BORRAR
              </button>
              <button
                type="button"
                onClick={() => handleNumeroClick('0')}
                className="py-3 bg-slate-100 hover:bg-slate-200 active:bg-blue-100 text-slate-800 font-mono font-black text-lg rounded-xl transition cursor-pointer shadow-2xs"
              >
                0
              </button>
              <button
                type="submit"
                className="py-3 bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white font-black text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>ENTRAR</span>
              </button>
            </div>
          </form>

          <div className="text-center pt-1 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 font-medium">
              PIN por defecto: <strong className="text-slate-600 font-mono">1234</strong> (configurable en Ajustes)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
