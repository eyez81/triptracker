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

  _render() {
    const el = document.getElementById('expenses-list');
    if (!this._filtered.length) {
      el.innerHTML = `<div class="text-center py-12 text-on-surface-variant">
        <span class="material-symbols-outlined text-5xl block mb-3">receipt_long</span>
        <p>אין הוצאות להצגה</p></div>`;
      return;
    }
    el.innerHTML = this._filtered.map(e => this._itemHTML(e)).join('');
    el.querySelectorAll('.expense-item').forEach(item => {
      item.addEventListener('click', () => {
        const exp = this._list.find(e => e.id === item.dataset.id);
        if (exp) this.openView(exp);
      });
    });
  },

  _itemHTML(e) {
    const cat = CATEGORIES[e.category] || { icon:'📦', color:'#9e9e9e' };
    const isInstantPaid = e.payment_type === 'חד פעמי' && ['מזומן', 'אשראי', 'העברה', 'ביט'].includes(e.payment_method);
    const isTracking = e.payment_type === 'תשלומים' || e.payment_type === 'מקדמה+יתרה';

    // For עתידי we skip the type chip since the status badge says "צפוי" already
    const showTypeChip = e.payment_type !== 'עתידי';
    const TYPE_LABELS = { 'חד פעמי':'חד פעמי', 'תשלומים':'תשלומים', 'מקדמה+יתרה':'מקדמה+יתרה' };
    const typeChip = showTypeChip
      ? `<span class="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">${TYPE_LABELS[e.payment_type] || e.payment_type}</span>`
      : '';

    let accentColor = 'rgba(255,255,255,0.08)';
    let statusHTML = '';
    let progressHTML = '';

    if (isInstantPaid) {
      accentColor = 'rgba(111,207,151,0.5)';
      statusHTML = `<span class="inline-flex items-center gap-1 text-xs font-semibold bg-secondary/20 text-secondary px-2 py-0.5 rounded-full"><span class="material-symbols-outlined text-xs" style="font-variation-settings:'FILL' 1">check_circle</span>שולם • ${esc(e.payment_method)}</span>`;
    } else if (e.payment_type === 'עתידי') {
      accentColor = 'rgba(100,130,220,0.5)';
      statusHTML = `<span class="text-xs font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">צפוי</span>`;
    } else if (isTracking) {
      const sum = this._getExpensePaymentSummary(e);
      const pct = sum.total > 0 ? Math.round((sum.paid / sum.total) * 100) : 0;
      const isFullyPaid = sum.remaining <= 0.01;
      const isPartial = sum.paid > 0 && !isFullyPaid;
      accentColor = isFullyPaid ? 'rgba(111,207,151,0.5)' : isPartial ? 'rgba(242,153,74,0.5)' : 'rgba(239,68,68,0.4)';
      const statusLabel = isFullyPaid ? 'שולם במלואו' : isPartial ? 'שולם חלקית' : 'טרם שולם';
      const statusCls = isFullyPaid ? 'bg-secondary/20 text-secondary' : isPartial ? 'bg-tertiary/20 text-tertiary' : 'bg-error/15 text-error';
      const ringCls = isFullyPaid ? 'text-secondary' : isPartial ? 'text-tertiary' : 'text-on-surface-variant';
      const dash = Math.min(pct, 100);
      statusHTML = `<span class="text-xs font-semibold ${statusCls} px-2 py-0.5 rounded-full">${statusLabel}</span>`;
      progressHTML = `
        <div class="flex items-center gap-2.5 mt-2">
          <div class="relative w-9 h-9 flex-shrink-0 ${ringCls}">
            <svg class="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" stroke-width="3" opacity="0.25"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" stroke-width="3"
                stroke-dasharray="${dash} ${100 - dash}" stroke-linecap="round"/>
            </svg>
            <span class="absolute inset-0 flex items-center justify-center font-bold leading-none" style="font-size:8px">${pct}%</span>
          </div>
          <span class="text-sm text-on-surface-variant">שולם <span class="font-bold text-on-surface">${Currency.fmtILS(sum.paid)}</span> מתוך ${Currency.fmtILS(sum.total)}</span>
        </div>`;
    }

    // Meta icons — sit on a dedicated compact row only if any exist
    const metaList = [
      e.receipt                           ? `<span class="material-symbols-outlined text-base" title="קבלה">receipt_long</span>` : '',
      e.link                              ? `<span class="material-symbols-outlined text-base" title="קישור">link</span>` : '',
      e.location                          ? `<span class="material-symbols-outlined text-base" title="מיקום">location_on</span>` : '',
      (e.contact_name || e.contact_phone) ? `<span class="material-symbols-outlined text-base" title="איש קשר">contact_phone</span>` : '',
    ].filter(Boolean);
    const metaHTML = metaList.length
      ? `<div class="flex items-center gap-2 mt-1.5 text-on-surface-variant/60">${metaList.join('')}</div>`
      : '';

    const origStr = e.currency !== 'ILS' ? `<span class="text-xs text-on-surface-variant">${Currency.fmt(e.amount, e.currency, 2)}</span>` : '';

    return `
      <div class="glass-card rounded-2xl active:scale-[0.99] transition-transform cursor-pointer expense-item overflow-hidden"
           data-id="${e.id}" style="border-right: 3px solid ${accentColor}">
        <div class="flex items-start gap-3 px-4 py-3.5">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5" style="background:${cat.color}22">${cat.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <p class="font-bold text-base text-on-surface leading-snug truncate">${esc(e.name)}</p>
              <div class="text-left flex-shrink-0 ml-1">
                <p class="font-extrabold text-error text-lg leading-tight">${Currency.fmtILS(e.amount_ils)}-</p>
                ${origStr}
              </div>
            </div>
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span class="text-sm text-on-surface-variant">${esc(e.category || 'אחר')}</span>
              ${e.payment_date ? `<span class="text-sm text-on-surface-variant">• ${fmtDate(e.payment_date)}</span>` : ''}
              ${typeChip}
              ${statusHTML}
            </div>
            ${metaHTML}
            ${progressHTML}
          </div>
        </div>
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
    fill.style.width = `${Math.min(pct,100)}%`;
    fill.className = `absolute inset-y-0 right-0 h-full rounded-full transition-all duration-500 ${
      pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-tertiary' : 'bg-secondary-container'
    }`;
    const pctEl = document.getElementById('budget-pct');
    pctEl.textContent = budget ? `${pct}%` : '';
    pctEl.className = `font-semibold text-sm whitespace-nowrap ${pct >= 100 ? 'text-error' : pct >= 80 ? 'text-tertiary' : 'text-secondary'}`;

    const s = trip?.start_date ? fmtDate(trip.start_date) : '';
    const en = trip?.end_date ? fmtDate(trip.end_date) : '';
    document.getElementById('sum-dates').textContent = s && en ? `${s} – ${en}` : s;
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
      </div>`;

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
      const phone = exp.contact_phone || '';
      const waPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^0/, '972');
      html += `<div class="pt-2">
        <h4 class="font-bold text-on-surface mb-2">איש קשר</h4>
        <div class="glass-card rounded-xl p-4 space-y-3">
          ${exp.contact_name ? `<div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-base">person</span>
            <span class="text-sm font-semibold text-on-surface">${esc(exp.contact_name)}</span>
          </div>` : ''}
          ${phone ? `<div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-on-surface-variant text-base">call</span>
            <span class="text-sm text-on-surface-variant" dir="ltr">${esc(phone)}</span>
          </div>` : ''}
          ${phone ? `<div class="flex gap-2 pt-1">
            <a href="tel:${esc(phone)}" class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full bg-primary-container text-on-primary-container text-sm font-semibold active:scale-95 transition">
              <span class="material-symbols-outlined text-base">call</span> חייג
            </a>
            <a href="https://wa.me/${waPhone}" target="_blank" rel="noopener noreferrer" class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold active:scale-95 transition">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              וואטסאפ
            </a>
          </div>` : ''}
        </div>
      </div>`;
    }
    if (exp.receipt) {
      const fileUrl = pb.fileUrl(exp, exp.receipt);
      const isImage = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i.test(exp.receipt.split('?')[0]);
      if (isImage) {
        html += `<div class="pt-2">
          <h4 class="font-bold text-on-surface mb-2">קבלה</h4>
          <div class="relative group cursor-zoom-in rounded-2xl overflow-hidden glass-card p-2 js-open-lightbox" data-lightbox-url="${esc(fileUrl)}">
            <img src="${fileUrl}" class="w-full rounded-xl object-contain max-h-56 transition-transform duration-300 group-hover:scale-[1.02]" alt="קבלה" loading="lazy"/>
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20 rounded-xl pointer-events-none">
              <div class="bg-black/50 rounded-full p-2.5 backdrop-blur-sm">
                <span class="material-symbols-outlined text-white text-3xl">zoom_in</span>
              </div>
            </div>
          </div>
        </div>`;
      } else {
        html += `<div class="pt-2">
          <h4 class="font-bold text-on-surface mb-2">קבלה</h4>
          <a href="${fileUrl}" target="_blank" rel="noopener noreferrer"
            class="glass-card rounded-xl p-3 text-sm text-on-surface flex items-center justify-between gap-3 hover:bg-surface-variant/30 active:scale-[0.99] transition cursor-pointer">
            <span class="inline-flex items-center gap-2 min-w-0">
              <span class="material-symbols-outlined text-primary text-base">description</span>
              <span class="truncate">${esc(exp.receipt.split('?')[0].split('/').pop())}</span>
            </span>
            <span class="material-symbols-outlined text-on-surface-variant text-base flex-shrink-0">open_in_new</span>
          </a>
        </div>`;
      }
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
