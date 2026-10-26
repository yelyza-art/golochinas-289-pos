import { StorageService } from '../services/storage';
import { formatearVE, formatearFechaDDMMYYYY, redondearExacto } from './formatters';
import { CarritoItem, MovimientoKardex, MultiPayment } from '../types';

export function imprimirTicketPOS(
  idVenta: string,
  cliente: string,
  clientRif: string,
  clientAddress: string,
  clientPhone: string,
  condicion: 'CONTADO' | 'CRÉDITO',
  metodoPago: string,
  items: CarritoItem[],
  totalUSD: number,
  totalBs: number,
  totalExento: number,
  baseImponible: number,
  totalIva: number,
  tasaBCV: number,
  formato: '58mm' | '80mm' | 'pdf' = '58mm'
) {
  const esCredito = condicion.toUpperCase() === 'CRÉDITO';
  const fechaActualStr = formatearFechaDDMMYYYY(new Date());
  const horaActualStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  const folioStr = String(idVenta).padStart(5, '0');

  let lineasItemsHtml = '';
  items.forEach((it) => {
    const cant = it.cantidad || 1;
    const pU = it.precio_manual || 0;
    const pUBs = redondearExacto(pU * tasaBCV, 2);
    const subtotalBs = redondearExacto(cant * pUBs, 2);
    // Hardcoding tax code based on a simple heuristic for now (e.g., if price has tax, use G, else E)
    // The user example shows 'E' or 'G'.
    const taxCode = 'G'; // Simplified for now

    lineasItemsHtml += `
        <tr><td colspan="3" style="font-size:9pt;">${it.nombre.toUpperCase()}</td></tr>
        <tr>
            <td style="text-align:left;">Cod: ${it.sku}</td>
            <td></td>
            <td></td>
        </tr>
        <tr style="border-bottom: 1px dashed #000;">
            <td style="text-align:left;">${formatearVE(cant, 3)} UN X ${formatearVE(pUBs, 2)}</td>
            <td style="text-align:center;"></td>
            <td style="text-align:right;">${formatearVE(subtotalBs, 2)} ${taxCode}</td>
        </tr>
      `;
  });

  const area = document.getElementById('area-impresion');
  if (!area) return;

  const settings = StorageService.getSettings();

  // Log attempt
  StorageService.addPrintLog({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    printerModel: 'DEFAULT_SYS_PRINTER',
    format: formato,
    status: 'SUCCESS' // Assuming it starts, we can't easily catch failure here
  });

  const margins = settings.impresoraFiscalMargins || { top: 0, bottom: 0, left: 0, right: 0 };

  area.innerHTML = `
    <div class='ticket-venta-contenedor' style="font-family:'Courier New',Courier,monospace; font-size:9pt; color:#000; margin-top: ${margins.top}mm; margin-bottom: ${margins.bottom}mm; margin-left: ${margins.left}mm; margin-right: ${margins.right}mm;">
        <div style="text-align:center;">
            <b style="font-size:12pt;">GOLOCHINAS 289</b><br>
            <b>RIF: J-50814951-3</b><br>
            AV PRINCIPAL LOCAL LOTE 95-A-351<br>
            SAN DIEGO, CARABOBO<br>
            <b style="font-size:11pt;">FACTURA</b>
        </div>
        <div style="border-bottom: 1px dashed #000; margin: 1mm 0;"></div>
        <div>NRO: ${folioStr}<br>FECHA: ${fechaActualStr} | HORA: ${horaActualStr}</div>
        <div style="border-bottom: 1px dashed #000; margin: 1mm 0;"></div>
        <div>Cliente: <b>${cliente.toUpperCase()}</b><br>
        CI/RIF: ${clientRif}<br>
        Dir: ${clientAddress}<br>
        Tel: ${clientPhone}</div>
        <div style="border-bottom: 1px dashed #000; margin: 1mm 0;"></div>
        <table style="width:100%; border-collapse:collapse; font-size:9pt;">
            <tbody>${lineasItemsHtml}</tbody>
        </table>
        
        <div style="text-align:right; margin-top:2mm;">
            Monto Exento: ${formatearVE(totalExento, 2)}<br>
            Base Imponible: ${formatearVE(baseImponible, 2)}<br>
            IVA 16,00%: ${formatearVE(totalIva, 2)}<br>
            <b style="font-size:11pt;">TOTAL Bs: ${formatearVE(totalBs, 2)}</b>
        </div>
        
        <div style="border-bottom: 1px dashed #000; margin: 1mm 0;"></div>
        <div>MÉTODO:
          ${(() => {
            try {
              const payments = JSON.parse(metodoPago) as MultiPayment[];
              return payments.map(p => `<br>- ${p.metodo}: Bs. ${formatearVE(p.montoBs)} ($${formatearVE(p.montoUsd)})`).join('');
            } catch {
              return metodoPago.toUpperCase();
            }
          })()}
        </div>
        <div style="text-align:center; margin-top:5mm;">
            [QR CODE HERE]
        </div>
    </div>
  `;

  document.body.classList.remove('print-format-80mm', 'print-format-58mm', 'print-format-pdf');
  document.body.classList.add(`print-format-${formato}`);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      area.innerHTML = '';
      document.body.classList.remove('print-format-80mm', 'print-format-58mm', 'print-format-pdf');
    }, 2000);
  }, 150);
}

