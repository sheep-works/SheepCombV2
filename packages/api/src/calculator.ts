export interface CalculationResult {
  input_tokens: number;
  actual_input_tokens: number;
  cached_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_jpy: number;
}

export interface ModelCost {
  input_cost: number;  // USD per 1M tokens
  output_cost: number; // USD per 1M tokens
}

export const MODEL_PRICING: Record<string, ModelCost> = {
  'gemini-3-pro-preview': { input_cost: 2.0, output_cost: 12.0 },
  'gemini-3.1-flash-lite-preview': { input_cost: 0.25, output_cost: 1.5 },
  'gemini-3.1-flash-preview': { input_cost: 0.5, output_cost: 3.0 },
  'gemini-3.1-pro-preview': { input_cost: 2.0, output_cost: 12.0 },
  'claude-3-5-sonnet-v2@20241022': { input_cost: 3.0, output_cost: 15.0 },
  'claude-3-5-sonnet@20240620': { input_cost: 3.0, output_cost: 15.0 },
};

export class CostCalculator {
  private usd_jpy: number;
  public total_input_tokens = 0;
  public total_output_tokens = 0;
  public total_cached_tokens = 0;
  public total_cost_usd = 0.0;
  public total_cost_jpy = 0.0;
  public total_requests = 0;

  constructor(usd_jpy = 150) {
    this.usd_jpy = usd_jpy;
  }

  public calculate(
    input_tokens: number,
    output_tokens: number,
    model_cost_data: [number, number],
    cached_tokens = 0
  ): CalculationResult {
    const input = input_tokens || 0;
    const output = output_tokens || 0;
    const cached = cached_tokens || 0;

    const actual_input_tokens = input - cached;
    const input_usd_price = model_cost_data[0] || 0.0;
    const output_usd_price = model_cost_data[1] || 0.0;

    // Cache hit tokens cost 20% of normal input pricing
    const cost_usd =
      (actual_input_tokens / 1000000) * input_usd_price +
      (cached / 1000000) * input_usd_price * 0.2 +
      (output / 1000000) * output_usd_price;

    const cost_jpy = cost_usd * this.usd_jpy;

    this.total_input_tokens += input;
    this.total_output_tokens += output;
    this.total_cached_tokens += cached;
    this.total_cost_usd += cost_usd;
    this.total_cost_jpy += cost_jpy;
    this.total_requests += 1;

    return {
      input_tokens: input,
      actual_input_tokens: actual_input_tokens,
      cached_tokens: cached,
      output_tokens: output,
      total_tokens: input + output,
      cost_usd,
      cost_jpy
    };
  }

  public formatLog(res: CalculationResult): string {
    const cached_tokens = res.cached_tokens;
    const input_token_str =
      cached_tokens > 0
        ? `${res.actual_input_tokens} + ${cached_tokens} (cached)`
        : `${res.input_tokens}`;

    const nowStr = new Date().toLocaleString('ja-JP');

    const logLines = [
      `--- 実行詳細 (${nowStr}) ---`,
      `  Total Tokens: ${res.total_tokens}`,
      `  Input Tokens: ${input_token_str}`,
      `  Output Tokens: ${res.output_tokens}`
    ];
    return logLines.join('\n');
  }

  public formatTotalLog(): string {
    const cached_str =
      this.total_cached_tokens > 0
        ? ` (内のキャッシュ: ${this.total_cached_tokens})`
        : '';
    const logLines = [
      `=== セッション合計 (${this.total_requests} リクエスト) ===`,
      `  Total Tokens: ${this.total_input_tokens + this.total_output_tokens}`,
      `  Input Tokens: ${this.total_input_tokens}${cached_str}`,
      `  Output Tokens: ${this.total_output_tokens}`
    ];
    return logLines.join('\n');
  }
}
