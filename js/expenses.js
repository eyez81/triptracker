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

  _statusTag(e) {
    if (e.payment_type === 'עתידי') return `<span class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">עתידי</span>`;
    if (e.is_paid) return `<span class="text-xs bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">שולם ✓</span>`;
    if (e.payment_type === 'מקדמה+יתרה') return `<span class="text-xs bg-tertiary/10 text-tertiary px-2 py-0.5 rounded-full">תשלום חלקי</span>`;
    if (e.payment_type === 'תשלומים') return `<span class="text-xs bg-outline/20 text-on-surface-variant px-2 py-0.5 rounded-full">תשלומים</span>`;
    return '';
  },

  _itemHTML(e) {
    const cat = CATEGORIES[e.category] || { icon:'📦', color:'#9e9e9e' };
    const origStr = e.currency !== 'ILS' ? `<span class="text-xs text-on-surface-variant">${Currency.fmt(e.amount, e.currency, 2)}</span>` : '';
    return `
      <div class="glass-card p-4 rounded-xl flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer expense-item" data-id="${e.id}">
        <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style="background:${cat.color}22">${cat.icon}</div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-on-surface truncate">${esc(e.name)}</p>
          <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span class="text-xs text-on-surface-variant">${esc(e.category)}</span>
            ${e.payment_date ? `<span class="text-xs text-on-surface-variant">• ${fmtDate(e.payment_date)}</span>` : ''}
            ${this._statusTag(e)}
          </div>
        </div>
        <div class="text-left flex-shrink-0">
          <p class="font-bold ${e.is_paid ? 'text-on-surface-variant line-through' : 'text-error'}">${Currency.fmtILS(e.amount_ils)}-</p>
          ${origStr}
        </div>
        <span class="material-symbols-outlined text-on-surface-variant text-base flex-shrink-0">chevron_left</span>
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

    // סה"כ התחייבויות (כולל עתידי)
    const totalCommitted = this._list.reduce((s,e) => s + (Number(e.amount_ils)||0), 0);
    const sumCommit = document.getElementById('sum-committed');
    if (sumCommit) sumCommit.textContent = Currency.fmtILS(totalCommitted);

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

  // ===== CATEGORIES MODAL =====
  openCategories() {
    const actual = this._list.filter(e => e.payment_type !== 'עתידי');
    const total = actual.reduce((s,e) => s + (Number(e.amount_ils)||0), 0);
    const bycat = {};
    actual.forEach(e => { bycat[e.category] = (bycat[e.category]||0) + (Number(e.amount_ils)||0); });
    const sorted = Object.entries(bycat).sort((a,b) => b[1]-a[1]);

    const colors = ['#4f8ef7','#38c9a0','#f5a623','#7b5ea7','#e05252','#3cb8e0','#8bc34a','#9e9e9e'];
    const html = sorted.map(([cat, amt], i) => {
      const def = CATEGORIES[cat] || { icon:'📦' };
      const pct = total > 0 ? Math.round((amt/total)*100) : 0;
      return `
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="flex items-center gap-2 font-medium text-on-surface">${def.icon} ${esc(cat)}</span>
            <div class="text-left">
              <span class="font-bold text-on-surface">${Currency.fmtILS(amt)}</span>
              <span class="text-on-surface-variant text-xs mr-2">(${pct}%)</span>
            </div>
          </div>
          <div class="h-2 bg-surface-container rounded-full overflow-hidden">
            <div class="h-full rounded-full" style="width:${pct}%;background:${colors[i%colors.length]}"></div>
          </div>
        </div>`;
    }).join('');

    document.getElementById('categories-modal-body').innerHTML = html || '<p class="text-on-surface-variant text-center py-4">אין נתונים</p>';
    App.openModal('modal-categories');
  },

  // ===== FORECAST MODAL =====
  openForecast() {
    const items = [];
    this._list.forEach(e => {
      if (e.payment_type === 'עתידי' && !e.is_paid) {
        items.push({ name: e.name, amount: e.amount_ils, date: e.payment_date, method: e.payment_method, type: 'תשלום עתידי', color: 'text-primary' });
      } else if (e.payment_type === 'מקדמה+יתרה' && e.balance_date && !e.is_paid) {
        const adv = (e.advance_amount || 0) * (e.exchange_rate || 1);
        const bal = (e.amount_ils || 0) - adv;
        if (bal > 0) items.push({ name: `${e.name} (יתרה)`, amount: bal, date: e.balance_date, method: e.balance_method, type: 'יתרה לתשלום', color: 'text-tertiary' });
      } else if (e.payment_type === 'תשלומים' && e.installments_count > 1 && !e.is_paid) {
        const per = (e.amount_ils||0) / e.installments_count;
        items.push({ name: `${e.name} (${e.installments_count} תשלומים)`, amount: per * (e.installments_count-1), date: e.first_payment_date, method: e.payment_method, type: 'תשלומים', color: 'text-secondary' });
      }
    });
    items.sort((a,b) => new Date(a.date||0) - new Date(b.date||0));

    const total = items.reduce((s,i) => s + (i.amount||0), 0);
    let html = `<div class="flex justify-between items-center p-3 bg-surface-container rounded-xl mb-4">
      <span class="text-on-surface-variant text-sm">סה"כ תשלומים צפויים</span>
      <span class="font-bold text-primary">${Currency.fmtILS(total)}</span>
    </div>`;

    if (!items.length) {
      html += '<p class="text-on-surface-variant text-center py-4">אין תשלומים עתידיים</p>';
    } else {
      html += items.map(item => `
        <div class="glass-card p-4 rounded-xl mb-3">
          <div class="flex justify-between items-start">
            <div>
              <p class="font-semibold text-on-surface">${esc(item.name)}</p>
              <p class="text-xs text-on-surface-variant mt-0.5">${item.date ? fmtDate(item.date) : 'תאריך לא ידוע'} ${item.method ? `• ${item.method}` : ''}</p>
            </div>
            <div class="text-left">
              <p class="font-bold ${item.color}">${Currency.fmtILS(item.amount)}</p>
              <p class="text-xs text-on-surface-variant">${item.type}</p>
            </div>
          </div>
        </div>`).join('');
    }

    document.getElementById('forecast-modal-body').innerHTML = html;
    App.openModal('modal-forecast');
  },

  // ===== MODAL ADD/EDIT =====
  openModal(expense = null) {
    this._editing = expense;
    document.getElementById('modal-expense-title').textContent = expense ? 'עריכת הוצאה' : 'הוצאה חדשה';

    document.getElementById('exp-name').value = expense?.name || '';
    document.getElementById('exp-amount').value = expense?.amount || '';
    document.getElementById('exp-currency').value = expense?.currency || localStorage.getItem('default_currency') || 'ILS';
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

    document.querySelectorAll('input[name="exp-cat"]').forEach(r => { r.checked = r.value === (expense?.category || ''); });
    document.querySelectorAll('input[name="payment_type"]').forEach(r => { r.checked = r.value === (expense?.payment_type || 'חד פעמי'); });
    this._updatePaymentTypeUI(expense?.payment_type || 'חד פעמי');
    document.querySelectorAll('input[name="payment_method"]').forEach(r => { r.checked = r.value === (expense?.payment_method || 'אשראי'); });

    document.getElementById('receipt-preview').classList.add('hidden');
    document.getElementById('exp-receipt').value = '';
    if (expense?.receipt) {
      const img = document.getElementById('receipt-preview');
      img.src = pb.fileUrl(expense, expense.receipt);
      img.classList.remove('hidden');
    }

    this._updateCurrencyUI(expense?.currency || localStorage.getItem('default_currency') || 'ILS');
    App.openModal('modal-expense');
  },

  _updatePaymentTypeUI(type) {
    document.getElementById('installments-extra').classList.toggle('hidden', type !== 'תשלומים');
    document.getElementById('advance-extra').classList.toggle('hidden', type !== 'מקדמה+יתרה');
    const pmMethod = document.getElementById('payment-method-section');
    if (pmMethod) pmMethod.classList.toggle('hidden', type === 'מקדמה+יתרה');
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
    const category = document.querySelector('input[name="exp-cat"]:checked')?.value;
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
      payment_method: paymentType === 'מקדמה+יתרה' ? null : paymentMethod,
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
      advance_method: paymentType === 'מקדמה+יתרה' ? document.getElementById('exp-advance-method').value : null,
      balance_method: paymentType === 'מקדמה+יתרה' ? document.getElementById('exp-balance-method').value : null,
      balance_date: document.getElementById('exp-balance-date').value || null,
      user: pb.userId,
    };

    try {
      const file = document.getElementById('exp-receipt').files[0];
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

  // ===== VIEW — עיצוב מחדש =====
  openView(exp) {
    this._viewing = exp;
    const cat = CATEGORIES[exp.category] || { icon:'📦', color:'#9e9e9e' };
    document.getElementById('view-exp-name').textContent = exp.name;

    // סטטוס
    let statusHTML = '';
    if (exp.is_paid) {
      statusHTML = `<span class="inline-flex items-center gap-1 text-xs bg-secondary/15 text-secondary px-3 py-1 rounded-full font-medium">✓ שולם במלואו</span>`;
    } else if (exp.payment_type === 'עתידי') {
      statusHTML = `<span class="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">🕐 תשלום עתידי</span>`;
    } else if (exp.payment_type === 'מקדמה+יתרה' && exp.advance_amount) {
      statusHTML = `<span class="inline-flex items-center gap-1 text-xs bg-tertiary/10 text-tertiary px-3 py-1 rounded-full font-medium">◑ תשלום חלקי</span>`;
    } else if (exp.payment_type === 'תשלומים') {
      statusHTML = `<span class="inline-flex items-center gap-1 text-xs bg-outline/20 text-on-surface-variant px-3 py-1 rounded-full font-medium">📅 תשלומים</span>`;
    }

    // כותרת עם אייקון
    let headerHTML = `
      <div class="flex items-center gap-3 mb-4 pb-4 border-b border-white/5">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style="background:${cat.color}22">${cat.icon}</div>
        <div class="flex-1">
          <p class="text-xs text-on-surface-variant">${esc(exp.category)} • ${exp.payment_type}</p>
          ${exp.currency !== 'ILS' ? `<p class="text-xs text-on-surface-variant">${Currency.fmt(exp.amount, exp.currency, 2)} • שער ${exp.exchange_rate}</p>` : ''}
        </div>
        ${statusHTML}
      </div>`;

    // שולם / יתרה בהתאם לסוג תשלום
    let paymentDetailsHTML = '';
    if (exp.payment_type === 'מקדמה+יתרה' && exp.advance_amount) {
      const advILS = (exp.advance_amount || 0) * (exp.exchange_rate || 1);
      const balILS = (exp.amount_ils || 0) - advILS;
      paymentDetailsHTML = `
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="bg-secondary/10 rounded-xl p-3 text-center">
            <p class="text-xs text-on-surface-variant mb-1">שולם (מקדמה)</p>
            <p class="font-bold text-secondary text-lg">${Currency.fmtILS(advILS)}</p>
            ${exp.advance_date ? `<p class="text-xs text-on-surface-variant">${fmtDate(exp.advance_date)}</p>` : ''}
          </div>
          <div class="bg-${exp.is_paid ? 'secondary' : 'error'}/10 rounded-xl p-3 text-center">
            <p class="text-xs text-on-surface-variant mb-1">יתרה</p>
            <p class="font-bold text-${exp.is_paid ? 'secondary' : 'error'} text-lg">${Currency.fmtILS(Math.max(balILS,0))}</p>
            ${exp.balance_date ? `<p class="text-xs text-on-surface-variant">צפוי ${fmtDate(exp.balance_date)}</p>` : ''}
          </div>
        </div>`;
    } else if (exp.payment_type === 'תשלומים' && exp.installments_count) {
      const per = (exp.amount_ils||0) / exp.installments_count;
      // בנה פריסת תשלומים
      let installRows = '';
      for (let i = 0; i < exp.installments_count; i++) {
        let installDate = '';
        if (exp.first_payment_date) {
          const d = new Date(exp.first_payment_date);
          d.setMonth(d.getMonth() + i);
          installDate = fmtDate(d.toISOString());
        }
        installRows += `<div class="flex justify-between items-center py-2 border-b border-white/5 text-sm">
          <span class="text-on-surface-variant">תשלום ${i+1} מתוך ${exp.installments_count}</span>
          <div class="text-left">
            <span class="font-semibold text-on-surface">${Currency.fmtILS(per)}</span>
            ${installDate ? `<span class="text-xs text-on-surface-variant mr-2">${installDate}</span>` : ''}
          </div>
        </div>`;
      }
      paymentDetailsHTML = `
        <div class="bg-surface-container rounded-xl p-4 mb-4">
          <div class="flex justify-between mb-3">
            <span class="text-sm font-semibold text-on-surface">פריסת תשלומים</span>
            <span class="text-sm text-on-surface-variant">סה"כ: ${Currency.fmtILS(exp.amount_ils)}</span>
          </div>
          ${installRows}
        </div>`;
    } else {
      paymentDetailsHTML = `
        <div class="bg-surface-container rounded-xl p-4 mb-4 text-center">
          <p class="text-xs text-on-surface-variant mb-1">סכום</p>
          <p class="font-bold text-on-surface text-2xl">${Currency.fmtILS(exp.amount_ils)}</p>
        </div>`;
    }

    // שורות פרטים
    const row = (label, val, isLink) => val ? `
      <div class="flex justify-between py-2.5 border-b border-white/5 text-sm">
        <span class="text-on-surface-variant">${label}</span>
        <span class="font-medium text-on-surface text-left mr-3 max-w-[60%] truncate">${isLink ? `<a href="${val}" target="_blank" class="text-primary underline">${esc(val)}</a>` : esc(String(val))}</span>
      </div>` : '';

    let detailsHTML = '';
    detailsHTML += row('תאריך', exp.payment_date ? fmtDate(exp.payment_date) : null);
    if (exp.payment_type === 'תשלומים') detailsHTML += row('תאריך ראשון', exp.first_payment_date ? fmtDate(exp.first_payment_date) : null);
    if (exp.payment_method) detailsHTML += row('אמצעי תשלום', exp.payment_method);
    if (exp.payment_type === 'מקדמה+יתרה') {
      if (exp.advance_method) detailsHTML += row('תשלום מקדמה', exp.advance_method);
      if (exp.balance_method) detailsHTML += row('תשלום יתרה', exp.balance_method);
    }
    detailsHTML += row('מיקום', exp.location);
    detailsHTML += row('קישור', exp.link, true);
    detailsHTML += row('הערות', exp.notes);

    // איש קשר
    let contactHTML = '';
    if (exp.contact_name || exp.contact_phone) {
      if (exp.contact_name) detailsHTML += row('איש קשר', exp.contact_name);
      if (exp.contact_phone) {
        let phone = exp.contact_phone.replace(/[\s\-]/g, '');
        if (phone.startsWith('0')) phone = '+972' + phone.slice(1);
        const waPhone = phone.replace('+', '');
        contactHTML = `
          <div class="flex gap-2 mt-3">
            <a href="tel:${phone}" class="flex-1 py-2.5 glass-card rounded-xl text-center text-sm text-on-surface flex items-center justify-center gap-1.5 active:scale-95 transition font-medium">
              <span class="material-symbols-outlined text-base">call</span> חייג
            </a>
            <a href="https://wa.me/${waPhone}" target="_blank" class="flex-1 py-2.5 glass-card rounded-xl text-center text-sm text-[#25D366] flex items-center justify-center gap-1.5 active:scale-95 transition font-medium">
              💬 WhatsApp
            </a>
          </div>`;
      }
    }

    // קבלה
    let receiptHTML = '';
    if (exp.receipt) {
      receiptHTML = `<img src="${pb.fileUrl(exp, exp.receipt)}" class="w-full rounded-xl max-h-48 object-contain mt-3" alt="קבלה"/>`;
    }

    // כפתור סמן כשולם — רק לעתידי ומקדמה+יתרה
    const markPaidBtn = document.getElementById('btn-mark-paid');
    if (markPaidBtn) {
      const showMark = exp.payment_type === 'עתידי' || exp.payment_type === 'מקדמה+יתרה';
      markPaidBtn.classList.toggle('hidden', !showMark);
      if (showMark) {
        markPaidBtn.textContent = exp.is_paid ? '↩ בטל סימון שולם' : '✓ סמן כשולם במלואו';
        markPaidBtn.className = 'w-full py-3 rounded-full font-semibold text-sm transition active:scale-95 ' + (exp.is_paid ? 'bg-surface-container text-on-surface-variant border border-white/10' : 'bg-secondary/15 text-secondary border border-secondary/30');
      }
    }

    document.getElementById('view-expense-body').innerHTML = headerHTML + paymentDetailsHTML + detailsHTML + contactHTML + receiptHTML;
    App.openModal('modal-view-expense');
  },

  async markPaid() {
    if (!this._viewing) return;
    const newVal = !this._viewing.is_paid;
    try {
      await pb.update(CONFIG.COLLECTIONS.EXPENSES, this._viewing.id, { is_paid: newVal });
      showToast(newVal ? 'סומן כשולם ✓' : 'בוטל סימון שולם');
      App.closeModal('modal-view-expense');
      await this.loadForTrip(Trips.current.id);
    } catch (e) { showToast(`שגיאה: ${e.message}`); }
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
};

function todayStr() { return new Date().toISOString().slice(0,10); }
