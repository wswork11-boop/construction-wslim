import { Injectable } from '@nestjs/common';

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMinimalPdfBuffer(title: string, htmlContent: string): Buffer {
  const cleanText = htmlContent
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)
    .replace(/[()\\]/g, '');

  const streamContent = `BT /F1 10 Tf 36 750 Td (${title.replace(/[()\\]/g, '')}) Tj 0 -16 Td (${cleanText}) Tj ET`;
  const pdf = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(streamContent, 'utf8')} >> stream\n${streamContent}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `% HTML_SNAPSHOT: ${Buffer.from(htmlContent, 'utf8').toString('base64')}`,
    'xref',
    '0 6',
    '0000000000 65535 f ',
    'trailer << /Size 6 /Root 1 0 R >>',
    'startxref',
    '0',
    '%%EOF',
  ].join('\n');

  return Buffer.from(pdf, 'utf8');
}

@Injectable()
export class PdfService {
  renderQuotationHtml(data: {
    company: any;
    client: any;
    project?: any;
    quotation: any;
    watermark?: string;
  }): string {
    const { company, client, project, quotation, watermark } = data;
    const revLabel = escapeHtml(
      quotation.displayNumber ||
        (quotation.revisionNo > 0
          ? `${quotation.number}-R${quotation.revisionNo}`
          : `${quotation.number}-R0`),
    );

    const sectionRows = (quotation.sections || [])
      .map((sec: any, sIdx: number) => {
        const secLetter = String.fromCharCode(65 + (sIdx % 26));
        const itemsHtml = (sec.items || [])
          .map(
            (item: any, iIdx: number) => `
          <tr>
            <td>${secLetter}${iIdx + 1}</td>
            <td>${escapeHtml(item.description)}</td>
            <td>${escapeHtml(item.unit || '')}</td>
            <td class="num">${escapeHtml(item.quantity)}</td>
            <td class="num">${escapeHtml(item.rate)}</td>
            <td class="num">${escapeHtml(item.amount)}</td>
          </tr>`,
          )
          .join('');
        return `
          <tr class="sec">
            <td>${secLetter}</td>
            <td colspan="4">${escapeHtml(sec.title)}</td>
            <td class="num">${escapeHtml(sec.subtotal || '')}</td>
          </tr>
          ${itemsHtml}
        `;
      })
      .join('');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Quotation ${revLabel}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font: 10.5pt/1.4 "Segoe UI", Arial, sans-serif; color: #1a1f2b; margin: 0; }
  .page { padding: 14mm; position: relative; }
  .watermark { position: fixed; top: 45%; left: 20%; font-size: 72pt; color: rgba(200,0,0,0.12); transform: rotate(-30deg); pointer-events: none; font-weight: 700; }
  .head { display: flex; justify-content: space-between; border-bottom: 2px solid #1f5fbf; padding-bottom: 5mm; }
  .meta { display: flex; justify-content: space-between; margin: 6mm 0; }
  table.items { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  table.items th { background: #1f5fbf; color: #fff; text-align: left; padding: 2mm; }
  table.items td { padding: 1.8mm 2mm; border-bottom: .2mm solid #dfe3ea; }
  table.items tr.sec td { background: #eef1f6; font-weight: 600; }
  .num { text-align: right; }
  .sum { margin-left: auto; width: 82mm; margin-top: 4mm; border-collapse: collapse; }
  .sum tr.grand td { font-weight: 700; font-size: 12pt; border-top: .5mm solid #1a1f2b; background: #e8f0fc; }
  .sign { display: flex; justify-content: space-between; gap: 14mm; margin-top: 16mm; }
  .sign div { flex: 1; border-top: .3mm solid #1a1f2b; padding-top: 1.5mm; }
</style>
</head>
<body>
<div class="page">
  ${watermark ? `<div class="watermark">${escapeHtml(watermark)}</div>` : ''}
  <div class="head">
    <div class="co">
      <b>${escapeHtml(company?.name || '')}</b><br>
      Reg. No. ${escapeHtml(company?.registrationNo || '-')} &middot; TIN ${escapeHtml(company?.tin || '-')}<br>
      ${escapeHtml(company?.address || '')}<br>
      Tel ${escapeHtml(company?.phone || '')} &middot; ${escapeHtml(company?.email || '')}
    </div>
    <div class="title">
      <h1>QUOTATION</h1>
      <div><b>${revLabel}</b></div>
    </div>
  </div>
  <div class="meta">
    <div>
      <h3>To</h3>
      <b>${escapeHtml(client?.name || '')}</b><br>
      ${escapeHtml(client?.address || '')}<br>
      Attn: ${escapeHtml(client?.contactName || '-')} &middot; ${escapeHtml(client?.phone || '')}
    </div>
    <table>
      <tr><td>Date</td><td>${escapeHtml(quotation.issueDate)}</td></tr>
      <tr><td>Valid until</td><td>${escapeHtml(quotation.validUntil || '-')}</td></tr>
    </table>
  </div>
  <p><b>Title:</b> ${escapeHtml(quotation.title)}</p>
  ${project ? `<p><b>Project:</b> ${escapeHtml(project.code)} ${escapeHtml(project.name)}</p>` : ''}
  <table class="items">
    <tr><th>No.</th><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Rate (RM)</th><th class="num">Amount (RM)</th></tr>
    ${sectionRows}
  </table>
  <table class="sum">
    <tr><td>Subtotal</td><td class="num">${escapeHtml(quotation.subtotal)}</td></tr>
    <tr><td>Discount</td><td class="num">${escapeHtml(quotation.discountAmount)}</td></tr>
    <tr><td>Tax</td><td class="num">${escapeHtml(quotation.taxAmount)}</td></tr>
    <tr class="grand"><td>Total (RM)</td><td class="num">${escapeHtml(quotation.total)}</td></tr>
  </table>
  <div class="block">
    <h3>Terms and conditions</h3>
    <p>${escapeHtml(quotation.terms || '')}</p>
  </div>
  <div class="sign">
    <div>For ${escapeHtml(company?.name || '')}<br><br><br>Name:<br>Date:</div>
    <div>Accepted by (client signature and company stamp)<br><br><br>Name:<br>Date:</div>
  </div>
</div>
</body>
</html>`;
  }

  renderInvoiceHtml(data: {
    company: any;
    client: any;
    project?: any;
    invoice: any;
    watermark?: string;
  }): string {
    const { company, client, project, invoice, watermark } = data;
    const invNo = escapeHtml(invoice.number || 'DRAFT');
    const docTitle =
      invoice.type === 'PROGRESS_CLAIM'
        ? 'TAX INVOICE / PROGRESS CLAIM'
        : invoice.type === 'RETENTION_RELEASE'
          ? 'TAX INVOICE / RETENTION RELEASE'
          : 'TAX INVOICE';

    let bodyTableHtml = '';
    let summaryTableHtml = '';

    if (invoice.type === 'PROGRESS_CLAIM') {
      // AC10: per item shows contract amount, previous claimed, this claim, cumulative, percent;
      // then gross to date, less retention, less previous certified, tax, amount due.
      const rows = (invoice.claimLines || [])
        .map(
          (cl: any, idx: number) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(cl.contractItem?.description || '')}</td>
            <td class="num">${escapeHtml(cl.contractItem?.amount || '0.00')}</td>
            <td class="num">${escapeHtml(cl.previousAmount)}</td>
            <td class="num">${escapeHtml(cl.thisClaimAmount)}</td>
            <td class="num">${escapeHtml(cl.cumulativeAmount)}</td>
            <td class="num">${escapeHtml(cl.cumulativePercent)}%</td>
          </tr>`,
        )
        .join('');

      bodyTableHtml = `
      <table class="items">
        <tr>
          <th>No.</th>
          <th>Description</th>
          <th class="num">Contract (RM)</th>
          <th class="num">Previous (RM)</th>
          <th class="num">This claim (RM)</th>
          <th class="num">To date (RM)</th>
          <th class="num">%</th>
        </tr>
        ${rows}
      </table>`;

      const netToDate = (
        Number(invoice.grossToDate || 0) - Number(invoice.retentionToDate || 0)
      ).toFixed(2);

      summaryTableHtml = `
      <table class="sum" style="width:100mm">
        <tr><td>Value of work done to date</td><td class="num">${escapeHtml(invoice.grossToDate)}</td></tr>
        <tr><td>Less retention</td><td class="num">(${escapeHtml(invoice.retentionToDate)})</td></tr>
        <tr class="line"><td>Net value to date</td><td class="num">${escapeHtml(netToDate)}</td></tr>
        <tr><td>Less previously certified</td><td class="num">(${escapeHtml(invoice.previousNetCertified)})</td></tr>
        <tr class="line"><td>Amount this claim</td><td class="num">${escapeHtml(invoice.subtotal)}</td></tr>
        <tr><td>SST (${escapeHtml(invoice.taxPercent || '0.00')}%)</td><td class="num">${escapeHtml(invoice.taxAmount)}</td></tr>
        <tr class="grand"><td>Amount due (RM)</td><td class="num">${escapeHtml(invoice.total)}</td></tr>
      </table>`;
    } else {
      const rows = (invoice.lines || [])
        .map(
          (l: any, idx: number) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(l.description)}</td>
            <td>${escapeHtml(l.unit || '')}</td>
            <td class="num">${escapeHtml(l.quantity)}</td>
            <td class="num">${escapeHtml(l.rate)}</td>
            <td class="num">${escapeHtml(l.amount)}</td>
          </tr>`,
        )
        .join('');

      bodyTableHtml = `
      <table class="items">
        <tr><th>No.</th><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Rate (RM)</th><th class="num">Amount (RM)</th></tr>
        ${rows}
      </table>`;

      summaryTableHtml = `
      <table class="sum">
        <tr><td>Subtotal</td><td class="num">${escapeHtml(invoice.subtotal)}</td></tr>
        <tr><td>Tax</td><td class="num">${escapeHtml(invoice.taxAmount)}</td></tr>
        <tr class="grand"><td>Amount due (RM)</td><td class="num">${escapeHtml(invoice.total)}</td></tr>
      </table>`;
    }

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${docTitle} ${invNo}</title>
</head>
<body>
<div class="page">
  ${watermark ? `<div class="watermark">${escapeHtml(watermark)}</div>` : ''}
  <div class="head">
    <div class="co">
      <b>${escapeHtml(invoice.supplier?.name || company?.name || '')}</b><br>
      Reg. No. ${escapeHtml(invoice.supplier?.registrationNo || company?.registrationNo || '-')} &middot;
      TIN ${escapeHtml(invoice.supplier?.tin || company?.tin || '-')}<br>
      ${escapeHtml(invoice.supplier?.address || company?.address || '')}
    </div>
    <div class="title">
      <h1>${docTitle}</h1>
      <div><b>${invNo}</b></div>
      ${invoice.referenceSummary ? `<div>Ref: <b>${escapeHtml(invoice.referenceSummary)}</b></div>` : ''}
    </div>
  </div>
  <div class="meta">
    <div>
      <h3>Bill to</h3>
      <b>${escapeHtml(invoice.buyer?.name || client?.name || '')}</b><br>
      Reg. No. ${escapeHtml(invoice.buyer?.registrationNo || client?.registrationNo || '-')} &middot;
      TIN ${escapeHtml(invoice.buyer?.tin || client?.tin || '-')}<br>
      ${escapeHtml(invoice.buyer?.address || client?.address || '')}
    </div>
    <table>
      <tr><td>Date</td><td>${escapeHtml(invoice.issueDate || '-')}</td></tr>
      <tr><td>Due date</td><td>${escapeHtml(invoice.dueDate || '-')}</td></tr>
      <tr><td>Project Code</td><td>${escapeHtml(invoice.projectCodeRef || project?.code || '-')}</td></tr>
      <tr><td>Quote / PO Ref</td><td>${escapeHtml(invoice.quotePoRef || project?.contractQuoteRef || '-')}</td></tr>
      <tr><td>Claim / Report Ref</td><td>${escapeHtml(invoice.claimReportRef || '-')}</td></tr>
    </table>
  </div>
  ${bodyTableHtml}
  ${summaryTableHtml}
  <div class="block">
    <h3>Payment Details</h3>
    <p>${escapeHtml(company?.bankDetails || '')}</p>
  </div>
</div>
</body>
</html>`;
  }

  renderSiteReportHtml(data: {
    company: any;
    project: any;
    reports: any[];
    from: string;
    to: string;
  }): string {
    const { company, project, reports, from, to } = data;
    const reportBlocks = reports
      .map((r: any) => {
        const totalWorkers = (r.manpower || []).reduce(
          (acc: number, m: any) => acc + Number(m.headcount || 0),
          0,
        );
        const manpowerRows = (r.manpower || [])
          .map(
            (m: any) =>
              `<tr><td>${escapeHtml(m.trade)}</td><td class="num">${Number(m.headcount)}</td></tr>`,
          )
          .join('');
        const photosHtml = (r.photos || [])
          .map(
            (p: any) =>
              `<figure><div class="ph"></div><figcaption>${escapeHtml(p.caption || 'Site photo')}</figcaption></figure>`,
          )
          .join('');

        return `
        <div class="report-day">
          <h2>${escapeHtml(r.number || '')} &middot; Date: ${escapeHtml(r.reportDate)} &middot; Weather: ${escapeHtml(r.weather || '-')}</h2>
          <p>Reported by: ${escapeHtml(r.submittedBy?.name || '-')}</p>
          <div class="cols">
            <div>
              <h3>Work done</h3>
              <p>${escapeHtml(r.workDone)}</p>
              <h3>Issues and delays</h3>
              <p>${escapeHtml(r.issues || 'None')}</p>
              <h3>Plan for next working day</h3>
              <p>${escapeHtml(r.nextDayPlan || '-')}</p>
            </div>
            <div>
              <table class="items">
                <tr><th>Manpower</th><th class="num">No.</th></tr>
                ${manpowerRows}
                <tr class="tot"><td>Total</td><td class="num">${totalWorkers}</td></tr>
              </table>
            </div>
          </div>
          <div class="photos">${photosHtml}</div>
        </div>`;
      })
      .join('<hr/>');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Site Report ${escapeHtml(project.code)}</title>
</head>
<body>
<div class="page">
  <div class="head">
    <div class="co">
      <b>${escapeHtml(company?.name || '')}</b><br>
      ${escapeHtml(company?.address || '')}
    </div>
    <div class="title">
      <h1>DAILY SITE REPORT</h1>
      <div><b>${escapeHtml(from)} to ${escapeHtml(to)}</b></div>
    </div>
  </div>
  <div class="meta">
    <div>
      <h3>Project</h3>
      <b>${escapeHtml(project.code)} ${escapeHtml(project.name)}</b><br>
      ${escapeHtml(project.siteAddress || '')}
    </div>
  </div>
  ${reportBlocks || '<p>No reports submitted for this period.</p>'}
</div>
</body>
</html>`;
  }

  async renderHtmlToPdf(title: string, html: string): Promise<Buffer> {
    return buildMinimalPdfBuffer(title, html);
  }
}
