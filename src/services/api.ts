import { InventarioItem, CompraItem, Proveedor, VentaRegistro, OfflineAction } from '../types';
import { StorageService } from './storage';
import { formatearIDCorrelativo, redondearExacto } from '../utils/formatters';
import { getAccessToken } from './googleDriveAuth';
import { GoogleDriveService, DriveFileItem } from './googleDriveService';

// Module-level interval timer for scheduled Google Drive backups
let driveBackupTimer: any = null;

export interface CloudResponse {
  inventario?: any[];
  compras?: any[];
  proveedores?: any[];
  ventas?: any[];
  error?: string;
}

export const ApiService = {
  /**
   * Fetches data from Google Apps Script using JSONP (to avoid CORS restrictions)
   */
  fetchCloudData(): Promise<{
    inventario: InventarioItem[];
    compras: CompraItem[];
    proveedores: Proveedor[];
    ventas: VentaRegistro[];
  }> {
    return new Promise((resolve, reject) => {
      if (!navigator.onLine) {
        // Return locally stored data if offline
        return resolve({
          inventario: StorageService.getInventario(),
          compras: StorageService.getCompras(),
          proveedores: StorageService.getProveedores(),
          ventas: StorageService.getVentas(),
        });
      }

      const settings = StorageService.getSettings();
      const scriptUrl = settings.scriptUrl;
      const callbackName = 'golochinas_cb_' + Date.now();
      const script = document.createElement('script');
      script.id = 'jsonp-script-' + Date.now();

      let timeoutId: any = null;

      (window as any)[callbackName] = (dataRaw: CloudResponse) => {
        cleanup();
        if (dataRaw && dataRaw.error) {
          return reject(new Error(dataRaw.error));
        }

        const inventarioRaw = Array.isArray(dataRaw.inventario) ? dataRaw.inventario : [];
        const seenRowIds = new Set<string>();
        const normalizedInventario: InventarioItem[] = inventarioRaw.map((p: any, idx: number) => {
          const pvpDetalVal = redondearExacto(parseFloat(p.pvp_detal) || 0, 2);
          let rawRowId = p.rowid ? String(p.rowid).trim() : "";
          if (!rawRowId || seenRowIds.has(rawRowId)) {
            rawRowId = rawRowId ? `${rawRowId}_DUP_${idx}` : `ROW_${Date.now()}_${idx}`;
          }
          seenRowIds.add(rawRowId);

          return {
            nombre: String(p.nombre || "SIN NOMBRE").toUpperCase().trim(),
            base_pvp_detal: parseFloat(p.base_pvp_detal) || 0,
            pvp_detal: pvpDetalVal,
            categoria: String(p.categoria || "GOLOSINAS").toUpperCase().trim(),
            sku: p.sku ? String(p.sku).trim() : "S/N",
            base_costo: parseFloat(p.base_costo) || 0,
            costo_con_iva: parseFloat(p.costo_con_iva) || 0,
            costo_u_prot: parseFloat(p.costo_u_prot) || 0,
            stock: parseFloat(p.stock) || 0,
            stock_minimo: parseFloat(p.stock_minimo) || 0,
            unidad: parseFloat(p.unidad) || 1,
            presentacion: p.presentacion || "Unidad",
            iva_tipo: (p.iva_tipo !== undefined && p.iva_tipo !== null && p.iva_tipo !== "") ? p.iva_tipo.toString() : "16",
            pvp_mayor: parseFloat(p.pvp_mayor) ? redondearExacto(p.pvp_mayor, 2) : redondearExacto(pvpDetalVal * 0.95, 2),
            cat_detal: String(p.cat_detal).toUpperCase() === "TRUE" || p.cat_detal === true,
            cat_mayor: String(p.cat_mayor).toUpperCase() === "TRUE" || p.cat_mayor === true,
            rowid: rawRowId
          };
        });

        const comprasRaw = Array.isArray(dataRaw.compras) ? dataRaw.compras : [];
        const normalizedCompras: CompraItem[] = comprasRaw.map((c: any) => {
          return {
            id_registro: formatearIDCorrelativo(c.id_registro),
            empresa: String(c.empresa || "GOLOCHINAS 289, C.A.").trim(),
            libro: String(c.libro || "FISCAL").toUpperCase().trim() as any,
            documento: String(c.documento || "FACTURA").toUpperCase().trim() as any,
            nro_doc: String(c.nro_doc || "S/N").trim(),
            fecha_emision: c.fecha_emision || '',
            fecha_recepcion: c.fecha_recepcion || '',
            fecha_vencimiento: c.fecha_vencimiento || '',
            proveedor: String(c.proveedor || "PROVEEDOR DESCONOCIDO").toUpperCase().trim(),
            exento: parseFloat(c.exento) || 0,
            base_gravada: parseFloat(c.base_gravada) || 0,
            iva: parseFloat(c.iva) || 0,
            total: parseFloat(c.total) || 0,
            abonado_usd: parseFloat(c.abonado_usd) || 0,
            historial_abonos: Array.isArray(c.historial_abonos) ? c.historial_abonos : [],
            tasa_bcv: parseFloat(c.tasa_bcv) || 0,
            pagado_bs: parseFloat(c.pagado_bs) || 0,
            fecha_pago: c.fecha_pago || '',
            metodo_pago: c.metodo_pago || '',
            referencia: c.referencia || '',
          };
        });

        const proveedoresRaw = Array.isArray(dataRaw.proveedores) ? dataRaw.proveedores : [];
        const normalizedProveedores: Proveedor[] = proveedoresRaw.map((pr: any) => ({
          rif: String(pr.rif || "").toUpperCase().trim(),
          razon_social: String(pr.razon_social || "").toUpperCase().trim(),
          dias_credito_base: parseInt(pr.dias_credito_base, 10) || 0,
          metodo_habitual: String(pr.metodo_habitual || "TRANSFERENCIA").trim(),
          datos_cuenta: String(pr.datos_cuenta || "").trim(),
        }));

        const ventasRaw = Array.isArray(dataRaw.ventas) ? dataRaw.ventas : [];
        const normalizedVentas: VentaRegistro[] = ventasRaw.map((v: any) => ({
          id_venta: String(v.id_venta),
          fecha: v.fecha || '',
          cliente: v.cliente || 'CLIENTE GENERAL',
          tipo_precio: v.tipo_precio || 'MIXTO',
          condicion_pago: v.condicion_pago || 'CONTADO',
          metodo_pago: v.metodo_pago || 'SENIAT POS',
          items_json: typeof v.items_json === 'string' ? v.items_json : JSON.stringify(v.items_json || []),
          total_usd: parseFloat(v.total_usd) || 0,
          total_bs: parseFloat(v.total_bs) || 0,
          tasa_bcv: parseFloat(v.tasa_bcv) || 0,
          estado: v.estado || 'PROCESADA',
        }));

        // Persist locally for offline availability
        if (normalizedInventario.length > 0) StorageService.saveInventario(normalizedInventario);
        if (normalizedCompras.length > 0) StorageService.saveCompras(normalizedCompras);
        if (normalizedProveedores.length > 0) StorageService.saveProveedores(normalizedProveedores);
        if (normalizedVentas.length > 0) StorageService.saveVentas(normalizedVentas);

        resolve({
          inventario: normalizedInventario,
          compras: normalizedCompras,
          proveedores: normalizedProveedores,
          ventas: normalizedVentas,
        });
      };

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        delete (window as any)[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      };

      script.src = `${scriptUrl}?action=leer&callback=${callbackName}`;
      script.onerror = () => {
        cleanup();
        // Return local storage when network error occurs
        resolve({
          inventario: StorageService.getInventario(),
          compras: StorageService.getCompras(),
          proveedores: StorageService.getProveedores(),
          ventas: StorageService.getVentas(),
        });
      };

      // 10 second timeout fallback
      timeoutId = setTimeout(() => {
        cleanup();
        resolve({
          inventario: StorageService.getInventario(),
          compras: StorageService.getCompras(),
          proveedores: StorageService.getProveedores(),
          ventas: StorageService.getVentas(),
        });
      }, 10000);

      document.body.appendChild(script);
    });
  },

  /**
   * Execute an action either online or queue it for offline sync
   */
  async executeAction(
    actionName: OfflineAction['action'],
    description: string,
    payload: any
  ): Promise<{ success: boolean; queuedOffline: boolean; message: string }> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    const settings = StorageService.getSettings();

    // If offline, queue immediately
    if (!isOnline) {
      StorageService.addToOfflineQueue({
        action: actionName,
        description,
        payload,
      });
      return {
        success: true,
        queuedOffline: true,
        message: 'Guardado en modo offline. Se sincronizará automáticamente al conectar.',
      };
    }

    try {
      // Try sending online
      await fetch(settings.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionName,
          ...payload,
        }),
      });

      return {
        success: true,
        queuedOffline: false,
        message: 'Sincronizado con Google Sheets exitosamente.',
      };
    } catch (err: any) {
      console.warn("Error posting to cloud, queuing offline:", err);
      StorageService.addToOfflineQueue({
        action: actionName,
        description,
        payload,
        lastError: err?.message || 'Error de conexión',
      });
      return {
        success: true,
        queuedOffline: true,
        message: 'Conexión inestable. Se guardó localmente en la cola offline.',
      };
    }
  },

  /**
   * Process all pending items in offline queue
   */
  async syncOfflineQueue(onProgress?: (current: number, total: number) => void): Promise<{
    processed: number;
    failed: number;
  }> {
    const queue = StorageService.getOfflineQueue();
    if (queue.length === 0) return { processed: 0, failed: 0 };

    if (!navigator.onLine) {
      return { processed: 0, failed: queue.length };
    }

    const settings = StorageService.getSettings();
    let processed = 0;
    let failed = 0;
    const remainingQueue: OfflineAction[] = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (onProgress) onProgress(i + 1, queue.length);

      try {
        await fetch(settings.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: item.action,
            ...item.payload,
          }),
        });
        processed++;
      } catch (err: any) {
        console.error("Failed syncing offline action:", item, err);
        failed++;
        item.retryCount += 1;
        item.lastError = err?.message || 'Error de conexión';
        remainingQueue.push(item);
      }
    }

    StorageService.updateOfflineQueue(remainingQueue);

    // Refresh cloud data after syncing
    if (processed > 0) {
      setTimeout(() => {
        ApiService.fetchCloudData().catch(() => {});
      }, 1000);
    }

    return { processed, failed };
  },

  /**
   * Realiza una copia de seguridad completa de todo el objeto localStorage en una carpeta específica de Google Drive.
   * Utiliza la API oficial de Google Drive v3 con autenticación OAuth 2.0.
   */
  async realizarCopiaSeguridadDrive(nombreCarpeta: string = 'GOLOCHINAS_289_BACKUPS'): Promise<{
    success: boolean;
    fileId?: string;
    fileName?: string;
    webViewLink?: string;
    folderId?: string;
    folderName: string;
    timestamp: number;
    message: string;
  }> {
    const token = await getAccessToken();
    if (!token) {
      const err = new Error(
        'No se ha iniciado sesión con Google Drive. Por favor haz clic en "Conectar Google Drive" para autorizar el respaldo.'
      );
      const cfg = StorageService.getDriveBackupConfig();
      StorageService.saveDriveBackupConfig({
        ...cfg,
        ultimoRespaldo: {
          timestamp: Date.now(),
          fileId: '',
          fileName: '',
          status: 'ERROR',
          errorMsg: err.message,
        },
      });
      throw err;
    }

    try {
      // 1. Obtener o crear carpeta de destino en Google Drive
      const folderId = await GoogleDriveService.obtenerOCrearCarpetaDrive(nombreCarpeta, token);

      // 2. Extraer todo el objeto localStorage serializado
      const fullLocalStorage = StorageService.exportAllLocalStorage();
      const timestamp = Date.now();
      const fechaIso = new Date().toISOString();
      const fechaLegible = fechaIso.replace(/[:.]/g, '-');

      const payload = {
        _app: 'GOLOCHINAS 289 - Sistema POS & Inventario',
        _tipo: 'COPIA_SEGURIDAD_LOCALSTORAGE_COMPLETO',
        _fecha_iso: fechaIso,
        _timestamp: timestamp,
        _total_claves: Object.keys(fullLocalStorage).length,
        localStorageData: fullLocalStorage,
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const fileName = `backup_golochinas_pos_${fechaLegible}.json`;

      // 3. Subir el archivo JSON a Google Drive en la carpeta indicada
      const uploadedFile = await GoogleDriveService.subirArchivoDrive(
        fileName,
        folderId,
        jsonStr,
        token
      );

      // 4. Actualizar estado en el almacenamiento local
      const cfg = StorageService.getDriveBackupConfig();
      StorageService.saveDriveBackupConfig({
        ...cfg,
        carpeta: nombreCarpeta,
        ultimoRespaldo: {
          timestamp,
          fileId: uploadedFile.id,
          fileName: uploadedFile.name,
          folderId,
          size: uploadedFile.size,
          status: 'SUCCESS',
        },
      });

      return {
        success: true,
        fileId: uploadedFile.id,
        fileName: uploadedFile.name,
        webViewLink: uploadedFile.webViewLink,
        folderId,
        folderName: nombreCarpeta,
        timestamp,
        message: `Copia de seguridad guardada exitosamente en Google Drive en la carpeta "${nombreCarpeta}".`,
      };
    } catch (error: any) {
      console.error('Error realizando respaldo en Google Drive:', error);
      const cfg = StorageService.getDriveBackupConfig();
      StorageService.saveDriveBackupConfig({
        ...cfg,
        ultimoRespaldo: {
          timestamp: Date.now(),
          fileId: '',
          fileName: '',
          status: 'ERROR',
          errorMsg: error?.message || 'Error desconocido al subir a Drive',
        },
      });
      throw error;
    }
  },

  /**
   * Programa la ejecución automática y periódica de la copia de seguridad de localStorage en Google Drive.
   * @param intervaloMinutos Frecuencia en minutos (por defecto 60 min).
   * @param nombreCarpeta Nombre de la carpeta en Google Drive (por defecto 'GOLOCHINAS_289_BACKUPS').
   * @param ejecutarInmediato Si es true, ejecuta una copia de seguridad inmediatamente al programar.
   */
  iniciarRespaldoProgramadoDrive(
    intervaloMinutos: number = 60,
    nombreCarpeta: string = 'GOLOCHINAS_289_BACKUPS',
    ejecutarInmediato: boolean = true
  ): void {
    // Si ya existe un temporizador activo, cancelarlo
    if (driveBackupTimer) {
      clearInterval(driveBackupTimer);
      driveBackupTimer = null;
    }

    const min = Math.max(5, intervaloMinutos); // Mínimo 5 minutos para evitar saturación de cuota
    const intervaloMs = min * 60 * 1000;

    // Guardar configuración activa
    const cfg = StorageService.getDriveBackupConfig();
    StorageService.saveDriveBackupConfig({
      ...cfg,
      activo: true,
      intervaloMinutos: min,
      carpeta: nombreCarpeta,
    });

    // Ejecutar respaldo inmediato si fue solicitado
    if (ejecutarInmediato) {
      ApiService.realizarCopiaSeguridadDrive(nombreCarpeta).catch((err) => {
        console.warn('Primer respaldo automático en Drive postergado (esperando autenticación):', err?.message);
      });
    }

    // Configurar intervalo de ejecución cíclica
    driveBackupTimer = setInterval(() => {
      // Verificar si hay conexión y token
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('Dispositivo offline, se pospone el respaldo programado de Drive.');
        return;
      }

      ApiService.realizarCopiaSeguridadDrive(nombreCarpeta).catch((err) => {
        console.error('Fallo en respaldo programado de Google Drive:', err);
      });
    }, intervaloMs);
  },

  /**
   * Detiene el respaldo programado de Google Drive.
   */
  detenerRespaldoProgramadoDrive(): void {
    if (driveBackupTimer) {
      clearInterval(driveBackupTimer);
      driveBackupTimer = null;
    }

    const cfg = StorageService.getDriveBackupConfig();
    StorageService.saveDriveBackupConfig({
      ...cfg,
      activo: false,
    });
  },

  /**
   * Obtiene el estado actual del respaldo programado y último respaldo registrado.
   */
  obtenerEstadoRespaldoDrive(): {
    estaActivo: boolean;
    intervaloMinutos: number;
    carpeta: string;
    ultimoRespaldo?: any;
  } {
    const cfg = StorageService.getDriveBackupConfig();
    return {
      estaActivo: Boolean(driveBackupTimer) || cfg.activo,
      intervaloMinutos: cfg.intervaloMinutos || 60,
      carpeta: cfg.carpeta || 'GOLOCHINAS_289_BACKUPS',
      ultimoRespaldo: cfg.ultimoRespaldo,
    };
  },

  /**
   * Lista los respaldos existentes en la carpeta de Google Drive.
   */
  async listarRespaldosDrive(nombreCarpeta: string = 'GOLOCHINAS_289_BACKUPS'): Promise<DriveFileItem[]> {
    const token = await getAccessToken();
    if (!token) return [];

    try {
      const folderId = await GoogleDriveService.obtenerOCrearCarpetaDrive(nombreCarpeta, token);
      return await GoogleDriveService.listarRespaldosEnCarpeta(folderId, token);
    } catch (e) {
      console.error('Error listando respaldos en Drive:', e);
      return [];
    }
  },

  /**
   * Descarga y restaura el objeto localStorage desde un archivo de respaldo en Google Drive.
   */
  async restaurarCopiaSeguridadDrive(fileId: string): Promise<boolean> {
    const token = await getAccessToken();
    if (!token) throw new Error('No hay sesión de Google activa');

    const rawJson = await GoogleDriveService.descargarContenidoArchivo(fileId, token);
    const parsed = JSON.parse(rawJson);
    return StorageService.restoreAllLocalStorage(parsed);
  }
};
