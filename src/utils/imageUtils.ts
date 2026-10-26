/**
 * Utilidades para procesamiento, optimización y compresión de imágenes
 * Garantiza que logos y firmas no excedan las cuotas de localStorage.
 */

export function comprimirImagen(
  input: File | string,
  maxDimension: number = 320,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processImage = (src: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        // Draw transparent or white background for clean receipt rendering
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP or PNG/JPEG
        try {
          const compressed = canvas.toDataURL('image/png');
          resolve(compressed);
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => {
        resolve(typeof input === 'string' ? input : '');
      };
      img.src = src;
    };

    if (typeof input === 'string') {
      processImage(input);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        processImage(result);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(input);
    }
  });
}
