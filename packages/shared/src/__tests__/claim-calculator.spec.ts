import { describe, expect, it } from 'vitest';
import {
  ClaimCalculator,
  deriveClientCode,
  deriveProjectCodeFromQuotation,
  formatDailyReportNumber,
  formatInspectionReportNumber,
  formatProgressReportNumber,
  formatQuotationBaseNumber,
  formatQuotationRevisionRef,
  formatTaxInvoiceNumber,
  formatVariationOrderNumbers,
} from '../index';

describe('ClaimCalculator (Spec 04 AC3, AC4, AC12)', () => {
  const baseContractItems = [
    { id: 'item-a', quantity: '1.000', rate: '100000.00', amount: '100000.00' },
    { id: 'item-b', quantity: '100.000', rate: '2000.00', amount: '200000.00' },
  ]; // Original contract sum = 300,000.00

  it('1. First claim: calculates grossToDate, 10% retention, netToDate, tax, and total', () => {
    const claim1 = ClaimCalculator.calculate({
      contractItems: baseContractItems,
      previousClaim: null,
      inputs: [
        { contractItemId: 'item-a', cumulativePercent: '50.00' }, // 50,000
        { contractItemId: 'item-b', cumulativePercent: '20.00' }, // 40,000
      ],
      retentionPercent: '10.00',
      retentionCapPercent: '5.00',
      taxPercent: '6.00',
    });

    // Gross = 90,000.00; 10% retention = 9,000.00 (cap is 5% of 300k = 15,000.00)
    // Net to date = 81,000.00; previousNetCertified = 0.00 -> subtotal = 81,000.00
    // Tax 6% = 4,860.00 -> total = 85,860.00
    expect(claim1.grossToDate).toBe('90000.00');
    expect(claim1.retentionToDate).toBe('9000.00');
    expect(claim1.netToDate).toBe('81000.00');
    expect(claim1.previousNetCertified).toBe('0.00');
    expect(claim1.subtotal).toBe('81000.00');
    expect(claim1.taxAmount).toBe('4860.00');
    expect(claim1.total).toBe('85860.00');
  });

  it('2. Mid-contract claim: deducts previousNetCertified and computes thisClaimAmount per line', () => {
    const claim2 = ClaimCalculator.calculate({
      contractItems: baseContractItems,
      previousClaim: {
        previousNetCertified: '81000.00',
        lineByContractItemId: {
          'item-a': { cumulativePercent: '50.00', cumulativeAmount: '50000.00' },
          'item-b': { cumulativePercent: '20.00', cumulativeAmount: '40000.00' },
        },
      },
      inputs: [
        { contractItemId: 'item-a', cumulativePercent: '80.00' }, // 80,000 (+30,000)
        { contractItemId: 'item-b', cumulativePercent: '35.00' }, // 70,000 (+30,000)
      ],
      retentionPercent: '10.00',
      retentionCapPercent: '5.00',
      taxPercent: '6.00',
    });

    // Gross = 150,000.00; 10% retention = 15,000.00 (equals 5% cap 15,000.00)
    // Net to date = 135,000.00; less previous 81,000.00 = 54,000.00
    expect(claim2.grossToDate).toBe('150000.00');
    expect(claim2.retentionToDate).toBe('15000.00');
    expect(claim2.netToDate).toBe('135000.00');
    expect(claim2.subtotal).toBe('54000.00');
    expect(claim2.taxAmount).toBe('3240.00');
    expect(claim2.total).toBe('57240.00');
    expect(claim2.claimLines[0].thisClaimAmount).toBe('30000.00');
  });

  it('3. Claim that hits the retention cap: caps retention at 5% of current contract sum', () => {
    const claim3 = ClaimCalculator.calculate({
      contractItems: baseContractItems,
      previousClaim: {
        previousNetCertified: '135000.00',
        lineByContractItemId: {
          'item-a': { cumulativePercent: '80.00', cumulativeAmount: '80000.00' },
          'item-b': { cumulativePercent: '35.00', cumulativeAmount: '70000.00' },
        },
      },
      inputs: [
        { contractItemId: 'item-a', cumulativePercent: '100.00' }, // 100,000
        { contractItemId: 'item-b', cumulativePercent: '60.00' }, // 120,000
      ],
      retentionPercent: '10.00',
      retentionCapPercent: '5.00',
      taxPercent: '6.00',
    });

    // Gross = 220,000.00; 10% would be 22,000.00, capped at 5% of 300,000 = 15,000.00!
    // Net to date = 205,000.00; less previous 135,000.00 = 70,000.00 (zero additional retention deducted!)
    expect(claim3.grossToDate).toBe('220000.00');
    expect(claim3.retentionToDate).toBe('15000.00');
    expect(claim3.netToDate).toBe('205000.00');
    expect(claim3.subtotal).toBe('70000.00');
  });

  it('4. Claim after an approved variation order: increases currentContractSum and retention cap', () => {
    const itemsWithVo = [
      ...baseContractItems,
      { id: 'vo-1', quantity: '1.000', rate: '40000.00', amount: '40000.00', variationOrderId: 'vo1' },
    ]; // Current contract sum = 340,000.00 -> 5% cap = 17,000.00

    const claim4 = ClaimCalculator.calculate({
      contractItems: itemsWithVo,
      previousClaim: {
        previousNetCertified: '205000.00',
        lineByContractItemId: {
          'item-a': { cumulativePercent: '100.00', cumulativeAmount: '100000.00' },
          'item-b': { cumulativePercent: '60.00', cumulativeAmount: '120000.00' },
        },
      },
      inputs: [
        { contractItemId: 'item-a', cumulativePercent: '100.00' },
        { contractItemId: 'item-b', cumulativePercent: '70.00' }, // 140,000
        { contractItemId: 'vo-1', cumulativePercent: '50.00' }, // 20,000
      ],
      retentionPercent: '10.00',
      retentionCapPercent: '5.00',
      taxPercent: '6.00',
    });

    expect(claim4.currentContractSum).toBe('340000.00');
    expect(claim4.grossToDate).toBe('260000.00');
    expect(claim4.retentionToDate).toBe('17000.00');
    expect(claim4.netToDate).toBe('243000.00');
    expect(claim4.subtotal).toBe('38000.00');
  });

  it('5. Final claim at 100%: bills remaining contract value less capped retention', () => {
    const finalClaim = ClaimCalculator.calculate({
      contractItems: baseContractItems,
      previousClaim: {
        previousNetCertified: '205000.00',
        lineByContractItemId: {
          'item-a': { cumulativePercent: '100.00', cumulativeAmount: '100000.00' },
          'item-b': { cumulativePercent: '60.00', cumulativeAmount: '120000.00' },
        },
      },
      inputs: [
        { contractItemId: 'item-a', cumulativePercent: '100.00' },
        { contractItemId: 'item-b', cumulativePercent: '100.00' },
      ],
      retentionPercent: '10.00',
      retentionCapPercent: '5.00',
      taxPercent: '6.00',
    });

    expect(finalClaim.grossToDate).toBe('300000.00');
    expect(finalClaim.retentionToDate).toBe('15000.00');
    expect(finalClaim.netToDate).toBe('285000.00');
    expect(finalClaim.subtotal).toBe('80000.00');
  });

  it('6. Omission variation: negative contract item reduces currentContractSum and grossToDate', () => {
    const itemsWithOmission = [
      ...baseContractItems,
      { id: 'vo-omission', quantity: '-1.000', rate: '20000.00', amount: '-20000.00', variationOrderId: 'vo2' },
    ]; // Current contract sum = 280,000.00 -> 5% cap = 14,000.00

    const claimOmission = ClaimCalculator.calculate({
      contractItems: itemsWithOmission,
      previousClaim: null,
      inputs: [
        { contractItemId: 'item-a', cumulativePercent: '100.00' },
        { contractItemId: 'item-b', cumulativePercent: '100.00' },
        { contractItemId: 'vo-omission', cumulativePercent: '100.00' },
      ],
      retentionPercent: '10.00',
      retentionCapPercent: '5.00',
      taxPercent: '6.00',
    });

    expect(claimOmission.currentContractSum).toBe('280000.00');
    expect(claimOmission.grossToDate).toBe('280000.00');
    expect(claimOmission.retentionToDate).toBe('14000.00');
    expect(claimOmission.netToDate).toBe('266000.00');
  });

  it('AC4: rejects cumulativePercent > 100 or below previous claim', () => {
    expect(() =>
      ClaimCalculator.calculate({
        contractItems: baseContractItems,
        previousClaim: {
          previousNetCertified: '50000.00',
          lineByContractItemId: {
            'item-a': { cumulativePercent: '50.00', cumulativeAmount: '50000.00' },
          },
        },
        inputs: [{ contractItemId: 'item-a', cumulativePercent: '40.00' }],
        retentionPercent: '10.00',
        retentionCapPercent: '5.00',
        taxPercent: '6.00',
      }),
    ).toThrow(/cannot be lower than previous/);

    expect(() =>
      ClaimCalculator.calculate({
        contractItems: baseContractItems,
        inputs: [{ contractItemId: 'item-a', cumulativePercent: '105.00' }],
        retentionPercent: '10.00',
        retentionCapPercent: '5.00',
        taxPercent: '6.00',
      }),
    ).toThrow(/cannot exceed 100/);
  });

  it('formats Document Link Flow identifiers accurately', () => {
    expect(deriveClientCode('Acme Corp', 'ACM')).toBe('ACM');
    const baseQuote = formatQuotationBaseNumber('QT-2026-0014', 'ACM');
    expect(baseQuote).toBe('QT-26-014-ACM');
    expect(formatQuotationRevisionRef(baseQuote, 0)).toBe('QT-26-014-ACM-R0');
    expect(formatQuotationRevisionRef(baseQuote, 1)).toBe('QT-26-014-ACM-R1');
    expect(deriveProjectCodeFromQuotation('QT-26-014-ACM-R1')).toBe('P26-014');
    expect(formatDailyReportNumber('P26-014', '2026-11-19')).toBe('DR-P26014-20261119');
    expect(formatProgressReportNumber('P26-014', 1)).toBe('PR-P26014-001');
    expect(formatInspectionReportNumber('P26-014', 5)).toBe('IR-P26014-005');
    expect(formatVariationOrderNumbers('P26-014', 'QT-26-014-ACM-R1', 'ACM', 1)).toEqual({
      number: 'QT-26-014-ACM-VO01',
      shortRef: 'VO-01',
    });
    expect(formatTaxInvoiceNumber('INV-2026-0045')).toBe('INV-26-0045');
  });
});
