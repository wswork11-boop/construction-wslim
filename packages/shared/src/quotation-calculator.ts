import { Decimal, formatMoney, formatPercent, formatQuantity, roundMoney, toDecimal } from './money';

export interface CalcQuotationItemInput {
  id?: string;
  description: string;
  unit?: string | null;
  quantity: string | number | Decimal;
  rate: string | number | Decimal;
  taxRateId?: string | null;
  taxPercent?: string | number | Decimal;
}

export interface CalcQuotationSectionInput {
  id?: string;
  title: string;
  items: CalcQuotationItemInput[];
}

export interface CalcQuotationInput {
  discountAmount?: string | number | Decimal;
  sections: CalcQuotationSectionInput[];
}

export interface CalculatedQuotationItem {
  id?: string;
  sortOrder: number;
  description: string;
  unit: string | null;
  quantity: string;
  rate: string;
  amount: string;
  taxRateId: string | null;
  taxPercent: string;
  taxAmount: string;
}

export interface CalculatedQuotationSection {
  id?: string;
  sortOrder: number;
  title: string;
  subtotal: string;
  items: CalculatedQuotationItem[];
}

export interface CalculatedQuotation {
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  sections: CalculatedQuotationSection[];
}

export class QuotationCalculator {
  static calculate(input: CalcQuotationInput): CalculatedQuotation {
    const discountDec = roundMoney(input.discountAmount ?? '0.00');

    // First pass: calculate item amounts and section subtotals
    let subtotalDec = new Decimal(0);
    const rawSections = input.sections.map((sec, secIdx) => {
      let secSubtotal = new Decimal(0);
      const items = sec.items.map((item, itemIdx) => {
        const qty = toDecimal(item.quantity).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
        const rate = roundMoney(item.rate);
        const amount = roundMoney(qty.mul(rate));
        const taxPercent = toDecimal(item.taxPercent ?? '0.00').toDecimalPlaces(
          2,
          Decimal.ROUND_HALF_UP,
        );
        secSubtotal = secSubtotal.add(amount);
        subtotalDec = subtotalDec.add(amount);
        return {
          id: item.id,
          sortOrder: itemIdx,
          description: item.description,
          unit: item.unit ?? null,
          quantityDec: qty,
          rateDec: rate,
          amountDec: amount,
          taxRateId: item.taxRateId ?? null,
          taxPercentDec: taxPercent,
        };
      });
      return {
        id: sec.id,
        sortOrder: secIdx,
        title: sec.title,
        secSubtotalDec: secSubtotal,
        items,
      };
    });

    // Second pass: calculate each item's share of discount and tax
    let taxAmountDec = new Decimal(0);
    const sections: CalculatedQuotationSection[] = rawSections.map((sec) => {
      const items: CalculatedQuotationItem[] = sec.items.map((item) => {
        let shareOfDiscount = new Decimal(0);
        if (subtotalDec.gt(0) && discountDec.gt(0)) {
          shareOfDiscount = discountDec.mul(item.amountDec).div(subtotalDec);
        }
        const taxableBase = Decimal.max(new Decimal(0), item.amountDec.sub(shareOfDiscount));
        const itemTax = roundMoney(taxableBase.mul(item.taxPercentDec).div(100));
        taxAmountDec = taxAmountDec.add(itemTax);

        return {
          id: item.id,
          sortOrder: item.sortOrder,
          description: item.description,
          unit: item.unit,
          quantity: formatQuantity(item.quantityDec),
          rate: formatMoney(item.rateDec),
          amount: formatMoney(item.amountDec),
          taxRateId: item.taxRateId,
          taxPercent: formatPercent(item.taxPercentDec),
          taxAmount: formatMoney(itemTax),
        };
      });

      return {
        id: sec.id,
        sortOrder: sec.sortOrder,
        title: sec.title,
        subtotal: formatMoney(sec.secSubtotalDec),
        items,
      };
    });

    const totalDec = subtotalDec.sub(discountDec).add(taxAmountDec);

    return {
      subtotal: formatMoney(subtotalDec),
      discountAmount: formatMoney(discountDec),
      taxAmount: formatMoney(taxAmountDec),
      total: formatMoney(totalDec),
      sections,
    };
  }
}