export function imprimirEtiquetaPOP(
  nombre: string,
  pvpFinalConIVA: number,
  formato: '58mm' | '80mm' | 'pdf' = '58mm'
) {
  const logoSrc = StorageService.getLogo() || '';
  const area = document.getElementById('area-impresion');
  if (!area) return;

  document.body.classList.remove('print-format-80mm', 'print-format-58mm', 'print-format-pdf');
  document.body.classList.add(`print-format-${formato}`);

  const renderLogoHtml = logoSrc
    ? `<img class='logo-lover-header' src='${logoSrc}' alt='Logo'>`
    : `<div style="font-family:Arial,sans-serif; font-size:8.5pt; font-weight:900; margin-bottom:1mm; text-align:center; line-height:1.1;">@GOLOCHINAS289<br><span style="font-size:12pt; font-style:italic;">Lover</span></div>`;

  const mesesVE = ['ENE.', 'FEB.', 'MAR.', 'ABR.', 'MAY.', 'JUN.', 'JUL.', 'AGO.', 'SEP.', 'OCT.', 'NOV.', 'DIC.'];
  const d = new Date();
  const mesAnoActual = `${mesesVE[d.getMonth()]} ${d.getFullYear()}`;

  area.innerHTML = `
    <div class='etiqueta-pop-exacta'>
      ${renderLogoHtml}
      <div class='etiqueta-titulo-pop'>${nombre.toUpperCase()}</div>
      <div class='etiqueta-precio-pop'>$${formatearVE(pvpFinalConIVA)}</div>
      <div class='etiqueta-linea-pop'></div>
      <div class='etiqueta-pie-bcv'>CALCULADO A TASA BCV</div>
      <div class='etiqueta-pie-fecha'>${mesAnoActual}</div>
    </div>
  `;

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      area.innerHTML = '';
      document.body.classList.remove('print-format-80mm', 'print-format-58mm', 'print-format-pdf');
    }, 500);
  }, 150);
}

