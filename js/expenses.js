const Expenses = {
  _list: [],
  _filtered: [],
  _editing: null,
  _viewing: null,
  _activeFilter: null,

  async loadForTrip(tripId) {
    document.getElementById('expenses-list').innerHTML = `
      <div class="text-center py-10 text-on-surface-variant">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p>טוען...</p>
      </div>`;
    try {
      const res = await pb.list(CONFIG.COLLECTIONS.EXPENSES, {
        filter: `trip="${tripId}"`, sort: '-payment_date,-created', perPage: 500
      });
      this._list = res.items || [];
      this._filtered = [...this._list];
      this._activeFilter = null;
      this._render();
      this._renderSummary();
      this._renderFilterPills();
      if (!document.getElementById('modal-category-summary')?.classList.contains('hidden')) this.openCategories();
      if (!document.getElementById('modal-forecast')?.classList.contains('hidden')) this.openForecast();
    } catch (e) {
      document.getElementById('expenses-list').innerHTML = `<p class="text-center text-on-surface-variant py-8">שגיאה: ${e.message}</p>`;
    }
  },

  _click(id) {
    try {
      const exp = this._list.find(e => e.id === id);
      if (exp) this.openView(exp);
    } catch (err) {
      showToast('שגיאה: ' + err.message);
    }
  },

  _render() {
    const el = document.getElementById('expenses-list');
    if (!this._filtered.length) {
      el.innerHTML = `<div class="text-center py-12 text-on-surface-variant">
        <span class="material-symbols-outlined text-5xl block mb-3">receipt_long</span>
        <p>אין הוצאות להצגה</p></div>`;
      return;
    }
    el.innerHTML = `<div class="glass-card rounded-2xl overflow-hidden">${this._filtered.map(e => this._itemHTML(e)).join('')}</div>`;
  },

  _itemHTML(e) {
    const cat = CATEGORIES[e.category] || { icon:'📦', color:'#9e9e9e' };
    const isInstantPaid = e.payment_type === 'חד פעמי' && ['מזומן', 'אשראי', 'העברה', 'ביט'].includes(e.payment_method);
    const isTracking = e.payment_type === 'תשלומים' || e.payment_type === 'מקדמה+יתרה';

    // Material Symbols icon per default category; emoji fallback for custom
    const CAT_MS = {
      'לינה':'hotel', 'אוכל ושתייה':'restaurant', 'קניות':'shopping_bag',
      'אטרקציות':'attractions', 'רכב שכור':'directions_car', 'תחבורה':'directions_bus',
      'טיסות':'flight', 'ביטוח':'shield', 'אחר':'category',
    };
    const msIcon = CAT_MS[e.category] || (/^[a-z][a-z_]+$/.test(cat.icon) ? cat.icon : null);
    const iconHTML = msIcon
      ? `<span class="material-symbols-outlined" style="font-size:22px;color:#fff;font-variation-settings:'FILL' 1">${msIcon}</span>`
      : `<span style="font-size:22px;line-height:1">${cat.icon}</span>`;

    let badge = '';
    if (e.payment_type === 'עתידי') {
      badge = `<span style="background:rgba(139,92,246,0.22);color:#c4b5fd;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;white-space:nowrap">עתידי</span>`;
    } else if (isInstantPaid) {
      badge = `<span style="background:rgba(74,222,128,0.18);color:#4ade80;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;white-space:nowrap">שולם</span>`;
    } else if (isTracking) {
      const sum = this._getExpensePaymentSummary(e);
      const isFullyPaid = sum.remaining <= 0.01;
      const isPartial = sum.paid > 0 && !isFullyPaid;
      if (isFullyPaid) {
        badge = `<span style="background:rgba(74,222,128,0.18);color:#4ade80;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;white-space:nowrap">שולם</span>`;
      } else if (isPartial) {
        badge = `<span style="background:rgba(45,212,191,0.18);color:#2dd4bf;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;white-space:nowrap">תשלום חלקי</span>`;
      } else {
        badge = `<span style="background:rgba(239,68,68,0.18);color:#f87171;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;white-space:nowrap">טרם שולם</span>`;
      }
    }

    const origStr = e.currency !== 'ILS'
      ? `<div style="font-size:11px;color:rgba(255,255,255,0.38);direction:ltr">${Currency.fmt(e.amount, e.currency, 2)}</div>`
      : '';
    const sub = [esc(e.category || 'אחר'), e.payment_date ? fmtDate(e.payment_date) : ''].filter(Boolean).join(' • ');

    return `
      <div class="expense-item flex items-center gap-3 px-4 cursor-pointer"
           data-id="${e.id}" onclick="Expenses._click(this.dataset.id)"
           style="padding-top:16px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.06);font-family:'Heebo',sans-serif">
        <div class="flex-shrink-0 flex items-center justify-center" style="width:46px;height:46px;border-radius:50%;background:${cat.color}">${iconHTML}</div>
        <div class="flex-1 min-w-0">
          <p style="font-size:17px;font-weight:700;color:rgba(255,255,255,0.95);line-height:1.25;font-family:'Heebo',sans-serif">${esc(e.name)}</p>
          <p style="font-size:13px;font-weight:400;color:rgba(255,255,255,0.42);margin-top:3px;font-family:'Heebo',sans-serif">${sub}</p>
        </div>
        ${badge}
        <div class="flex-shrink-0 text-left" style="direction:ltr">
          <div style="font-size:17px;font-weight:700;color:rgba(255,255,255,0.95);font-family:'Heebo',sans-serif">${Currency.fmtILS(e.amount_ils)}</div>
          ${origStr}
        </div>
        <span class="material-symbols-outlined flex-shrink-0" style="font-size:16px;color:rgba(255,255,255,0.22)">chevron_left</span>
      </div>`;
  },

  _renderSummary() {
    const trip = Trips.current;
    const budget = Number(trip?.budget) || 0;
    const actual = this._list.filter(e => e.payment_type !== 'עתידי');
    const spent = actual.reduce((s,e) => s + (Number(e.amount_ils)||0), 0);
    const remaining = budget - spent;
    const pct = budget > 0 ? Math.round((spent/budget)*100) : 0;

    document.getElementById('sum-spent').textContent = Currency.fmtILS(spent);
    document.getElementById('sum-budget').textContent = budget ? `מתוך ${Currency.fmtILS(budget)}` : '';
    document.getElementById('sum-used').textContent = Currency.fmtILS(spent);
    document.getElementById('sum-remaining').textContent = budget ? Currency.fmtILS(Math.max(remaining,0)) : '—';

    const fill = document.getElementById('budget-bar-fill');
    fill.style.width = `${Math.min(pct, 100)}%`;
    if (pct >= 100) fill.style.background = 'linear-gradient(to left,#f87171,#ef4444)';
    else if (pct >= 80) fill.style.background = 'linear-gradient(to left,#fbbf24,#f59e0b)';
    else fill.style.background = 'linear-gradient(to left,#4edea3,#2563eb)';

    const circle = document.getElementById('budget-circle-progress');
    if (circle) {
      const c = 314;
      const filled = Math.min(pct / 100 * c, c);
      circle.setAttribute('stroke-dasharray', `${filled.toFixed(1)} ${(c - filled).toFixed(1)}`);
      if (pct >= 100) circle.setAttribute('stroke', '#ef4444');
      else if (pct >= 80) circle.setAttribute('stroke', '#f59e0b');
      else circle.setAttribute('stroke', 'url(#budgetGrad)');
    }

    const pctEl = document.getElementById('budget-pct');
    pctEl.textContent = budget ? `${pct}%` : '';
    pctEl.className = `text-xl font-extrabold ${pct >= 100 ? 'text-red-400' : pct >= 80 ? 'text-amber-400' : 'text-white'}`;

    const s = trip?.start_date ? fmtDate(trip.start_date) : '';
    const en = trip?.end_date ? fmtDate(trip.end_date) : '';
    const datesEl = document.getElementById('sum-dates');
    datesEl.innerHTML = (s && en ? `<span class="material-symbols-outlined text-base">calendar_month</span>${s} – ${en}` : s) || '';
  },

  _renderFilterPills() {
    const cats = [...new Set(this._list.map(e => e.category))];
    const el = document.getElementById('filter-pills');
    el.innerHTML = `
      <button class="filter-pill px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${!this._activeFilter ? 'bg-primary-container text-on-primary-container border-primary' : 'border-outline/30 bg-surface-variant/20 text-on-surface-variant'}" data-cat="">הכל</button>
      ${cats.map(c => {
        const active = this._activeFilter === c;
        return `<button class="filter-pill px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${active ? 'bg-primary-container text-on-primary-container border-primary' : 'border-outline/30 bg-surface-variant/20 text-on-surface-variant'}" data-cat="${esc(c)}">${CATEGORIES[c]?.icon||''} ${esc(c)}</button>`;
      }).join('')}`;
    el.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeFilter = btn.dataset.cat || null;
        this._applyFilters();
        this._renderFilterPills();
      });
    });
  },

  _applyFilters() {
    const q = document.getElementById('expense-search').value.trim().toLowerCase();
    this._filtered = this._list.filter(e => {
      const matchCat = !this._activeFilter || e.category === this._activeFilter;
      const matchQ = !q || e.name.toLowerCase().includes(q) || (e.category||'').toLowerCase().includes(q);
      return matchCat && matchQ;
    });
    this._render();
  },

  // ===== MODAL ADD/EDIT =====
  openModal(expense = null) {
    this._editing = expense;
    document.getElementById('modal-expense-title').textContent = expense ? 'עריכת הוצאה' : 'הוצאה חדשה';

    this._receiptFile = null;

    // Reset
    document.getElementById('exp-name').value = expense?.name || '';
    document.getElementById('exp-amount').value = expense?.amount || '';
    const defaultCurrency = localStorage.getItem('default_currency') || 'ILS';
    document.getElementById('exp-currency').value = expense?.currency || defaultCurrency;
    document.getElementById('exp-rate').value = expense?.exchange_rate || '';
    document.getElementById('exp-date').value = expense?.payment_date?.slice(0,10) || todayStr();
    document.getElementById('exp-location').value = expense?.location || '';
    document.getElementById('exp-link').value = expense?.link || '';
    document.getElementById('exp-contact-name').value = expense?.contact_name || '';
    document.getElementById('exp-contact-phone').value = expense?.contact_phone || '';
    document.getElementById('exp-notes').value = expense?.notes || '';
    document.getElementById('exp-installments').value = expense?.installments_count || '';
    document.getElementById('exp-first-payment').value = expense?.first_payment_date?.slice(0,10) || '';
    document.getElementById('exp-advance').value = expense?.advance_amount || '';
    document.getElementById('exp-advance-date').value = expense?.advance_date?.slice(0,10) || '';
    document.getElementById('exp-balance-date').value = expense?.balance_date?.slice(0,10) || '';

    // Category
    this._rebuildCategoryPills();
    this._setCategoryValue(expense?.category || '');

    // Payment type
    document.querySelectorAll('input[name="payment_type"]').forEach(r => {
      r.checked = r.value === (expense?.payment_type || 'חד פעמי');
    });
    this._updatePaymentTypeUI(expense?.payment_type || 'חד פעמי');

    // Payment method
    document.querySelectorAll('input[name="payment_method"]').forEach(r => {
      r.checked = r.value === (expense?.payment_method || 'אשראי');
    });

    // Receipt
    document.getElementById('exp-receipt-camera').value = '';
    document.getElementById('exp-receipt-gallery').value = '';
    document.getElementById('receipt-preview').classList.add('hidden');
    document.getElementById('receipt-pdf-badge')?.classList.add('hidden');
    if (expense?.receipt) {
      const img = document.getElementById('receipt-preview');
      img.src = pb.fileUrl(expense, expense.receipt);
      img.classList.remove('hidden');
    }

    this._updateCurrencyUI(expense?.currency || defaultCurrency);
    this._rebuildCategoryPills();
    App.openModal('modal-expense');
  },

  _updatePaymentTypeUI(type) {
    document.getElementById('installments-extra').classList.toggle('hidden', type !== 'תשלומים');
    document.getElementById('advance-extra').classList.toggle('hidden', type !== 'מקדמה+יתרה');
    document.getElementById('payment-method-section').classList.toggle('hidden', type === 'מקדמה+יתרה');
  },

  _updateCurrencyUI(currency) {
    const show = currency !== 'ILS';
    document.getElementById('exchange-rate-container').classList.toggle('hidden', !show);
    if (show) this._updateILSPreview();
  },

  _updateILSPreview() {
    const amt = parseFloat(document.getElementById('exp-amount').value) || 0;
    const rate = parseFloat(document.getElementById('exp-rate').value) || 0;
    const el = document.getElementById('amount-ils-preview');
    el.textContent = amt && rate ? `= ${Currency.fmtILS(amt * rate)}` : '';
  },

  async fetchRate() {
    const currency = document.getElementById('exp-currency').value;
    if (currency === 'ILS') return;
    showToast('מעדכן שער...');
    try {
      const rate = await Currency.getRate(currency);
      document.getElementById('exp-rate').value = rate.toFixed(4);
      this._updateILSPreview();
      showToast(`שער: 1 ${currency} = ₪${rate.toFixed(4)}`);
    } catch { showToast('לא ניתן לעדכן שער'); }
  },

  async save() {
    const name = document.getElementById('exp-name').value.trim();
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const category = document.getElementById('exp-cat').value;
    const paymentType = document.querySelector('input[name="payment_type"]:checked')?.value || 'חד פעמי';
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'אשראי';

    if (!name) { showToast('נא להזין שם הוצאה'); return; }
    if (!amount || isNaN(amount)) { showToast('נא להזין סכום'); return; }
    if (!category) { showToast('נא לבחור קטגוריה'); return; }

    const currency = document.getElementById('exp-currency').value;
    const rate = currency === 'ILS' ? 1 : (parseFloat(document.getElementById('exp-rate').value) || 1);
    const amountILS = amount * rate;

    const data = {
      trip: Trips.current.id,
      name, amount, currency,
      exchange_rate: rate,
      amount_ils: amountILS,
      category,
      payment_type: paymentType,
      payment_method: paymentMethod,
      payment_date: document.getElementById('exp-date').value || null,
      location: document.getElementById('exp-location').value.trim() || null,
      link: document.getElementById('exp-link').value.trim() || null,
      contact_name: document.getElementById('exp-contact-name').value.trim() || null,
      contact_phone: document.getElementById('exp-contact-phone').value.trim() || null,
      notes: document.getElementById('exp-notes').value.trim() || null,
      installments_count: parseInt(document.getElementById('exp-installments').value) || null,
      first_payment_date: document.getElementById('exp-first-payment').value || null,
      advance_amount: parseFloat(document.getElementById('exp-advance').value) || null,
      advance_date: document.getElementById('exp-advance-date').value || null,
      balance_date: document.getElementById('exp-balance-date').value || null,
      user: pb.userId,
    };

    try {
      const file = this._receiptFile || document.getElementById('exp-receipt-camera')?.files?.[0] || document.getElementById('exp-receipt-gallery')?.files?.[0];
      if (file) {
        const fd = new FormData();
        Object.entries(data).forEach(([k,v]) => { if (v != null) fd.append(k, v); });
        fd.append('receipt', file);
        if (this._editing) await pb.updateForm(CONFIG.COLLECTIONS.EXPENSES, this._editing.id, fd);
        else await pb.createForm(CONFIG.COLLECTIONS.EXPENSES, fd);
      } else {
        if (this._editing) await pb.update(CONFIG.COLLECTIONS.EXPENSES, this._editing.id, data);
        else await pb.create(CONFIG.COLLECTIONS.EXPENSES, data);
      }
      showToast(this._editing ? 'הוצאה עודכנה ✓' : 'הוצאה נוספה ✓');
      App.closeModal('modal-expense');
      await this.loadForTrip(Trips.current.id);
    } catch (e) { showToast(`שגיאה: ${e.message}`); }
  },

  // ===== VIEW =====
  _paymentStateKey(expenseId) { return `expense_paid_rows_${expenseId}`; },

  _getExpensePaymentRows(exp) {
    const total = Number(exp.amount_ils) || 0;
    const rows = [];
    if (exp.payment_type === 'מקדמה+יתרה') {
      const adv = Math.max(0, Number(exp.advance_amount) || 0);
      const remain = Math.max(0, total - adv);
      rows.push({ idx: 1, type: 'מקדמה', amount: adv, date: exp.advance_date || exp.payment_date || null });
      rows.push({ idx: 2, type: 'יתרה', amount: remain, date: exp.balance_date || null });
    } else if (exp.payment_type === 'תשלומים') {
      const count = Math.max(1, Number(exp.installments_count) || 1);
      const baseDate = exp.first_payment_date || exp.payment_date || null;
      const each = total / count;
      for (let i = 0; i < count; i++) {
        let due = null;
        if (baseDate) {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          due = d.toISOString().slice(0,10);
        }
        rows.push({ idx: i + 1, type: 'תשלום חודשי', amount: each, date: due });
      }
    } else {
      rows.push({ idx: 1, type: exp.payment_type === 'עתידי' ? 'צפוי' : 'תשלום מלא', amount: total, date: exp.payment_date || null });
    }
    return rows;
  },

  _getPaidRowsSet(expenseId) {
    try { return new Set(JSON.parse(localStorage.getItem(this._paymentStateKey(expenseId)) || '[]')); }
    catch { return new Set(); }
  },

  _setPaidRowsSet(expenseId, set) {
    localStorage.setItem(this._paymentStateKey(expenseId), JSON.stringify([...set]));
  },

  _getExpensePaymentSummary(exp) {
    const isInstantPaid = exp.payment_type === 'חד פעמי' &&
      ['מזומן', 'אשראי', 'העברה', 'ביט'].includes(exp.payment_method);
    const rows = this._getExpensePaymentRows(exp);
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    if (isInstantPaid) {
      return { rows, paidSet: new Set(rows.map(r => r.idx)), total, paid: total, remaining: 0, status: 'שולם במלואו', isInstantPaid: true };
    }
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const manualPaid = this._getPaidRowsSet(exp.id);
    const paidSet = new Set(rows
      .filter(r => manualPaid.has(r.idx) || (r.date && new Date(r.date) <= today))
      .map(r => r.idx));
    const paid = rows.reduce((s, r) => s + (paidSet.has(r.idx) ? (Number(r.amount) || 0) : 0), 0);
    const remaining = Math.max(0, total - paid);
    const status = paid <= 0 ? 'טרם שולם' : remaining <= 0.01 ? 'שולם במלואו' : 'שולם חלקית';
    return { rows, paidSet, total, paid, remaining, status, isInstantPaid: false };
  },

  async markPaymentAsPaid(expenseId, paymentIdx) {
    const set = this._getPaidRowsSet(expenseId);
    set.add(paymentIdx);
    this._setPaidRowsSet(expenseId, set);
    const fresh = this._list.find(e => e.id === expenseId) || this._viewing;
    if (fresh) this.openView(fresh);
  },

  openView(exp) {
    try {
    this._viewing = exp;
    document.getElementById('view-exp-name').textContent = exp.name;
    const cat = CATEGORIES[exp.category] || { icon:'📦', color:'#9e9e9e' };
    const sum = this._getExpensePaymentSummary(exp);

    const METHOD_ICON = { 'אשראי':'credit_card', 'מזומן':'payments', 'העברה':'account_balance', 'ביט':'smartphone' };
    const methodIcon = METHOD_ICON[exp.payment_method] || 'payments';

    const headerCard = `
      <div class="rounded-2xl p-5 md:p-6 space-y-4 bg-gradient-to-br from-surface-container-high/80 via-surface-container/80 to-surface-container-low/90 border border-white/10 shadow-xl">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-2xl font-bold text-on-surface leading-tight truncate">${esc(exp.name)}</p>
            <div class="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-highest/70 text-on-surface-variant text-sm">
              <span class="text-base">${cat.icon}</span>
              <span>${esc(exp.category || 'אחר')}</span>
            </div>
          </div>
          <span class="text-xs px-3 py-1.5 rounded-full font-semibold bg-secondary/15 text-secondary">שולם</span>
        </div>
        <div>
          <p class="text-xs text-on-surface-variant mb-1">סכום</p>
          <p class="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">${Currency.fmtILS(sum.total)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
          <span class="inline-flex items-center gap-1 text-secondary font-medium">
            <span class="material-symbols-outlined text-base">check_circle</span>שולם במלואו
          </span>
          <span>•</span>
          <span class="inline-flex items-center gap-1">
            <span class="material-symbols-outlined text-base">${methodIcon}</span>${esc(exp.payment_method || '')}
          </span>
          <span>•</span>
          <span>חד פעמי</span>
        </div>
      </div>`;

    const statusClass = sum.status === 'שולם במלואו' ? 'bg-secondary/15 text-secondary' : sum.status === 'שולם חלקית' ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-error';
    const trackingCard = `
      <div class="rounded-2xl p-5 md:p-6 space-y-4 bg-gradient-to-br from-surface-container-high/80 via-surface-container/80 to-surface-container-low/90 border border-white/10 shadow-xl">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-2xl font-bold text-on-surface leading-tight truncate">${esc(exp.name)}</p>
            <div class="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-highest/70 text-on-surface-variant text-sm">
              <span class="text-base">${cat.icon}</span>
              <span>${esc(exp.category || 'אחר')}</span>
            </div>
          </div>
          <span class="text-xs px-3 py-1.5 rounded-full font-semibold ${statusClass}">${sum.status}</span>
        </div>
        <div>
          <p class="text-xs text-on-surface-variant mb-1">עלות כוללת</p>
          <p class="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">${Currency.fmtILS(sum.total)}</p>
        </div>
      </div>

      <div class="glass-card rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-on-surface text-base">סקירת תשלומים</h4>
          <span class="text-sm font-semibold text-on-surface-variant">${Math.round(sum.total ? (sum.paid / sum.total) * 100 : 0)}%</span>
        </div>
        <div class="h-2.5 bg-surface-container rounded-full overflow-hidden">
          <div class="h-full rounded-full bg-secondary-container" style="width:${Math.max(0, Math.min(100, sum.total ? (sum.paid / sum.total) * 100 : 0))}%"></div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-xl p-3 bg-secondary/10">
            <p class="text-xs text-on-surface-variant">שולם</p>
            <p class="font-bold text-secondary text-lg">${Currency.fmtILS(sum.paid)}</p>
          </div>
          <div class="rounded-xl p-3 bg-error/10">
            <p class="text-xs text-on-surface-variant">נותר</p>
            <p class="font-bold text-error text-lg">${Currency.fmtILS(sum.remaining)}</p>
          </div>
        </div>
      </div>

      <div class="pt-1">
        <h4 class="font-bold text-on-surface mb-3 text-base">לוח תשלומים</h4>
        <div class="space-y-3">
          ${sum.rows.map(r => {
            const paid = sum.paidSet.has(r.idx);
            return `<div class="relative rounded-2xl p-4 bg-surface-container/70 border border-white/5">
              <div class="absolute top-4 right-[-10px] w-2.5 h-2.5 rounded-full ${paid ? 'bg-secondary' : 'bg-error'}"></div>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-semibold text-on-surface">תשלום ${r.idx} — ${r.type}</p>
                  <p class="text-xs text-on-surface-variant mt-1">${r.date ? fmtDate(r.date) : 'ללא תאריך'}</p>
                </div>
                <span class="font-bold text-on-surface whitespace-nowrap">${Currency.fmtILS(r.amount)}</span>
              </div>
              <div class="mt-3 flex items-center justify-between">
                <span class="text-xs px-2.5 py-1 rounded-full font-medium ${paid ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'}">${paid ? 'שולם' : 'לא שולם'}</span>
                <button class="pay-row-btn px-3 py-1.5 rounded-full text-sm font-semibold ${paid ? 'bg-surface-container-high text-on-surface-variant cursor-default' : 'bg-primary-container text-on-primary-container active:scale-95 transition'}" data-exp-id="${exp.id}" data-row-idx="${r.idx}" ${paid ? 'disabled' : ''}>${paid ? 'שולם' : 'סמן כשולם'}</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    let html = sum.isInstantPaid ? headerCard : trackingCard;

    if (exp.location) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exp.location)}`;
      html += `<div class="pt-2"><h4 class="font-bold text-on-surface mb-1">מיקום</h4><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="glass-card rounded-xl p-3 text-sm text-on-surface flex items-center justify-between gap-3 hover:bg-surface-variant/30 active:scale-[0.99] transition cursor-pointer"><span class="inline-flex items-center gap-2 min-w-0"><span class="material-symbols-outlined text-primary text-base">location_on</span><span class="truncate">${esc(exp.location)}</span></span><span class="material-symbols-outlined text-on-surface-variant text-base">open_in_new</span></a></div>`;
    }
    if (exp.notes) html += `<div class="pt-2"><h4 class="font-bold text-on-surface mb-1">הערות</h4><div class="glass-card rounded-xl p-3 text-sm text-on-surface whitespace-pre-wrap">${esc(exp.notes)}</div></div>`;
    if (exp.link) {
      let displayUrl;
      try { displayUrl = new URL(exp.link).hostname.replace(/^www\./, ''); } catch { displayUrl = exp.link; }
      html += `<div class="pt-2"><h4 class="font-bold text-on-surface mb-1">קישור</h4><a href="${esc(exp.link)}" target="_blank" rel="noopener noreferrer" class="glass-card rounded-xl p-3 text-sm text-on-surface flex items-center justify-between gap-3 hover:bg-surface-variant/30 active:scale-[0.99] transition cursor-pointer"><span class="inline-flex items-center gap-2 min-w-0"><span class="material-symbols-outlined text-primary text-base">link</span><span class="truncate">${esc(displayUrl)}</span></span><span class="material-symbols-outlined text-on-surface-variant text-base">open_in_new</span></a></div>`;
    }
    if (exp.contact_name || exp.contact_phone) {
      const rawPhone = (exp.contact_phone || '').trim();
      const sanitizedPhone = rawPhone.replace(/[^\d+]/g, '');
      const digitsOnly = sanitizedPhone.replace(/\D/g, '');
      let waPhone = digitsOnly;
      if (waPhone.startsWith('0')) waPhone = `972${waPhone.slice(1)}`;
      if (sanitizedPhone.startsWith('+972')) waPhone = digitsOnly;
      const callHref = sanitizedPhone ? `tel:${sanitizedPhone}` : '';
      const waHref = waPhone ? `https://wa.me/${waPhone}` : '';

      html += `<div class="pt-2"><h4 class="font-bold text-on-surface mb-2">איש קשר</h4>
        <div class="glass-card rounded-xl p-3.5 space-y-3 text-sm text-on-surface">
          ${exp.contact_name ? `<div><p class="text-xs text-on-surface-variant mb-1">שם</p><p class="font-semibold">${esc(exp.contact_name)}</p></div>` : ''}
          ${rawPhone ? `<div><p class="text-xs text-on-surface-variant mb-1">טלפון</p><p dir="ltr" class="font-medium">${esc(rawPhone)}</p></div>` : ''}
          ${rawPhone ? `<div class="grid grid-cols-2 gap-2 pt-1">
            <a href="${callHref}" class="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 bg-primary-container text-on-primary-container font-semibold hover:opacity-90 active:scale-95 transition">
              <span class="material-symbols-outlined text-base">call</span><span>התקשר</span>
            </a>
            <a href="${waHref}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 bg-secondary-container text-on-secondary-container font-semibold hover:opacity-90 active:scale-95 transition">
              <span class="material-symbols-outlined text-base">chat</span><span>WhatsApp</span>
            </a>
          </div>` : ''}
        </div>
      </div>`;
    }

    const body = document.getElementById('view-expense-body');
    body.innerHTML = html;
    body.querySelectorAll('.pay-row-btn').forEach(btn => {
      btn.addEventListener('click', () => this.markPaymentAsPaid(btn.dataset.expId, Number(btn.dataset.rowIdx)));
    });
    body.querySelectorAll('.js-open-lightbox').forEach(el => {
      el.addEventListener('click', () => Lightbox.open(el.dataset.lightboxUrl));
    });
    App.openModal('modal-view-expense');
    } catch (err) { showToast('שגיאה בפתיחה: ' + err.message); }
  },

  async delete() {
    if (!this._viewing) return;
    if (!confirm(`למחוק את "${this._viewing.name}"?`)) return;
    try {
      await pb.delete(CONFIG.COLLECTIONS.EXPENSES, this._viewing.id);
      showToast('הוצאה נמחקה');
      App.closeModal('modal-view-expense');
      await this.loadForTrip(Trips.current.id);
    } catch (e) { showToast(`שגיאה: ${e.message}`); }
  },

  editCurrent() {
    App.closeModal('modal-view-expense');
    this.openModal(this._viewing);
  },

  calculateCategorySummary(expenses = this._list) {
    const rows = new Map();
    let total = 0;
    expenses.forEach(e => {
      const key = (e.category || '').trim() || 'אחר';
      const amount = Number(e.amount_ils) || 0;
      total += amount;
      rows.set(key, (rows.get(key) || 0) + amount);
    });
    return [...rows.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        pct: total ? (amount / total) * 100 : 0,
        style: CATEGORIES[name] || { icon: '📦', color: '#9e9e9e' },
      }))
      .sort((a, b) => b.amount - a.amount);
  },

  openCategories() {
    const body = document.getElementById('category-summary-body');
    const data = this.calculateCategorySummary();
    if (!data.length) {
      body.innerHTML = '<div class="text-center py-10 text-on-surface-variant">אין הוצאות להצגה</div>';
      App.openModal('modal-category-summary');
      return;
    }
    body.innerHTML = data.map(row => `
      <div class="glass-card rounded-xl p-4 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-9 h-9 rounded-full flex items-center justify-center text-lg" style="background:${row.style.color}22">${row.style.icon}</span>
            <span class="font-semibold text-on-surface truncate">${esc(row.name)}</span>
          </div>
          <div class="text-left">
            <div class="font-bold text-on-surface">${Currency.fmtILS(row.amount)}</div>
            <div class="text-xs text-on-surface-variant">${row.pct.toFixed(1)}%</div>
          </div>
        </div>
        <div class="h-2 bg-surface-container rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width:${Math.max(0, Math.min(100, row.pct))}%; background:${row.style.color}"></div>
        </div>
      </div>`).join('');
    App.openModal('modal-category-summary');
  },

  calculateFuturePayments(expenses = this._list) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const expanded = [];
    expenses.forEach(e => {
      const amount = Number(e.amount_ils) || 0;
      if (!amount) return;
      if (e.payment_type === 'עתידי' && e.payment_date) {
        expanded.push({ name: e.name, amount, date: e.payment_date, status: 'צפוי' });
      } else if (e.payment_type === 'מקדמה+יתרה') {
        const adv = Number(e.advance_amount) || 0;
        const remain = Math.max(0, amount - adv);
        if (remain > 0 && e.balance_date) expanded.push({ name: e.name, amount: remain, date: e.balance_date, status: 'יתרה' });
      } else if (e.payment_type === 'תשלומים') {
        const count = Math.max(1, Number(e.installments_count) || 1);
        const part = amount / count;
        const first = e.first_payment_date || e.payment_date;
        if (first) {
          const d = new Date(first);
          for (let i=0;i<count;i++) {
            const due = new Date(d);
            due.setMonth(due.getMonth()+i);
            expanded.push({ name: e.name, amount: part, date: due.toISOString().slice(0,10), status: 'צפוי' });
          }
        }
      }
    });
    const future = expanded.filter(x => x.date && new Date(x.date) >= today).sort((a,b)=>a.date.localeCompare(b.date));
    const byMonth = new Map();
    future.forEach(x => {
      const monthKey = x.date.slice(0,7);
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
      byMonth.get(monthKey).push(x);
    });
    return [...byMonth.entries()].map(([month, items]) => ({ month, items, total: items.reduce((s,i)=>s+i.amount,0) }));
  },

  openForecast() {
    const body = document.getElementById('forecast-body');
    const groups = this.calculateFuturePayments();
    if (!groups.length) {
      body.innerHTML = '<div class="text-center py-10 text-on-surface-variant">אין תשלומים עתידיים להצגה</div>';
      App.openModal('modal-forecast');
      return;
    }
    body.innerHTML = groups.map(g => {
      const d = new Date(`${g.month}-01`);
      const monthLabel = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
      return `<div class="space-y-2">
        <div class="flex items-center justify-between"><h4 class="font-bold text-on-surface">${monthLabel}</h4><span class="text-sm font-semibold text-secondary">${Currency.fmtILS(g.total)}</span></div>
        <div class="space-y-2">${g.items.map(i=>`<div class="glass-card rounded-xl p-3"><div class="flex justify-between items-start gap-2"><div><p class="font-medium text-on-surface">${esc(i.name)}</p><p class="text-xs text-on-surface-variant">${fmtDate(i.date)} • ${i.status}</p></div><p class="font-semibold text-on-surface">${Currency.fmtILS(i.amount)}</p></div></div>`).join('')}</div>
      </div>`;
    }).join('');
    App.openModal('modal-forecast');
  },

  _setCategoryValue(value) {
    const input = document.getElementById('exp-cat');
    const label = document.getElementById('exp-cat-label');
    const safeValue = value || '';
    if (input) input.value = safeValue;
    if (label) {
      if (!safeValue) {
        label.textContent = 'בחר קטגוריה';
        label.classList.add('text-on-surface-variant');
      } else {
        label.textContent = `${CATEGORIES[safeValue]?.icon || '📦'} ${safeValue}`;
        label.classList.remove('text-on-surface-variant');
      }
    }
  },

  _rebuildCategoryPills() {
    const container = document.getElementById('category-pills');
    const input = document.getElementById('exp-cat');
    const trigger = document.getElementById('exp-cat-trigger');
    const menu = document.getElementById('exp-cat-menu');
    if (!container || !input || !trigger || !menu) return;

    const current = input.value;
    menu.innerHTML = Object.entries(CATEGORIES).map(([name, def]) => `
      <button type="button" class="cat-option w-full px-4 py-2.5 text-sm text-right text-on-surface hover:bg-surface-variant/40 transition-colors" data-value="${name}" role="option">
        <span class="inline-flex items-center gap-2"><span>${def.icon}</span><span>${name}</span></span>
      </button>`).join('');

    menu.querySelectorAll('.cat-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this._setCategoryValue(btn.dataset.value || '');
        menu.classList.add('hidden');
        trigger.setAttribute('aria-expanded', 'false');
      });
    });

    if (!trigger.dataset.bound) {
      trigger.addEventListener('click', () => {
        const isOpen = menu.classList.toggle('hidden') === false;
        trigger.setAttribute('aria-expanded', String(isOpen));
      });
      trigger.dataset.bound = '1';
    }

    if (!container.dataset.bound) {
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          menu.classList.add('hidden');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
      container.dataset.bound = '1';
    }

    this._setCategoryValue(current || '');
  },

};

function todayStr() { return new Date().toISOString().slice(0,10); }
