import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle } from 'lucide-react';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Lector de Código de Barras / QR',
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'html5-qrcode-reader-element';

  useEffect(() => {
    let isMounted = true;

    if (isOpen) {
      setErrorMsg(null);
      // Wait for DOM to render the container
      const timer = setTimeout(() => {
        try {
          const html5QrCode = new Html5Qrcode(containerId);
          scannerRef.current = html5QrCode;

          html5QrCode
            .start(
              { facingMode: 'environment' },
              {
                fps: 15,
                qrbox: { width: 280, height: 160 },
                aspectRatio: 1.0,
              },
              (decodedText: string) => {
                if (isMounted) {
                  onScanSuccess(decodedText);
                  handleClose();
                }
              },
              () => {
                // frame read without qr, ignore
              }
            )
            .catch((err: any) => {
              console.warn("Camera start error:", err);
              if (isMounted) {
                setErrorMsg(
                  "No se pudo acceder a la cámara. Por favor permite los permisos de cámara en tu navegador o selecciona otra entrada."
                );
              }
            });
        } catch (err: any) {
          if (isMounted) {
            setErrorMsg("Error inicializando el lector: " + (err?.message || err));
          }
        }
      }, 300);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current
            .stop()
            .then(() => {
              scannerRef.current?.clear();
              scannerRef.current = null;
            })
            .catch(() => {
              scannerRef.current = null;
            });
        }
      };
    }
  }, [isOpen]);

  const handleClose = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-300 overflow-hidden space-y-4 p-5">
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center gap-2 text-slate-800">
            <Camera className="w-5 h-5 text-blue-700" />
            <h3 className="font-black text-sm uppercase">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-red-600 font-bold text-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        <div className="relative w-full aspect-square bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
          <div id={containerId} className="w-full h-full"></div>
          <div className="absolute inset-0 border-2 border-emerald-500/40 pointer-events-none rounded-xl m-6 flex items-center justify-center">
            <div className="w-full h-0.5 bg-emerald-400 shadow-md animate-pulse"></div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 text-center font-medium">
          Apunta la cámara al código de barra o QR de la golosina para escanearlo automáticamente.
        </p>

        <button
          onClick={handleClose}
          className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer"
        >
          CANCELAR
        </button>
      </div>
    </div>
  );
};