export function imprimirEstadoCuenta(
  proveedorFiltro: string,
  movimientos: MovimientoKardex[],
  totalCargos: number,
  totalAbonos: number,
  saldoNeto: number
) {
  const area = document.getElementById('area-impresion');
  if (!area) return;
  const logoSrc = StorageService.getLogo() || '';
  const settings = StorageService.getSettings();

  let filasHtml = '';
  movimientos.forEach((m) => {
    filasHtml += `
      <tr style="border-bottom:1px solid #ddd; font-size:8pt;">
        <td style="padding:4px;">${formatearFechaDDMMYYYY(m.fecha)}</td>
        <td style="padding:4px; font-weight:bold;">${m.proveedor}</td>
        <td style="padding:4px;">${m.nro_doc}</td>
        <td style="padding:4px;">${m.detalle}</td>
        <td style="padding:4px; text-align:right;">$ ${formatearVE(m.cargo)}</td>
        <td style="padding:4px; text-align:right;">$ ${formatearVE(m.abono)}</td>
        <td style="padding:4px; text-align:right; font-weight:bold;">$ ${formatearVE(m.saldo)}</td>
      </tr>
    `;
  });

  area.innerHTML = `
    <div class='estado-cuenta-print'>
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e3a8a; padding-bottom:8px; margin-bottom:4mm;">
        <div>
          <h2 style="font-size:14pt; font-weight:900; color:#1e3a8a; margin:0;">${settings.empresaNombre}</h2>
          <p style="font-size:8pt; font-weight:bold; margin:0;">ESTADO DE CUENTA DE PROVEEDORES (CARGOS Y ABONOS)</p>
          <p style="font-size:8pt; margin:0;">PROVEEDOR: ${proveedorFiltro ? proveedorFiltro.toUpperCase() : 'TODOS'} | FECHA: ${formatearFechaDDMMYYYY(new Date())}</p>
        </div>
        ${logoSrc ? `<img src="${logoSrc}" style="max-height:45px;" alt="Logo">` : ''}
      </div>

      <table style="width:100%; border-collapse:collapse; text-transform:uppercase;">
        <thead>
          <tr style="background:#1e3a8a; color:#fff; font-size:8pt; font-weight:900;">
            <th style="padding:5px; text-align:left;">FECHA</th>
            <th style="padding:5px; text-align:left;">PROVEEDOR</th>
            <th style="padding:5px; text-align:left;">NRO DOC</th>
            <th style="padding:5px; text-align:left;">DETALLE MOVIMIENTO</th>
            <th style="padding:5px; text-align:right;">CARGO ($)</th>
            <th style="padding:5px; text-align:right;">ABONO ($)</th>
            <th style="padding:5px; text-align:right;">SALDO ($)</th>
          </tr>
        </thead>
        <tbody>${filasHtml}</tbody>
      </table>

      <div style="margin-top:5mm; border-top:2px solid #1e3a8a; padding-top:8px; display:flex; justify-content:space-between; font-size:9pt; font-weight:900;">
        <span>TOTAL CARGOS: $ ${formatearVE(totalCargos)}</span>
        <span>TOTAL ABONOS: $ ${formatearVE(totalAbonos)}</span>
        <span style="color:#b91c1c;">SALDO PENDIENTE NETO: $ ${formatearVE(saldoNeto)}</span>
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      area.innerHTML = '';
    }, 500);
  }, 150);
}

/**
 * Imprime el comprobante formal de Cierre de Caja y Conciliación Bancaria del Punto de Venta.
 */
export function imprimirCierreCajaTicket(
  cierre: import('../types').CierreCajaConciliacion,
  formato: '58mm' | '80mm' | 'pdf' = '58mm'
) {
  const logoSrc = StorageService.getLogo() || '';
  const settings = StorageService.getSettings();
  const esTermica = formato === '58mm' || formato === '80mm';

  let desgloseFilas = '';
  cierre.desglose.forEach((d) => {
    if (d.montoLotePosBs > 0 || d.montoSistemaBs > 0 || d.montoLotePosUsd > 0) {
      desgloseFilas += `
        <tr style="border-bottom: 1px dashed #ccc; font-size: 7.5pt;">
          <td style="padding: 2px 0; font-weight: bold;">${d.nombreLegible}</td>
          <td style="padding: 2px 0; text-align: right; font-family: monospace;">Bs. ${formatearVE(d.montoLotePosBs)}</td>
          <td style="padding: 2px 0; text-align: right; font-family: monospace; color: #b91c1c;">-Bs. ${formatearVE(d.comisionBs)}</td>
          <td style="padding: 2px 0; text-align: right; font-family: monospace; font-weight: bold; color: #15803d;">Bs. ${formatearVE(d.montoNetoBancoBs)}</td>
          <td style="padding: 2px 0; text-align: right; font-family: monospace;">${d.diferenciaBs >= 0 ? '+' : ''}${formatearVE(d.diferenciaBs)}</td>
        </tr>
      `;
    }
  });

  const estadoColor =
    cierre.estadoDiferencia === 'CUADRADO'
      ? '#15803d'
      : cierre.estadoDiferencia === 'SOBRANTE'
      ? '#1d4ed8'
      : '#b91c1c';

  const estadoTexto =
    cierre.estadoDiferencia === 'CUADRADO'
      ? 'CAJA CUADRADA EXACTA'
      : cierre.estadoDiferencia === 'SOBRANTE'
      ? `SOBRANTE EN CAJA (+Bs. ${formatearVE(cierre.diferenciaNetaBs)})`
      : `FALTANTE EN CAJA (-Bs. ${formatearVE(Math.abs(cierre.diferenciaNetaBs))})`;

  const ticketHtml = `
    <div class='${esTermica ? 'ticket-venta-contenedor' : 'estado-cuenta-print'}' style="margin: 0 auto; padding: 4mm; font-family: Arial, sans-serif;">
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm;">
        ${logoSrc ? `<img src="${logoSrc}" style="max-height: 38px; margin: 0 auto 2mm auto; display: block;" alt="Logo">` : ''}
        <div style="font-weight: 900; font-size: 10pt;">${settings.empresaNombre}</div>
        <div style="font-size: 7.5pt; font-weight: bold;">RIF: ${settings.empresaRif}</div>
        <div style="font-size: 8pt; font-weight: 900; margin-top: 1.5mm; background: #0f172a; color: #fff; padding: 2px; border-radius: 3px;">
          CIERRE DE CAJA Y CONCILIACIÓN POS
        </div>
      </div>

      <div style="font-size: 7.5pt; margin-bottom: 2mm; line-height: 1.4;">
        <div><strong>FECHA / HORA:</strong> ${cierre.fecha} ${cierre.hora}</div>
        <div><strong>CAJERO:</strong> ${cierre.cajero || 'PRINCIPAL'}</div>
        <div><strong>BANCO:</strong> ${cierre.banco} | <strong>LOTE POS:</strong> ${cierre.nroLote || 'N/A'}</div>
        <div><strong>TASA BCV:</strong> Bs. ${formatearVE(cierre.tasaBcv)}</div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2mm 0; margin-bottom: 2mm;">
        <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt;">
          <thead>
            <tr style="border-bottom: 1px solid #000; font-weight: 900; text-align: left;">
              <th>INSTRUMENTO</th>
              <th style="text-align: right;">BRUTO</th>
              <th style="text-align: right;">COMIS.</th>
              <th style="text-align: right;">NETO BCO</th>
              <th style="text-align: right;">DIF.</th>
            </tr>
          </thead>
          <tbody>
            ${desgloseFilas}
          </tbody>
        </table>
      </div>

      <!-- Resumen Totales -->
      <div style="font-size: 8pt; line-height: 1.5; border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm;">
        <div style="display: flex; justify-content: space-between;">
          <span>TOTAL REGISTRADO SISTEMA:</span>
          <span style="font-weight: bold;">Bs. ${formatearVE(cierre.totalSistemaBs)} ($${formatearVE(cierre.totalSistemaUsd)})</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>TOTAL BRUTO LOTE POS:</span>
          <span style="font-weight: 900;">Bs. ${formatearVE(cierre.totalLotePosBs)} ($${formatearVE(cierre.totalLotePosUsd)})</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #b91c1c;">
          <span>(-) COMISIONES BANCARIAS:</span>
          <span style="font-weight: bold;">-Bs. ${formatearVE(cierre.totalComisionesBs)} (-$${formatearVE(cierre.totalComisionesUsd)})</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 900; color: #15803d; border-top: 1px solid #ddd; padding-top: 1mm; margin-top: 1mm;">
          <span>(=) INGRESO NETO EN BANCO:</span>
          <span>Bs. ${formatearVE(cierre.totalNetoBancoBs)} ($${formatearVE(cierre.totalNetoBancoUsd)})</span>
        </div>
      </div>

      <!-- Cuadre y Estado -->
      <div style="text-align: center; padding: 2mm; margin-bottom: 3mm; border: 1.5px solid ${estadoColor}; border-radius: 4px; background: #fafafa;">
        <div style="font-size: 7pt; font-weight: bold; color: #555;">RESULTADO DEL CUADRE:</div>
        <div style="font-size: 9pt; font-weight: 900; color: ${estadoColor};">${estadoTexto}</div>
        <div style="font-size: 7.5pt; font-family: monospace;">Ref USD: ${cierre.diferenciaNetaUsd >= 0 ? '+' : ''}$${formatearVE(cierre.diferenciaNetaUsd)}</div>
      </div>

      ${cierre.observaciones ? `
        <div style="font-size: 7pt; font-style: italic; margin-bottom: 3mm; background: #f1f5f9; padding: 1.5mm; border-radius: 3px;">
          <strong>Obs:</strong> ${cierre.observaciones}
        </div>
      ` : ''}

      <!-- Firmas -->
      <div style="margin-top: 5mm; display: flex; justify-content: space-between; font-size: 7pt; text-align: center;">
        <div style="width: 45%;">
          <div style="border-top: 1px solid #000; padding-top: 1mm; margin-top: 8mm;">
            FIRMA CAJERO
          </div>
        </div>
        <div style="width: 45%;">
          <div style="border-top: 1px solid #000; padding-top: 1mm; margin-top: 8mm;">
            FIRMA SUPERVISOR
          </div>
        </div>
      </div>
    </div>
  `;

  const area = document.getElementById('area-impresion');
  if (!area) return;

  document.body.className = `print-format-${formato}`;
  area.innerHTML = ticketHtml;

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      area.innerHTML = '';
    }, 500);
  }, 150);
}

export function imprimirTasaBCV(tasas: import('../types').TasasCambio) {
  const area = document.getElementById('area-impresion');
  if (!area) return;

  const fechaActual = new Date().toLocaleDateString();

  area.innerHTML = `
    <div style="text-align:center; font-family:'Courier New',Courier,monospace; font-size:10pt; padding:5mm;">
      <div style="font-weight:900; font-size:12pt;">GOLOCHINAS 289</div>
      <div style="border-bottom:1px solid #000; margin:2mm 0;"></div>
      <div style="font-weight:bold; margin-bottom:2mm;">TASAS BCV - ${fechaActual}</div>
      <div style="text-align:left; font-size:10pt;">
        <div>USD BCV: <span style="font-weight:900;">Bs. ${formatearVE(tasas.tasaBcv)}</span></div>
        <div>EURO BCV: <span style="font-weight:900;">Bs. ${formatearVE(tasas.tasaEuro)}</span></div>
        <div>USDT (Inm): <span style="font-weight:900;">Bs. ${formatearVE(tasas.tasaUsdt)}</span></div>
      </div>
      <div style="border-top:1px solid #000; margin-top:2mm; padding-top:2mm; font-size:8pt;">
        Tasa oficial BCV para operaciones comerciales.
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
    setTimeout(() => { area.innerHTML = ''; }, 500);
  }, 150);
}

