export function redondearExacto(valor: number | string | null | undefined, decimales = 2): number {
  if (valor === null || valor === undefined || isNaN(Number(valor))) return 0;
  return Number(Math.round(Number(valor + 'e' + decimales)) + 'e-' + decimales);
}

export function formatearVE(valor: number | string | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined || isNaN(Number(valor))) return '0,00';
  const valFloat = Number(valor);
  const n = valFloat.toFixed(decimales);
  const partes = n.split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return partes.join(',');
}

export function formatearFechaDDMMYYYY(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const dd = String(val.getDate()).padStart(2, '0');
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const yyyy = val.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  const str = String(val).trim();
  if (!str || str === '---' || str === 'HISTÓRICO') return str;

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const partes = str.split('T')[0].split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return str;
}

export function convertirDDMMYYYYToYYYYMMDD(fechaDDMM: string): string {
  if (!fechaDDMM || !fechaDDMM.includes('/')) return '1970-01-01';
  const partes = fechaDDMM.split('/');
  if (partes.length === 3) {
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }
  return '1970-01-01';
}

export function formatearIDCorrelativo(val: any): string {
  if (val === null || val === undefined || val === '') return '00';
  const num = parseInt(val, 10);
  if (isNaN(num)) return String(val).trim();
  return num < 10 ? '0' + num : String(num);
}
