import {
  Decimal,
  DecimalInput,
  formatMoney,
  formatPercent,
  formatQuantity,
  roundMoney,
  roundPercent,
  roundQuantity,
  toDecimal,
} from './money';

export interface ClaimContractItemInput {
  id: string;
  quantity: DecimalInput;
  rate: DecimalInput;
  amount: DecimalInput;
  variationOrderId?: string | null;
}

export interface PreviousClaimState {
  previousNetCertified: DecimalInput;
  lineByContractItemId: Record<
    string,
    {
      cumulativePercent: DecimalInput;
      cumulativeAmount: DecimalInput;
    }
  >;
}

export interface ClaimLineUserInput {
  contractItemId: string;
  cumulativePercent?: DecimalInput;
  cumulativeQuantity?: DecimalInput;
}

export interface ClaimCalculationParams {
  contractItems: ClaimContractItemInput[];
  previousClaim?: PreviousClaimState | null;
  inputs: ClaimLineUserInput[];
  retentionPercent: DecimalInput;
  retentionCapPercent: DecimalInput;
  taxPercent: DecimalInput;
}

export interface CalculatedClaimLine {
  contractItemId: string;
  previousPercent: string;
  cumulativePercent: string;
  cumulativeQuantity: string;
  cumulativeAmount: string;
  previousAmount: string;
  thisClaimAmount: string;
}

export interface CalculatedClaimResult {
  currentContractSum: string;
  grossToDate: string;
  retentionLimit: string;
  retentionToDate: string;
  netToDate: string;
  previousNetCertified: string;
  subtotal: string;
  taxPercent: string;
  taxAmount: string;
  total: string;
  claimLines: CalculatedClaimLine[];
}

export class ClaimCalculationError extends Error {
  constructor(
    public readonly code:
      | 'CLAIM_PERCENT_BELOW_PREVIOUS'
      | 'CLAIM_PERCENT_ABOVE_100'
      | 'CLAIM_ITEM_NOT_IN_CONTRACT',
    message: string,
  ) {
    super(message);
  }
}

export class ClaimCalculator {
  static calculate(params: ClaimCalculationParams): CalculatedClaimResult {
    const contractMap = new Map<string, ClaimContractItemInput>();
    let currentContractSumDec = new Decimal(0);

    for (const ci of params.contractItems) {
      contractMap.set(ci.id, ci);
      currentContractSumDec = currentContractSumDec.add(roundMoney(ci.amount));
    }

    const inputMap = new Map<string, ClaimLineUserInput>();
    for (const inp of params.inputs) {
      if (!contractMap.has(inp.contractItemId)) {
        throw new ClaimCalculationError(
          'CLAIM_ITEM_NOT_IN_CONTRACT',
          `Contract item ${inp.contractItemId} does not belong to the project contract`,
        );
      }
      inputMap.set(inp.contractItemId, inp);
    }

    const prevLines = params.previousClaim?.lineByContractItemId || {};
    let grossToDateDec = new Decimal(0);
    const claimLines: CalculatedClaimLine[] = [];

    for (const ci of params.contractItems) {
      const itemQty = roundQuantity(ci.quantity);
      const itemAmount = roundMoney(ci.amount);
      const prevLine = prevLines[ci.id];
      const prevPct = prevLine ? roundPercent(prevLine.cumulativePercent) : new Decimal(0);
      const prevAmt = prevLine ? roundMoney(prevLine.cumulativeAmount) : new Decimal(0);

      const userInput = inputMap.get(ci.id);
      let cumPct: Decimal;
      let cumQty: Decimal;

      if (userInput && userInput.cumulativePercent !== undefined) {
        cumPct = roundPercent(userInput.cumulativePercent);
        cumQty = roundQuantity(itemQty.mul(cumPct).div(100));
      } else if (userInput && userInput.cumulativeQuantity !== undefined) {
        cumQty = roundQuantity(userInput.cumulativeQuantity);
        cumPct = itemQty.isZero()
          ? new Decimal(0)
          : roundPercent(cumQty.div(itemQty).mul(100));
      } else {
        cumPct = prevPct;
        cumQty = roundQuantity(itemQty.mul(cumPct).div(100));
      }

      if (cumPct.gt(100)) {
        throw new ClaimCalculationError(
          'CLAIM_PERCENT_ABOVE_100',
          `Cumulative percent ${cumPct.toFixed(2)} for item ${ci.id} cannot exceed 100`,
        );
      }
      if (cumPct.lt(prevPct)) {
        throw new ClaimCalculationError(
          'CLAIM_PERCENT_BELOW_PREVIOUS',
          `Cumulative percent ${cumPct.toFixed(2)} for item ${ci.id} cannot be lower than previous ${prevPct.toFixed(2)}`,
        );
      }

      const cumAmt = roundMoney(itemAmount.mul(cumPct).div(100));
      const thisClaimAmt = cumAmt.sub(prevAmt);
      grossToDateDec = grossToDateDec.add(cumAmt);

      claimLines.push({
        contractItemId: ci.id,
        previousPercent: formatPercent(prevPct),
        cumulativePercent: formatPercent(cumPct),
        cumulativeQuantity: formatQuantity(cumQty),
        cumulativeAmount: formatMoney(cumAmt),
        previousAmount: formatMoney(prevAmt),
        thisClaimAmount: formatMoney(thisClaimAmt),
      });
    }

    const retentionPct = toDecimal(params.retentionPercent);
    const retentionCapPct = toDecimal(params.retentionCapPercent);
    const taxPct = roundPercent(params.taxPercent);

    // retentionToDate = min(round(grossToDate x retentionPercent / 100, 2),
    //                       round(currentContractSum x retentionCapPercent / 100, 2))
    const rawRetention = roundMoney(grossToDateDec.mul(retentionPct).div(100));
    const retentionLimitDec = Decimal.max(
      new Decimal(0),
      roundMoney(currentContractSumDec.mul(retentionCapPct).div(100)),
    );
    const retentionToDateDec = Decimal.max(
      new Decimal(0),
      Decimal.min(rawRetention, retentionLimitDec),
    );

    const netToDateDec = grossToDateDec.sub(retentionToDateDec);
    const previousNetCertifiedDec = roundMoney(
      params.previousClaim?.previousNetCertified ?? '0.00',
    );
    const subtotalDec = netToDateDec.sub(previousNetCertifiedDec);
    const taxAmountDec = roundMoney(subtotalDec.mul(taxPct).div(100));
    const totalDec = subtotalDec.add(taxAmountDec);

    return {
      currentContractSum: formatMoney(currentContractSumDec),
      grossToDate: formatMoney(grossToDateDec),
      retentionLimit: formatMoney(retentionLimitDec),
      retentionToDate: formatMoney(retentionToDateDec),
      netToDate: formatMoney(netToDateDec),
      previousNetCertified: formatMoney(previousNetCertifiedDec),
      subtotal: formatMoney(subtotalDec),
      taxPercent: formatPercent(taxPct),
      taxAmount: formatMoney(taxAmountDec),
      total: formatMoney(totalDec),
      claimLines,
    };
  }
}
