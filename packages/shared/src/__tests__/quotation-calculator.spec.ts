import { describe, expect, it } from 'vitest';
import { QuotationCalculator } from '../quotation-calculator';

describe('QuotationCalculator', () => {
  it('calculates section subtotals, tax and grand total with no discount', () => {
    const result = QuotationCalculator.calculate({
      discountAmount: '0.00',
      sections: [
        {
          title: 'A. Preliminaries',
          items: [
            { description: 'Mobilisation', unit: 'LS', quantity: '1.000', rate: '10000.00', taxPercent: '6.00' },
            { description: 'Hoarding', unit: 'LS', quantity: '1.000', rate: '8000.00', taxPercent: '6.00' },
          ],
        },
        {
          title: 'B. Demolition',
          items: [
            { description: 'Demolish partitions', unit: 'm2', quantity: '350.000', rate: '40.00', taxPercent: '6.00' },
          ],
        },
      ],
    });

    expect(result.sections[0].subtotal).toBe('18000.00');
    expect(result.sections[1].subtotal).toBe('14000.00');
    expect(result.subtotal).toBe('32000.00');
    expect(result.discountAmount).toBe('0.00');
    expect(result.taxAmount).toBe('1920.00');
    expect(result.total).toBe('33920.00');
  });

  it('shares discount proportionally across items with mixed tax rates and half-up rounding', () => {
    const result = QuotationCalculator.calculate({
      discountAmount: '100.00',
      sections: [
        {
          title: 'Works',
          items: [
            // 600.00 -> 60% of 100.00 discount = 60.00 -> taxable 540.00 @ 6% = 32.40
            { description: 'Taxed item', quantity: '3.000', rate: '200.00', taxPercent: '6.00' },
            // 400.00 -> 40% of 100.00 discount = 40.00 -> taxable 360.00 @ 0% = 0.00
            { description: 'Untaxed item', quantity: '2.000', rate: '200.00', taxPercent: '0.00' },
          ],
        },
      ],
    });

    expect(result.subtotal).toBe('1000.00');
    expect(result.discountAmount).toBe('100.00');
    expect(result.taxAmount).toBe('32.40');
    expect(result.total).toBe('932.40');
  });

  it('rounds quantity x rate half-up per item', () => {
    const result = QuotationCalculator.calculate({
      discountAmount: '0.00',
      sections: [
        {
          title: 'Rounding',
          items: [
            // 1.255 * 10.01 = 12.56255 -> 12.56
            { description: 'Item 1', quantity: '1.255', rate: '10.01', taxPercent: '8.00' },
          ],
        },
      ],
    });

    expect(result.sections[0].items[0].amount).toBe('12.56');
    // 12.56 * 0.08 = 1.0048 -> 1.00
    expect(result.taxAmount).toBe('1.00');
    expect(result.total).toBe('13.56');
  });
});
