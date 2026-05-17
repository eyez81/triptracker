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
    el.innerHTML = `<div class="space-y-2">${this._filtered.map(e => this._itemHTML(e)).join('')}</div>`;
  },

  _itemHTML(e) {
    const { color: catColor, icon: catIcon, msIcon } = getCatStyle(e.category);
    const isInstantPaid = e.payment_type === 'חד פעמי' && ['מזומן', 'אשראי', 'העברה', 'ביט'].includes(e.payment_method);
    const isTracking = e.payment_type === 'תשלומים' || e.payment_type === 'מקדמה+יתרה';

    const iconHTML = msIcon
      ? `<span class="material-symbols-outlined" style="font-size:22px;color:#fff;font-variation-settings:'FILL' 1">${msIcon}</span>`
      : `<span style="font-size:22px;line-height:1">${catIcon}</span>`;

    let badge = '';
    if (e.payment_type === 'עתידי') {
      badge = `<span style="background:rgba(139,92,246,0.18);color:#c4b5fd;border:1px solid rgba(139,92,246,0.25);font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap">עתידי</span>`;
    } else if (isInstantPaid) {
      badge = `<span style="background:rgba(74,222,128,0.14);color:#4ade80;border:1px solid rgba(74,222,128,0.22);font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap">✓ שולם</span>`;
    } else if (isTracking) {
      const sum = this._getExpensePaymentSummary(e);
      const isFullyPaid = sum.remaining <= 0.01;
      const isPartial = sum.paid > 0 && !isFullyPaid;
      if (isFullyPaid) {
        badge = `<span style="background:rgba(74,222,128,0.14);color:#4ade80;border:1px solid rgba(74,222,128,0.22);font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap">✓ שולם</span>`;
      } else if (isPartial) {
        badge = `<span style="background:rgba(45,212,191,0.14);color:#2dd4bf;border:1px solid rgba(45,212,191,0.22);font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap">תשלום חלקי</span>`;
      } else {
        badge = `<span style="background:rgba(239,68,68,0.14);color:#f87171;border:1px solid rgba(239,68,68,0.22);font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap">טרם שולם</span>`;
      }
    }

    const sub = [esc(e.category || 'אחר'), e.payment_date ? fmtDate(e.payment_date) : ''].filter(Boolean).join(' · ');

    return `
      <div data-id="${e.id}" onclick="Expenses._click(this.dataset.id)"
           style="position:relative;overflow:hidden;cursor:pointer;border-radius:16px;
                  background:linear-gradient(135deg,rgba(255,255,255,0.065) 0%,rgba(255,255,255,0.022) 100%);
                  border:1px solid rgba(255,255,255,0.08);
                  box-shadow:0 2px 12px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.08);
                  padding:14px;display:flex;align-items:center;gap:12px;
                  min-height:72px;box-sizing:border-box;
                  font-family:'Heebo',sans-serif;transition:transform 0.1s ease,opacity 0.1s ease"
           onpointerdown="this.style.transform='scale(0.99)';this.style.opacity='0.9'"
           onpointerup="this.style.transform='';this.style.opacity=''"
           onpointerleave="this.style.transform='';this.style.opacity=''">

        <div style="position:absolute;top:0;right:0;width:60%;height:100%;background:radial-gradient(ellipse 100% 140% at 95% 0%,${catColor}18 0%,transparent 65%);pointer-events:none"></div>

        <!-- Icon (rightmost in RTL) -->
        <div style="position:relative;width:44px;height:44px;flex-shrink:0;border-radius:12px;background:${catColor};display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.22)">
          ${iconHTML}
        </div>

        <!-- Name + sub -->
        <div style="position:relative;flex:1;min-width:0">
          <p style="font-size:16px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2">${esc(e.name)}</p>
          <p style="font-size:11px;color:rgba(255,255,255,0.38);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</p>
        </div>

        <!-- Amount + badge on same row (leftmost in RTL); direction:ltr keeps amount left, badge right -->
        <div style="position:relative;flex-shrink:0;display:flex;align-items:center;gap:8px;direction:ltr">
          <p style="font-size:19px;font-weight:800;color:#fff;letter-spacing:-0.02em;line-height:1;white-space:nowrap">${Currency.fmtILS(e.amount_ils)}</p>
          ${badge}
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
    const { color: catColor, icon: catIcon, msIcon: catMs } = getCatStyle(exp.category);
    const sum = this._getExpensePaymentSummary(exp);

    const METHOD_ICON = { 'אשראי':'credit_card', 'מזומן':'payments', 'העברה':'account_balance', 'ביט':'smartphone' };
    const methodIcon = METHOD_ICON[exp.payment_method] || 'payments';

    const catCircle = `<div style="width:22px;height:22px;border-radius:50%;background:${catColor};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${catMs ? `<span class="material-symbols-outlined" style="font-size:12px;color:#fff;font-variation-settings:'FILL' 1">${catMs}</span>` : `<span style="font-size:10px">${catIcon}</span>`}</div>`;

    const infoRow = (icon, text, href = null) => {
      const inner = `
        <div style="width:38px;height:38px;border-radius:50%;background:rgba(45,212,191,0.1);border:1px solid rgba(45,212,191,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span class="material-symbols-outlined" style="font-size:18px;color:#2dd4bf;font-variation-settings:'FILL' 1">${icon}</span>
        </div>
        <span class="flex-1 text-sm" style="color:rgba(255,255,255,0.82);direction:auto;white-space:pre-wrap;word-break:break-word">${text}</span>
        ${href ? `<span class="material-symbols-outlined flex-shrink-0" style="font-size:15px;color:rgba(255,255,255,0.28)">open_in_new</span>` : ''}
      `;
      return href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 rounded-2xl p-3.5 active:scale-[0.99] transition" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07)">${inner}</a>`
        : `<div class="flex items-center gap-3 rounded-2xl p-3.5" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07)">${inner}</div>`;
    };

    const secLabel = (text) => `<p style="font-size:11px;font-weight:600;color:rgba(45,212,191,0.75);margin-bottom:6px;text-align:right">${text}</p>`;

    const headerCard = `
      <div class="rounded-2xl overflow-hidden" style="background:linear-gradient(150deg,#0a1628 0%,#0d1f38 60%,#091825 100%)">
        <div class="p-5 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p style="font-size:22px;font-weight:800;color:#fff;line-height:1.2">${esc(exp.name)}</p>
              <div class="flex items-center gap-1.5 mt-1">
                ${catCircle}
                <span style="font-size:12px;color:rgba(255,255,255,0.42)">${esc(exp.category || 'אחר')}</span>
              </div>
            </div>
            <span style="font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;background:rgba(74,222,128,0.15);color:#4ade80;white-space:nowrap;flex-shrink:0">שולם ✓</span>
          </div>
          <div>
            <p style="font-size:11px;color:rgba(255,255,255,0.36);margin-bottom:3px">סכום</p>
            <p style="font-size:38px;font-weight:800;color:#fff;line-height:1;letter-spacing:-0.02em">${Currency.fmtILS(sum.total)}</p>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1" style="font-size:12px;color:rgba(255,255,255,0.42)">
            <span class="flex items-center gap-1" style="color:#4ade80">
              <span class="material-symbols-outlined" style="font-size:13px;font-variation-settings:'FILL' 1">check_circle</span>שולם במלואו
            </span>
            <span>•</span>
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined" style="font-size:13px">${methodIcon}</span>${esc(exp.payment_method || '')}
            </span>
            <span>•</span>
            <span>חד פעמי</span>
          </div>
        </div>
      </div>`;

    const statusColor = sum.status === 'שולם במלואו' ? '#4ade80' : sum.status === 'שולם חלקית' ? '#2dd4bf' : '#f87171';
    const statusBg = sum.status === 'שולם במלואו' ? 'rgba(74,222,128,0.15)' : sum.status === 'שולם חלקית' ? 'rgba(45,212,191,0.15)' : 'rgba(248,113,113,0.15)';
    const trackingCard = `
      <div class="rounded-2xl overflow-hidden" style="background:linear-gradient(150deg,#0a1628 0%,#0d1f38 60%,#091825 100%)">
        <div class="p-5 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p style="font-size:22px;font-weight:800;color:#fff;line-height:1.2">${esc(exp.name)}</p>
              <div class="flex items-center gap-1.5 mt-1">
                ${catCircle}
                <span style="font-size:12px;color:rgba(255,255,255,0.42)">${esc(exp.category || 'אחר')}</span>
              </div>
            </div>
            <span style="font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;background:${statusBg};color:${statusColor};white-space:nowrap;flex-shrink:0">${sum.status}</span>
          </div>
          <div>
            <p style="font-size:11px;color:rgba(255,255,255,0.36);margin-bottom:3px">עלות כוללת</p>
            <p style="font-size:38px;font-weight:800;color:#fff;line-height:1;letter-spacing:-0.02em">${Currency.fmtILS(sum.total)}</p>
          </div>
        </div>
      </div>

      <div class="rounded-2xl p-4 space-y-3" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07)">
        <div class="flex items-center justify-between">
          <h4 style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.85)">סקירת תשלומים</h4>
          <span style="font-size:13px;font-weight:700;color:#2dd4bf">${Math.round(sum.total ? (sum.paid / sum.total) * 100 : 0)}%</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:99px;overflow:hidden">
          <div style="height:4px;border-radius:99px;background:linear-gradient(to left,#2dd4bf,#2563eb);width:${Math.max(0,Math.min(100,sum.total?(sum.paid/sum.total)*100:0))}%"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl p-3" style="background:rgba(45,212,191,0.08);border:1px solid rgba(45,212,191,0.12)">
            <p style="font-size:10px;color:rgba(255,255,255,0.42);font-weight:600">שולם</p>
            <p style="font-size:17px;font-weight:800;color:#2dd4bf;margin-top:2px">${Currency.fmtILS(sum.paid)}</p>
          </div>
          <div class="rounded-xl p-3" style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.12)">
            <p style="font-size:10px;color:rgba(255,255,255,0.42);font-weight:600">נותר</p>
            <p style="font-size:17px;font-weight:800;color:#f87171;margin-top:2px">${Currency.fmtILS(sum.remaining)}</p>
          </div>
        </div>
      </div>

      <div>
        <button id="schedule-toggle-${exp.id}" class="w-full flex items-center justify-between gap-2" style="background:none;border:none;cursor:pointer;padding:10px 0;border-top:1px solid rgba(255,255,255,0.07)">
          <span class="material-symbols-outlined" id="schedule-chevron-${exp.id}" style="font-size:20px;color:rgba(255,255,255,0.4);transition:transform 0.25s">expand_more</span>
          <span class="flex items-center gap-2" style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.85)">
            <span class="material-symbols-outlined" style="font-size:16px;color:rgba(255,255,255,0.45);font-variation-settings:'FILL' 1">event_note</span>
            לוח תשלומים · ${sum.rows.length} תשלומים
          </span>
        </button>
        <div id="schedule-panel-${exp.id}" class="space-y-2" style="display:none;margin-top:4px">
          ${sum.rows.map(r => {
            const paid = sum.paidSet.has(r.idx);
            return `<div class="rounded-2xl p-4" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07)">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.9)">תשלום ${r.idx} — ${r.type}</p>
                  <p style="font-size:12px;color:rgba(255,255,255,0.38);margin-top:2px">${r.date ? fmtDate(r.date) : 'ללא תאריך'}</p>
                </div>
                <span style="font-size:15px;font-weight:800;color:${paid ? '#2dd4bf' : '#f87171'};white-space:nowrap;direction:ltr">${Currency.fmtILS(r.amount)}</span>
              </div>
              <div class="flex items-center justify-between mt-3">
                <span style="font-size:11px;padding:3px 10px;border-radius:20px;font-weight:600;${paid ? 'background:rgba(45,212,191,0.12);color:#2dd4bf' : 'background:rgba(248,113,113,0.12);color:#f87171'}">${paid ? 'שולם' : 'לא שולם'}</span>
                <button class="pay-row-btn px-4 py-1.5 rounded-full text-sm font-semibold active:scale-95 transition"
                  style="${paid ? 'background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.38);cursor:default' : 'background:rgba(45,212,191,0.13);color:#2dd4bf;border:1px solid rgba(45,212,191,0.22)'}"
                  data-exp-id="${exp.id}" data-row-idx="${r.idx}" ${paid ? 'disabled' : ''}>${paid ? 'שולם' : 'סמן כשולם'}</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    let html = sum.isInstantPaid ? headerCard : trackingCard;

    if (exp.location) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exp.location)}`;
      html += `<div>${secLabel('מיקום')}${infoRow('location_on', esc(exp.location), mapsUrl)}</div>`;
    }
    if (exp.notes) {
      html += `<div>${secLabel('הערות')}${infoRow('chat', esc(exp.notes))}</div>`;
    }
    if (exp.link) {
      let displayUrl;
      try { displayUrl = new URL(exp.link).hostname.replace(/^www\./, ''); } catch { displayUrl = exp.link; }
      html += `<div>${secLabel('קישור')}${infoRow('link', esc(displayUrl), esc(exp.link))}</div>`;
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

      html += `
        <div>
          ${secLabel('איש קשר')}
          <div class="rounded-2xl p-4 space-y-3" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07)">
            <div class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                ${exp.contact_name ? `<p style="font-size:15px;font-weight:700;color:#fff">${esc(exp.contact_name)}</p>` : ''}
                ${rawPhone ? `<div class="flex items-center gap-1 mt-0.5"><span class="material-symbols-outlined" style="font-size:13px;color:rgba(45,212,191,0.55)">phone</span><p dir="ltr" style="font-size:13px;color:rgba(255,255,255,0.48)">${esc(rawPhone)}</p></div>` : ''}
              </div>
              <div style="width:44px;height:44px;border-radius:50%;background:rgba(45,212,191,0.1);border:1px solid rgba(45,212,191,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <span class="material-symbols-outlined" style="font-size:22px;color:#2dd4bf;font-variation-settings:'FILL' 1">person</span>
              </div>
            </div>
            ${rawPhone ? `<div class="grid grid-cols-2 gap-2">
              <a href="${waHref}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center gap-2 rounded-full py-2.5 font-semibold active:scale-95 transition" style="background:rgba(37,211,102,0.12);color:#25d366;border:1px solid rgba(37,211,102,0.2)">
                <span class="material-symbols-outlined" style="font-size:17px">chat</span>ווטסאפ
              </a>
              <a href="${callHref}" class="flex items-center justify-center gap-2 rounded-full py-2.5 font-semibold active:scale-95 transition" style="background:rgba(96,165,250,0.12);color:#60a5fa;border:1px solid rgba(96,165,250,0.2)">
                <span class="material-symbols-outlined" style="font-size:17px">call</span>חייג
              </a>
            </div>` : ''}
          </div>
        </div>`;
    }
    if (exp.receipt) {
      const receiptUrl = pb.fileUrl(exp, exp.receipt);
      const isPdf = exp.receipt.toLowerCase().endsWith('.pdf');
      html += `
        <div>
          ${secLabel('קבלה')}
          <div class="flex items-center gap-3 rounded-2xl p-3.5 cursor-pointer js-open-lightbox active:scale-[0.99] transition" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07)" data-lightbox-url="${receiptUrl}">
            <div style="width:38px;height:38px;border-radius:50%;background:rgba(45,212,191,0.1);border:1px solid rgba(45,212,191,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <span class="material-symbols-outlined" style="font-size:18px;color:#2dd4bf;font-variation-settings:'FILL' 1">${isPdf ? 'picture_as_pdf' : 'image'}</span>
            </div>
            ${isPdf ? `<span style="font-size:13px;color:rgba(255,255,255,0.7)">PDF</span>` : `<img src="${receiptUrl}" alt="קבלה" class="rounded-xl object-cover" style="height:52px;max-width:140px;object-fit:cover"/>`}
          </div>
        </div>`;
    }

    const body = document.getElementById('view-expense-body');
    body.innerHTML = html;
    body.querySelectorAll('.pay-row-btn').forEach(btn => {
      btn.addEventListener('click', () => this.markPaymentAsPaid(btn.dataset.expId, Number(btn.dataset.rowIdx)));
    });
    const scheduleToggle = body.querySelector('#schedule-toggle-' + exp.id);
    if (scheduleToggle) {
      scheduleToggle.addEventListener('click', () => {
        const panel   = document.getElementById('schedule-panel-'   + exp.id);
        const chevron = document.getElementById('schedule-chevron-' + exp.id);
        if (!panel) return;
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'block';
        if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
      });
    }
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
        style: getCatStyle(name),
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

    const total = data.reduce((s, r) => s + r.amount, 0);
    const avg   = data.length ? total / data.length : 0;

    // ── Header: 3 stats ──
    const summaryHeader = `
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,0.25)">
        <div style="display:flex;align-items:stretch;gap:0">
          <!-- RIGHT: total (first in RTL HTML) -->
          <div style="flex:1;min-width:0">
            <p style="font-size:11px;color:rgba(255,255,255,0.38);margin-bottom:5px;white-space:nowrap">סה"כ הוצאות</p>
            <div style="display:flex;align-items:center;gap:5px">
              <span class="material-symbols-outlined" style="font-size:18px;color:rgba(255,255,255,0.45);font-variation-settings:'FILL' 1">account_balance_wallet</span>
              <span style="font-size:22px;font-weight:800;color:#fff;direction:ltr">${Currency.fmtILS(total)}</span>
            </div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,0.08);margin:0 12px"></div>
          <!-- CENTER: count -->
          <div style="flex:0 0 auto;text-align:center">
            <p style="font-size:11px;color:rgba(255,255,255,0.38);margin-bottom:5px">קטגוריות</p>
            <div style="display:flex;align-items:center;justify-content:center;gap:5px">
              <span class="material-symbols-outlined" style="font-size:18px;color:rgba(255,255,255,0.45);font-variation-settings:'FILL' 1">shopping_bag</span>
              <span style="font-size:22px;font-weight:800;color:#fff">${data.length}</span>
            </div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,0.08);margin:0 12px"></div>
          <!-- LEFT: average (last in RTL HTML) -->
          <div style="flex:1;min-width:0;text-align:left">
            <p style="font-size:11px;color:rgba(255,255,255,0.38);margin-bottom:5px;white-space:nowrap">הוצאה ממוצעת לקטגוריה</p>
            <div style="display:flex;align-items:center;justify-content:flex-start;gap:5px">
              <span class="material-symbols-outlined" style="font-size:18px;color:rgba(255,255,255,0.45);font-variation-settings:'FILL' 1">bar_chart</span>
              <span style="font-size:20px;font-weight:800;color:rgba(255,255,255,0.82);direction:ltr">${Currency.fmtILS(avg)}</span>
            </div>
          </div>
        </div>
      </div>`;

    // ── Category rows ──
    const rows = data.map((row) => {
      const msIcon = row.style.msIcon;
      const iconHTML = msIcon
        ? `<span class="material-symbols-outlined" style="font-size:22px;color:#fff;font-variation-settings:'FILL' 1">${msIcon}</span>`
        : `<span style="font-size:20px;line-height:1">${row.style.icon}</span>`;

      return `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,0.25)">
          <div style="display:flex;align-items:center;gap:12px">

            <!-- RIGHT column: icon + name + amount + progress bar (first in RTL) -->
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;align-items:center;gap:10px">
                <!-- Icon (rightmost) -->
                <div style="width:44px;height:44px;flex-shrink:0;border-radius:12px;background:${row.style.color};display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.22)">
                  ${iconHTML}
                </div>
                <!-- Name -->
                <span style="flex:1;font-size:17px;font-weight:600;color:rgba(255,255,255,0.9);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(row.name)}</span>
                <!-- Amount -->
                <span style="font-size:22px;font-weight:700;color:#fff;direction:ltr;flex-shrink:0">${Currency.fmtILS(row.amount)}</span>
              </div>
              <!-- Progress bar (RTL: fills from right) -->
              <div style="position:relative;height:6px;background:rgba(255,255,255,0.07);border-radius:99px;overflow:hidden">
                <div style="position:absolute;right:0;top:0;height:6px;border-radius:99px;background:${row.style.color};width:${Math.max(0,Math.min(100,row.pct))}%;box-shadow:0 0 8px ${row.style.color}99"></div>
              </div>
            </div>

            <!-- LEFT column: percentage + subtitle (last in RTL = leftmost) -->
            <div style="flex-shrink:0;min-width:52px;text-align:left">
              <p style="font-size:22px;font-weight:700;color:${row.style.color};line-height:1.1">${row.pct.toFixed(1)}%</p>
              <p style="font-size:12px;color:rgba(255,255,255,0.32);margin-top:3px">מהסך הכל</p>
            </div>

          </div>
        </div>`;
    }).join('');

    body.innerHTML = summaryHeader + rows;
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
        label.innerHTML = 'בחר קטגוריה';
        label.classList.add('text-on-surface-variant');
      } else {
        const { color, icon, msIcon } = getCatStyle(safeValue);
        const iconInner = msIcon
          ? `<span class="material-symbols-outlined" style="font-size:13px;color:#fff;font-variation-settings:'FILL' 1;line-height:1">${msIcon}</span>`
          : `<span style="font-size:13px;line-height:1">${icon}</span>`;
        label.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:7px;background:${color};flex-shrink:0;box-shadow:inset 0 1px 0 rgba(255,255,255,0.18)">${iconInner}</span><span>${esc(safeValue)}</span></span>`;
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
    menu.innerHTML = Object.entries(CATEGORIES).map(([name]) => {
      const { color, icon, msIcon } = getCatStyle(name);
      const iconInner = msIcon
        ? `<span class="material-symbols-outlined" style="font-size:16px;color:#fff;font-variation-settings:'FILL' 1">${msIcon}</span>`
        : `<span style="font-size:16px;line-height:1">${icon}</span>`;
      return `<button type="button" class="cat-option w-full flex items-center gap-3 px-4 py-3 transition-colors" data-value="${esc(name)}" role="option" style="border-bottom:1px solid rgba(255,255,255,0.05)">
        <div style="width:32px;height:32px;flex-shrink:0;border-radius:9px;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.18)">
          ${iconInner}
        </div>
        <span style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.88)">${esc(name)}</span>
      </button>`;
    }).join('');

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
