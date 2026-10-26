import { getAccessToken } from './googleDriveAuth';

export interface DriveFileItem {
  id: string;
  name: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
}

export const GoogleDriveService = {
  /**
   * Finds an existing folder by name or creates it in the user's root Drive.
   */
  async obtenerOCrearCarpetaDrive(nombreCarpeta: string, token: string): Promise<string> {
    // 1. Search for existing folder
    const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${nombreCarpeta.replace(/'/g, "\\'")}' and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Error buscando carpeta en Drive (HTTP ${searchRes.status})`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // 2. If folder does not exist, create it
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: nombreCarpeta,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Error creando carpeta en Drive (HTTP ${createRes.status})`);
    }

    const createdFolder = await createRes.json();
    return createdFolder.id;
  },

  /**
   * Uploads a JSON backup file to a specific folder in Google Drive using multipart upload.
   */
  async subirArchivoDrive(
    nombreArchivo: string,
    folderId: string,
    contenidoJson: string,
    token: string
  ): Promise<DriveFileItem> {
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: nombreArchivo,
      mimeType: 'application/json',
      parents: [folderId],
      description: 'Copia de seguridad completa del almacenamiento LocalStorage de Golochinas 289 POS',
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      contenidoJson +
      closeDelimiter;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Error subiendo archivo de respaldo a Drive (HTTP ${res.status})`);
    }

    return await res.json();
  },

  /**
   * Lists existing backup files inside the specific Google Drive folder.
   */
  async listarRespaldosEnCarpeta(folderId: string, token: string): Promise<DriveFileItem[]> {
    const q = `'${folderId}' in parents and trashed = false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        q
      )}&orderBy=createdTime desc&fields=files(id,name,size,createdTime,webViewLink)`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.files || [];
  },

  /**
   * Downloads backup file content from Google Drive
   */
  async descargarContenidoArchivo(fileId: string, token: string): Promise<string> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error descargando archivo de respaldo de Google Drive (HTTP ${res.status})`);
    }

    return await res.text();
  },
};
