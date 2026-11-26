const RESTAURANT = {
    name: 'Aaniver Restaurant',
    address: '34/4, Kannakai amman Road, Poombukar, Batticaloa',
    phone: '071 696 9949',
    website: 'www.aaniver.lk',
    logo: '/images/vavikarai-logo.png',
};

if (typeof window !== 'undefined') {
    const preload = new Image();
    preload.src = RESTAURANT.logo;
}

function money(value: number) {
    return `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function purchasedAt(order: { created_at?: string }) {
    const date = order.created_at ? new Date(order.created_at) : new Date();
    if (Number.isNaN(date.getTime())) {
        return new Date().toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' });
    }
    return date.toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' });
}

function receiptMarkup(order: any) {
    const items = (order.items ?? [])
        .map((item: any) => {
            const name = item.product?.name ?? item.product_name ?? 'Item';
            return `<div class="row"><span>${escapeHtml(item.quantity)} x ${escapeHtml(name)}</span><span>${money(Number(item.line_total))}</span></div>`;
        })
        .join('');

    const logo = `${window.location.origin}${RESTAURANT.logo}`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(order.order_number ?? 'Bill')}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  html, body { width: 80mm; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; padding: 2mm; }
  .center { text-align: center; }
  img { width: 28mm; height: 28mm; object-fit: contain; }
  h1 { margin: 1mm 0 0; font-size: 15px; letter-spacing: 0.04em; }
  .muted { margin: 0.5mm 0; font-size: 11px; }
  .rule { border: 0; border-top: 1px dashed #222; margin: 2.5mm 0; }
  .row { display: flex; justify-content: space-between; gap: 3mm; padding: 1mm 0; font-size: 12px; }
  .row span:first-child { flex: 1; }
  .total { font-size: 14px; font-weight: 700; border-top: 1px solid #111; margin-top: 1mm; padding-top: 1.5mm; }
  .message { margin-top: 4mm; font-size: 13px; font-weight: 700; }
</style>
</head>
<body>
  <div class="center">
    <img src="${logo}" alt="Aaniver" />
    <h1>${escapeHtml(RESTAURANT.name)}</h1>
    <p class="muted">${escapeHtml(RESTAURANT.address)}</p>
    <p class="muted">${escapeHtml(RESTAURANT.phone)}</p>
    <p class="muted">${escapeHtml(RESTAURANT.website)}</p>
  </div>
  <hr class="rule" />
  <p class="center muted">${escapeHtml(purchasedAt(order))}</p>
  <hr class="rule" />
  ${items || '<p class="center muted">No items</p>'}
  <hr class="rule" />
  <div class="row"><span>Pay total</span><span>${money(Number(order.subtotal ?? 0))}</span></div>
  <div class="row"><span>Discount</span><span>${money(Number(order.discount ?? 0))}</span></div>
  <div class="row total"><span>Total bill</span><span>${money(Number(order.total ?? 0))}</span></div>
  <p class="center message">Come again and eat well</p>
</body>
</html>`;
}

export function prepareReceiptWindow(): Window | null {
    const popup = window.open('', 'aaniver-bill', 'width=360,height=720');
    if (!popup) {
        return null;
    }
    popup.document.open();
    popup.document.write('<!DOCTYPE html><title>Bill</title><p style="font-family:Arial,sans-serif;padding:24px">Preparing bill…</p>');
    popup.document.close();
    popup.focus();
    return popup;
}

function writeAndPrint(target: Window, html: string) {
    target.document.open();
    target.document.write(html);
    target.document.close();
    const printNow = () => {
        if (target.closed) {
            return;
        }
        target.focus();
        target.print();
    };
    if (typeof target.requestAnimationFrame === 'function') {
        target.requestAnimationFrame(printNow);
        return;
    }
    printNow();
}

export function openReceipt(order: any, existing?: Window | null) {
    const html = receiptMarkup(order);
    const popup = existing && !existing.closed
        ? existing
        : window.open('', 'aaniver-bill', 'width=360,height=720');

    if (popup) {
        writeAndPrint(popup, html);
        return;
    }

    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'Bill');
    frame.style.cssText = 'position:fixed;left:0;top:0;width:80mm;height:100vh;border:0;background:#fff;z-index:80;';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) {
        frame.remove();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    win.onafterprint = () => frame.remove();
    win.focus();
    win.print();
}
