import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Invoice } from '../services/workflowService';
import { formatDate, formatVnd } from './format';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export async function exportInvoice(invoice: Invoice) {
  const rows = [['Hóa đơn', invoice.invoiceNumber], ['Hội viên', invoice.memberName || '—'], ['Gói tập', invoice.planName || '—'],
    ['Ngày phát hành', formatDate(invoice.issuedAt)], ['Tạm tính', formatVnd(invoice.subtotal)], ['Giảm giá', formatVnd(invoice.discount)], ['Tổng thanh toán', formatVnd(invoice.total)]];
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:32px;color:#131a26}td{padding:12px;border-bottom:1px solid #ddd}h1{font-size:24px}table{width:100%}</style></head><body><p>PULSE SPORTS CENTER</p><h1>HÓA ĐƠN THANH TOÁN</h1><table>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table></body></html>`;
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle: 'Hóa đơn thanh toán' });
  else await Print.printAsync({ uri });
}
