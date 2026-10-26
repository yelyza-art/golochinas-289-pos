import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  Folder,
  RefreshCw,
  Download,
  Upload,
  LogOut,
  ExternalLink,
  ShieldCheck,
  X,
  Database,
  Calendar,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  getCurrentUser,
} from '../services/googleDriveAuth';
import { DriveFileItem } from '../services/googleDriveService';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess?: () => void;
}

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const [autenticado, setAutenticado] = useState(false);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [cargandoAuth, setCargandoAuth] = useState(false);
  const [ejecutandoRespaldo, setEjecutandoRespaldo] = useState(false);
  const [mensajeRespaldo, setMensajeRespaldo] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Configuración de respaldo programado
  const configActual = StorageService.getDriveBackupConfig();
  const [activoProgramado, setActivoProgramado] = useState(configActual.activo);
  const [intervaloMinutos, setIntervaloMinutos] = useState(configActual.intervaloMinutos || 60);
  const [nombreCarpeta, setNombreCarpeta] = useState(configActual.carpeta || 'GOLOCHINAS_289_BACKUPS');

  // Historial de respaldos en Drive
  const [archivosEnDrive, setArchivosEnDrive] = useState<DriveFileItem[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  // Modal de confirmación para restauración destructiva
  const [archivoParaRestaurar, setArchivoParaRestaurar] = useState<DriveFileItem | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  // Inicializar estado de autenticación al abrir
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initAuth(
      (user, token) => {
        setAutenticado(true);
        setUsuarioEmail(user.email || 'Usuario Google');
        cargarListaArchivos(nombreCarpeta);
      },
      () => {
        setAutenticado(false);
        setUsuarioEmail(null);
      }
    );

    // Verificar si ya tenemos token en memoria
    getAccessToken().then((token) => {
      if (token) {
        setAutenticado(true);
        const usr = getCurrentUser();
        if (usr) setUsuarioEmail(usr.email);
        cargarListaArchivos(nombreCarpeta);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isOpen, nombreCarpeta]);

  const cargarListaArchivos = async (carpeta: string) => {
    setCargandoLista(true);
    try {
      const lista = await ApiService.listarRespaldosDrive(carpeta);
      setArchivosEnDrive(lista);
    } catch (e) {
      console.error('Error cargando lista de respaldos:', e);
    } finally {
      setCargandoLista(false);
    }
  };

  const handleGoogleLogin = async () => {
    setCargandoAuth(true);
    setMensajeRespaldo(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setAutenticado(true);
        setUsuarioEmail(res.user.email);
        cargarListaArchivos(nombreCarpeta);
      }
    } catch (err: any) {
      setMensajeRespaldo({
        tipo: 'error',
        texto: err?.message || 'Error al iniciar sesión con Google.',
      });
    } finally {
      setCargandoAuth(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setAutenticado(false);
    setUsuarioEmail(null);
    setArchivosEnDrive([]);
  };

  // Ejecutar copia de seguridad manual ahora
  const handleEjecutarRespaldoManual = async () => {
    if (!autenticado) {
      alert('Debes iniciar sesión con Google antes de realizar la copia de seguridad.');
      return;
    }

    setEjecutandoRespaldo(true);
    setMensajeRespaldo(null);
    try {
      const resultado = await ApiService.realizarCopiaSeguridadDrive(nombreCarpeta.trim());
      setMensajeRespaldo({
        tipo: 'ok',
        texto: `¡Copia de seguridad exitosa! Guardada como ${resultado.fileName} en la carpeta "${resultado.folderName}".`,
      });
      cargarListaArchivos(nombreCarpeta.trim());
    } catch (err: any) {
      setMensajeRespaldo({
        tipo: 'error',
        texto: err?.message || 'Error al guardar la copia de seguridad en Google Drive.',
      });
    } finally {
      setEjecutandoRespaldo(false);
    }
  };

  // Guardar configuración de respaldo programado
  const handleGuardarProgramacion = () => {
    const carpetaFinal = nombreCarpeta.trim() || 'GOLOCHINAS_289_BACKUPS';
    if (activoProgramado) {
      ApiService.iniciarRespaldoProgramadoDrive(intervaloMinutos, carpetaFinal, false);
      setMensajeRespaldo({
        tipo: 'ok',
        texto: `Copia de seguridad programada activada: se ejecutará cada ${intervaloMinutos} minutos en la carpeta "${carpetaFinal}".`,
      });
    } else {
      ApiService.detenerRespaldoProgramadoDrive();
      setMensajeRespaldo({
        tipo: 'ok',
        texto: 'La copia de seguridad programada ha sido pausada.',
      });
    }
  };

  // Confirmar y ejecutar restauración
  const handleConfirmarRestauracion = async () => {
    if (!archivoParaRestaurar) return;

    setRestaurando(true);
    try {
      const exito = await ApiService.restaurarCopiaSeguridadDrive(archivoParaRestaurar.id);
      if (exito) {
        alert('✅ Copia de seguridad restaurada correctamente en el sistema.');
        setArchivoParaRestaurar(null);
        if (onRestoreSuccess) onRestoreSuccess();
        window.location.reload();
      } else {
        alert('❌ Error al procesar el archivo de copia de seguridad.');
      }
    } catch (err: any) {
      alert('❌ Error restaurando copia: ' + (err?.message || err));
    } finally {
      setRestaurando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600/30 p-2 rounded-xl border border-blue-500/30">
              <Cloud className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide">
                Copia de Seguridad en Google Drive
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Respaldo programado y manual de todo el almacenamiento de la app
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Notification banner */}
          {mensajeRespaldo && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                mensajeRespaldo.tipo === 'ok'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              {mensajeRespaldo.tipo === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{mensajeRespaldo.texto}</span>
            </div>
          )}

          {/* Section 1: Authentication Status with Google */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">
                Cuenta de Google Conectada
              </span>
              {autenticado ? (
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-800">{usuarioEmail}</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    Conectado
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-600">
                    No has conectado tu cuenta de Google Drive
                  </span>
                </div>
              )}
            </div>

            <div>
              {autenticado ? (
                <button
                  onClick={handleLogout}
                  className="text-xs font-bold text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-300 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              ) : (
                /* Google Official Material Button */
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={cargandoAuth}
                  className="gsi-material-button shadow-xs"
                >
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {cargandoAuth ? 'Conectando...' : 'Conectar con Google'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Scheduled Backup Configuration */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-700" />
              <h4 className="text-xs font-black uppercase text-slate-800">
                Configuración del Respaldo Programado
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">
                  Carpeta de Destino en Google Drive:
                </label>
                <div className="relative">
                  <Folder className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={nombreCarpeta}
                    onChange={(e) => setNombreCarpeta(e.target.value)}
                    placeholder="GOLOCHINAS_289_BACKUPS"
                    className="w-full border-2 border-slate-300 bg-white p-2 pl-8 rounded-xl font-mono font-bold text-xs uppercase outline-none focus:border-blue-600"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Si la carpeta no existe en tu Google Drive, se creará automáticamente.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase block mb-1">
                  Frecuencia del Respaldo Automático:
                </label>
                <select
                  value={intervaloMinutos}
                  onChange={(e) => setIntervaloMinutos(parseInt(e.target.value))}
                  className="w-full border-2 border-slate-300 bg-white p-2 rounded-xl font-bold text-xs outline-none focus:border-blue-600"
                >
                  <option value={15}>Cada 15 minutos</option>
                  <option value={30}>Cada 30 minutos</option>
                  <option value={60}>Cada 1 hora (Recomendado)</option>
                  <option value={240}>Cada 4 horas</option>
                  <option value={720}>Cada 12 horas</option>
                  <option value={1440}>Una vez al día (24 horas)</option>
                </select>
              </div>
            </div>

            {/* Enable / Disable toggle switch */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activoProgramado}
                  onChange={(e) => setActivoProgramado(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">
                  Activar ejecución periódica automática de copias de seguridad
                </span>
              </label>

              <button
                type="button"
                onClick={handleGuardarProgramacion}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                Aplicar Programación
              </button>
            </div>
          </div>

          {/* Section 3: Manual Backup Action */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-black text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-300" />
                <span>Respaldo Inmediato de Todo el Sistema</span>
              </h4>
              <p className="text-[11px] text-blue-200 mt-0.5">
                Genera un archivo JSON con todo el contenido de <code>localStorage</code> (inventario, ventas, compras, proveedores y configuración) y lo sube a Drive.
              </p>
            </div>

            <button
              onClick={handleEjecutarRespaldoManual}
              disabled={!autenticado || ejecutandoRespaldo}
              className={`px-4 py-2.5 rounded-xl font-black text-xs shadow transition flex items-center gap-2 whitespace-nowrap ${
                autenticado && !ejecutandoRespaldo
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-95 cursor-pointer'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {ejecutandoRespaldo ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>SUBIENDO A DRIVE...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>RESPALDAR AHORA ☁️</span>
                </>
              )}
            </button>
          </div>

          {/* Section 4: History of Backups in Google Drive Folder */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-blue-600" />
                <span>Archivos de Respaldo en "{nombreCarpeta}" ({archivosEnDrive.length})</span>
              </h4>
              <button
                onClick={() => cargarListaArchivos(nombreCarpeta)}
                disabled={!autenticado || cargandoLista}
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${cargandoLista ? 'animate-spin' : ''}`} />
                <span>Actualizar lista</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {!autenticado ? (
                <div className="p-6 text-center text-slate-400 text-xs italic">
                  Inicia sesión con Google para ver tus respaldos almacenados en Drive.
                </div>
              ) : cargandoLista ? (
                <div className="p-6 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Consultando archivos en Google Drive...</span>
                </div>
              ) : archivosEnDrive.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs italic">
                  No hay archivos de respaldo creados en esta carpeta todavía. Haz clic en "Respaldar Ahora".
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {archivosEnDrive.map((arch) => (
                    <div
                      key={arch.id}
                      className="p-2.5 hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-bold text-slate-800 truncate" title={arch.name}>
                          {arch.name}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {arch.createdTime && (
                            <span>{new Date(arch.createdTime).toLocaleString('es-VE')}</span>
                          )}
                          {arch.size && <span>• {(parseInt(arch.size) / 1024).toFixed(1)} KB</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {arch.webViewLink && (
                          <a
                            href={arch.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                            title="Ver archivo en Google Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => setArchivoParaRestaurar(arch)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                          title="Restaurar este respaldo en el sistema"
                        >
                          <Download className="w-3 h-3 text-blue-700" />
                          <span>Restaurar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* ================= MANDATORY CONFIRMATION MODAL FOR RESTORING BACKUP ================= */}
      {archivoParaRestaurar && (
        <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="bg-red-600 text-white p-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-white" />
              <h3 className="font-black text-sm uppercase">Confirmar Restauración de Datos</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-700 font-medium">
                ¿Estás seguro de que deseas restaurar la copia de seguridad:{' '}
                <strong className="font-mono text-slate-900 block mt-1">{archivoParaRestaurar.name}</strong>?
              </p>
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-900 text-xs font-bold space-y-1">
                <p>⚠️ ADVERTENCIA DE SOBRESCRITURA:</p>
                <p className="font-normal text-[11px]">
                  Esta acción sobrescribirá todos los datos actuales de <code>localStorage</code> (inventario, ventas, compras y proveedores) con el contenido guardado en este archivo.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setArchivoParaRestaurar(null)}
                  disabled={restaurando}
                  className="flex-1 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarRestauracion}
                  disabled={restaurando}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {restaurando ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Restaurando...</span>
                    </>
                  ) : (
                    <span>Sí, Restaurar Datos</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
