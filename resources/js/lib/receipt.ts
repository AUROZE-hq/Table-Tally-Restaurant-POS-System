import { isCashPayment, kickCashDrawerForOrder } from './cashDrawer';

const RESTAURANT = {
    name: 'Vaavikkarai Restaurant',
    address: '34/4, Kannakai amman Road, Poombukar, Batticaloa',
    phone: '071 696 9949',
    website: 'www.aaniver.lk',
    logo: '/images/vaavikkarai-receipt-logo.jpg',
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
  img.logo { width: 64mm; max-width: 100%; height: auto; object-fit: contain; }
  h1 { margin: 1mm 0 0; font-size: 17px; letter-spacing: 0.04em; }
  .muted { margin: 0.5mm 0; font-size: 11px; }
  .contact { margin: 1mm 0; font-size: 14px; line-height: 1.35; font-weight: 600; }
  .rule { border: 0; border-top: 1px dashed #222; margin: 2.5mm 0; }
  .row { display: flex; justify-content: space-between; gap: 3mm; padding: 1mm 0; font-size: 12px; }
  .row span:first-child { flex: 1; }
  .total { font-size: 14px; font-weight: 700; border-top: 1px solid #111; margin-top: 1mm; padding-top: 1.5mm; }
  .message { margin-top: 4mm; font-size: 13px; font-weight: 700; }
  .credit { margin: 5mm 0 0; font-size: 9px; letter-spacing: 0.06em; color: #555; }
</style>
</head>
<body>
  <div class="center">
    <img class="logo" src="${logo}" alt="Vaavikkarai" />
    <h1>${escapeHtml(RESTAURANT.name)}</h1>
    <p class="contact">${escapeHtml(RESTAURANT.address)}</p>
    <p class="contact">${escapeHtml(RESTAURANT.phone)}</p>
    <p class="contact">${escapeHtml(RESTAURANT.website)}</p>
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
  <p class="center credit">© Developed by Auroze.com</p>
</body>
</html>`;
}

/** @deprecated No visible preview window; kept so existing call sites stay valid. */
export function prepareReceiptWindow(): Window | null {
    return null;
}

function whenPrinted(target: Window, start: () => void): Promise<void> {
    return new Promise(resolve => {
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            resolve();
        };
        target.onafterprint = finish;
        start();
        window.setTimeout(finish, 2500);
    });
}

function waitForReceiptAssets(win: Window): Promise<void> {
    return new Promise(resolve => {
        const logo = win.document.querySelector('img.logo');
        if (!(logo instanceof HTMLImageElement) || logo.complete) {
            window.requestAnimationFrame(() => resolve());
            return;
        }
        const done = () => resolve();
        logo.addEventListener('load', done, { once: true });
        logo.addEventListener('error', done, { once: true });
        window.setTimeout(done, 600);
    });
}

function printInHiddenFrame(html: string): Promise<void> {
    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'Bill');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;left:-9999px;top:0;border:0;opacity:0;pointer-events:none;';

    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) {
        frame.remove();
        return Promise.resolve();
    }

    doc.open();
    doc.write(html);
    doc.close();

    return waitForReceiptAssets(win)
        .then(() => whenPrinted(win, () => {
            win.focus();
            win.print();
        }))
        .finally(() => {
            window.setTimeout(() => frame.remove(), 300);
        });
}

export async function openReceipt(order: any, _existing?: Window | null): Promise<void> {
    const cash = isCashPayment(order);
    if (cash) {
        await kickCashDrawerForOrder(order);
    }

    const html = receiptMarkup(order);
    await printInHiddenFrame(html);

    if (cash) {
        await kickCashDrawerForOrder(order);
    }
}