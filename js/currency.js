const Currency = {
  _cache: {},
  CACHE_TTL: 3_600_000,

  async getRate(from, to = 'ILS') {
    if (from === to) return 1;
    const key = `${from}_${to}`;
    const c = this._cache[key];
    if (c && Date.now() - c.ts < this.CACHE_TTL) return c.rate;
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
      const data = await res.json();
      if (data.result === 'success') {
        const rate = data.rates[to];
        this._cache[key] = { rate, ts: Date.now() };
        return rate;
      }
    } catch {}
    const fallback = { USD:3.70, EUR:4.05, GBP:4.70, JPY:0.025, THB:0.105, TRY:0.115, AED:1.01 };
    return fallback[from] || 1;
  },

  fmt(amount, currency = 'ILS', dec = 0) {
    const sym = CURRENCY_SYMBOLS[currency] || currency;
    if (amount == null || isNaN(amount)) return `${sym}—`;
    return `${sym}${Number(amount).toLocaleString('he-IL', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  },

  fmtILS(amount) { return this.fmt(amount, 'ILS', 0); },
};
