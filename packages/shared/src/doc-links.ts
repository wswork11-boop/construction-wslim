export function deriveClientCode(name: string, explicitCode?: string | null): string {
  if (explicitCode && explicitCode.trim()) {
    return explicitCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
  }
  const cleanWords = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w && !['SDN', 'BHD', 'BERHAD', 'SYARIKAT', 'CORP', 'INC', 'LTD'].includes(w));

  if (cleanWords.length === 0) {
    return 'CLI';
  }
  if (cleanWords.length === 1) {
    const word = cleanWords[0];
    // e.g. ACME -> ACM (first 3 letters, or consonant-heavy if 4+ letters)
    return word.slice(0, 3).padEnd(3, 'X');
  }
  return cleanWords
    .map((w) => w[0])
    .join('')
    .slice(0, 4);
}

export function cleanProjectCodeToken(projectCode: string): string {
  return projectCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatQuotationBaseNumber(
  seqNumber: string,
  clientCode: string,
): string {
  // Converts e.g. QT-2026-0014 + ACM -> QT-26-014-ACM
  const match = /^QT-(\d{4})-(\d+)$/.exec(seqNumber);
  if (match) {
    const yy = match[1].slice(-2);
    const seq3 = String(Number(match[2])).padStart(3, '0');
    return `QT-${yy}-${seq3}-${clientCode}`;
  }
  return seqNumber;
}

export function formatQuotationRevisionRef(baseNumber: string, revisionNo: number): string {
  // e.g. QT-26-014-ACM + 1 -> QT-26-014-ACM-R1
  const stripped = baseNumber.replace(/-R\d+$/, '');
  return `${stripped}-R${revisionNo}`;
}

export function deriveProjectCodeFromQuotation(quotationNumber: string): string {
  // e.g. QT-26-014-ACM or QT-26-014-ACM-R1 -> P26-014
  const match2 = /^QT-(\d{2})-(\d{3,4})/i.exec(quotationNumber);
  if (match2) {
    return `P${match2[1]}-${match2[2]}`;
  }
  const match4 = /^QT-(\d{4})-(\d+)/i.exec(quotationNumber);
  if (match4) {
    const yy = match4[1].slice(-2);
    const seq3 = String(Number(match4[2])).padStart(3, '0');
    return `P${yy}-${seq3}`;
  }
  return `P26-001`;
}

export function formatDailyReportNumber(projectCode: string, reportDateYmd: string): string {
  // e.g. P26-014 + 2026-11-19 -> DR-P26014-20261119
  const projToken = cleanProjectCodeToken(projectCode);
  const dateToken = reportDateYmd.slice(0, 10).replace(/-/g, '');
  return `DR-${projToken}-${dateToken}`;
}

export function formatProgressReportNumber(projectCode: string, seqNo: number): string {
  // e.g. P26-014 + 1 -> PR-P26014-001
  const projToken = cleanProjectCodeToken(projectCode);
  return `PR-${projToken}-${String(seqNo).padStart(3, '0')}`;
}

export function formatInspectionReportNumber(projectCode: string, seqNo: number): string {
  // e.g. P26-014 + 5 -> IR-P26014-005
  const projToken = cleanProjectCodeToken(projectCode);
  return `IR-${projToken}-${String(seqNo).padStart(3, '0')}`;
}

export function formatVariationOrderNumbers(
  projectCode: string,
  contractQuoteRef: string | null | undefined,
  clientCode: string,
  voIndex: number,
): { number: string; shortRef: string } {
  const shortRef = `VO-${String(voIndex).padStart(2, '0')}`;
  if (contractQuoteRef) {
    const baseQuote = contractQuoteRef.replace(/-R\d+$/i, '');
    return {
      number: `${baseQuote}-VO${String(voIndex).padStart(2, '0')}`,
      shortRef,
    };
  }
  // Derive from projectCode e.g. P26-014 -> QT-26-014-ACM-VO01
  const pMatch = /^P(\d{2})-(\d{3,4})/i.exec(projectCode);
  if (pMatch) {
    return {
      number: `QT-${pMatch[1]}-${pMatch[2]}-${clientCode}-VO${String(voIndex).padStart(2, '0')}`,
      shortRef,
    };
  }
  return {
    number: `QT-${cleanProjectCodeToken(projectCode)}-${clientCode}-VO${String(voIndex).padStart(2, '0')}`,
    shortRef,
  };
}

export function formatTaxInvoiceNumber(rawSeqNumber: string): string {
  // Converts INV-2026-0045 -> INV-26-0045
  const match = /^([A-Z]+)-(\d{4})-(\d+)$/.exec(rawSeqNumber);
  if (match) {
    return `${match[1]}-${match[2].slice(-2)}-${match[3]}`;
  }
  return rawSeqNumber;
}

export function formatExpenseNumber(rawSeqNumber: string): string {
  // Converts EXP-2026-0001 -> EXP-26-0001
  const match = /^([A-Z]+)-(\d{4})-(\d+)$/.exec(rawSeqNumber);
  if (match) {
    return `${match[1]}-${match[2].slice(-2)}-${match[3]}`;
  }
  return rawSeqNumber;
}

