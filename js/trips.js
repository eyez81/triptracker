const Trips = {
  _list: [],
  _current: null,
  _editing: null,
  get current() { return this._current; },

  async load() {
    document.getElementById('trips-loading').classList.remove('hidden');
    document.getElementById('trips-empty').classList.add('hidden');
    document.getElementById('trips-upcoming').innerHTML = '';
    document.getElementById('trips-past').innerHTML = '';
    try {
      const res = await pb.list(CONFIG.COLLECTIONS.TRIPS, { sort: '-start_date', perPage: 50 });
      this._list = res.items || [];
      await this._render();
    } catch (e) {
      showToast('שגיאה בטעינת טיולים');
    } finally {
      document.getElementById('trips-loading').classList.add('hidden');
    }
  },

  async _render() {
    const now = new Date();
    const upcoming = this._list.filter(t => !t.end_date || new Date(t.end_date) >= now);
    const past = this._list.filter(t => t.end_date && new Date(t.end_date) < now);

    if (!this._list.length) {
      document.getElementById('trips-empty').classList.remove('hidden');
      document.getElementById('trips-upcoming-section').classList.add('hidden');
      document.getElementById('trips-past-section').classList.add('hidden');
      return;
    }
    document.getElementById('trips-upcoming-section').classList.toggle('hidden', !upcoming.length);
    document.getElementById('trips-past-section').classList.toggle('hidden', !past.length);

    const renderCards = async (items, containerId) => {
      const el = document.getElementById(containerId);
      const htmls = await Promise.all(items.map(t => this._cardHTML(t)));
      el.innerHTML = htmls.join('');
      el.querySelectorAll('.trip-card').forEach(c => {
        c.addEventListener('click', () => {
          const trip = this._list.find(t => t.id === c.dataset.id);
          if (trip) App.openTrip(trip);
        });
      });
    };
    await renderCards(upcoming, 'trips-upcoming');
    await renderCards(past, 'trips-past');
  },

  async _cardHTML(trip) {
    const budget = Number(trip.budget) || 0;
    let spent = 0;
    try {
      const res = await pb.list(CONFIG.COLLECTIONS.EXPENSES, {
        filter: `trip="${trip.id}" && payment_type != "עתידי"`, perPage: 500
      });
      spent = (res.items||[]).reduce((s,e) => s + (Number(e.amount_ils)||0), 0);
    } catch {}
    const pct = budget > 0 ? Math.round((spent/budget)*100) : 0;
    const barColor = pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-tertiary' : 'bg-secondary-container';
    const pctColor = pct >= 100 ? 'text-error' : pct >= 80 ? 'text-tertiary' : 'text-secondary';
    const start = trip.start_date ? fmtDate(trip.start_date) : '';
    const end = trip.end_date ? fmtDate(trip.end_date) : '';
    const dates = start && end ? `${start} – ${end}` : start || '';
    const isOwner = trip.owner_id === pb.userId;
    const sharedBadge = !isOwner
      ? `<span class="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full">שותף</span>`
      : '';
    return `
      <div class="glass-card rounded-lg p-5 cursor-pointer active:scale-[0.98] transition-transform trip-card" data-id="${trip.id}">
        <div class="flex justify-between items-start mb-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-bold text-lg text-on-surface">${esc(trip.name)}</p>
              ${sharedBadge}
            </div>
            ${trip.destination ? `<p class="text-on-surface-variant text-sm mt-0.5">📍 ${esc(trip.destination)}</p>` : ''}
          </div>
          <div class="flex items-center gap-1 text-on-surface-variant text-xs mt-1">
            <span class="material-symbols-outlined text-base">calendar_month</span> ${dates}
          </div>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between items-end">
            <div>
              <p class="text-xs text-on-surface-variant">תקציב שנוצל</p>
              <p class="font-semibold text-on-surface">${Currency.fmtILS(spent)} / ${Currency.fmtILS(budget)}</p>
            </div>
            <span class="font-semibold text-sm ${pctColor}">${pct}%</span>
          </div>
          <div class="w-full bg-white/5 h-2 rounded-full overflow-hidden">
            <div class="${barColor} h-full rounded-full" style="width:${Math.min(pct,100)}%"></div>
          </div>
        </div>
      </div>`;
  },

  openModal(trip = null) {
    this._editing = trip;
    document.getElementById('modal-trip-title').textContent = trip ? 'עריכת טיול' : 'טיול חדש';
    document.getElementById('trip-name').value = trip?.name || '';
    document.getElementById('trip-start').value = trip?.start_date?.slice(0,10) || '';
    document.getElementById('trip-end').value = trip?.end_date?.slice(0,10) || '';
    document.getElementById('trip-budget').value = trip?.budget || '';
    document.getElementById('trip-destination').value = trip?.destination || '';
    // הצג/הסתר כפתור מחיקה
    const delBtn = document.getElementById('btn-delete-trip');
    if (delBtn) delBtn.classList.toggle('hidden', !trip);
    App.openModal('modal-trip');
  },

  async save() {
    const name = document.getElementById('trip-name').value.trim();
    if (!name) { showToast('נא להזין שם טיול'); return; }
    const data = {
      name,
      start_date: document.getElementById('trip-start').value || null,
      end_date: document.getElementById('trip-end').value || null,
      budget: Number(document.getElementById('trip-budget').value) || 0,
      destination: document.getElementById('trip-destination').value.trim(),
      user: pb.userId,
    };
    if (!this._editing) data.owner_id = pb.userId;
    try {
      if (this._editing) {
        await pb.update(CONFIG.COLLECTIONS.TRIPS, this._editing.id, data);

        if (this._current?.id === this._editing.id) {
          this._current = { ...this._current, ...data };
          document.getElementById('trip-header-title').textContent = data.name;
        }
        showToast('הטיול עודכן ✓');
      } else {
        await pb.create(CONFIG.COLLECTIONS.TRIPS, data);
        showToast('הטיול נוסף ✓');
      }
      App.closeModal('modal-trip');
      await this.load();
    } catch (e) { showToast(`שגיאה: ${e.message}`); }
  },

  async deleteTrip() {
    if (!this._editing) return;
    if (!confirm(`למחוק את הטיול "${this._editing.name}"?\nכל ההוצאות ימחקו גם כן.`)) return;
    try {
      // מחק קודם את כל ההוצאות של הטיול
      const res = await pb.list(CONFIG.COLLECTIONS.EXPENSES, {
        filter: `trip="${this._editing.id}"`, perPage: 500
      });
      for (const exp of (res.items || [])) {
        await pb.delete(CONFIG.COLLECTIONS.EXPENSES, exp.id);
      }
      // מחק חברי שיתוף
      const members = await pb.list(CONFIG.COLLECTIONS.TRIP_MEMBERS, {
        filter: `trip_id="${this._editing.id}"`, perPage: 100
      });
      for (const m of (members.items || [])) {
        await pb.delete(CONFIG.COLLECTIONS.TRIP_MEMBERS, m.id);
      }
      await pb.delete(CONFIG.COLLECTIONS.TRIPS, this._editing.id);
      showToast('הטיול נמחק');
      App.closeModal('modal-trip');
      await App.goToTrips();
    } catch (e) { showToast(`שגיאה: ${e.message}`); }
  },

  setCurrent(trip) {
    this._current = trip;
    document.getElementById('trip-header-title').textContent = trip.name;
    const isOwner = trip.owner_id === pb.userId;
    const shareBtn = document.getElementById('btn-share-trip');
    if (shareBtn) shareBtn.classList.toggle('hidden', !isOwner);
  },

  async openShareModal() {
    const trip = this._current;
    if (!trip) return;
    document.getElementById('share-email-input').value = '';
    document.getElementById('share-error').classList.add('hidden');
    await this._renderMembers();
    App.openModal('modal-share-trip');
  },

  async _renderMembers() {
    const trip = this._current;
    const el = document.getElementById('share-members-list');
    el.innerHTML = '<p class="text-xs text-on-surface-variant">טוען...</p>';
    try {
      const res = await pb.list(CONFIG.COLLECTIONS.TRIP_MEMBERS, {
        filter: `trip_id="${trip.id}"`, perPage: 100
      });
      const members = res.items || [];
      if (!members.length) {
        el.innerHTML = '<p class="text-xs text-on-surface-variant text-center py-2">אין משתתפים משותפים עדיין</p>';
        return;
      }
      const memberHTMLs = await Promise.all(members.map(async m => {
        let email = m.user_id;
        try {
          const u = await pb.get('users', m.user_id);
          email = u.email || m.user_id;
        } catch {}
        return `
          <div class="flex items-center justify-between py-2 border-b border-white/5">
            <div class="flex items-center gap-2 min-w-0">
              <span class="material-symbols-outlined text-on-surface-variant text-base">person</span>
              <span class="text-sm text-on-surface truncate">${esc(email)}</span>
              <span class="text-[10px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">${m.role === 'editor' ? 'עורך' : 'צופה'}</span>
            </div>
            <button class="remove-member-btn text-error text-xs px-2 py-1 rounded-full hover:bg-error/10 transition active:scale-95" data-member-id="${m.id}">
              <span class="material-symbols-outlined text-base">person_remove</span>
            </button>
          </div>`;
      }));
      el.innerHTML = memberHTMLs.join('');
      el.querySelectorAll('.remove-member-btn').forEach(btn => {
        btn.addEventListener('click', () => this._removeMember(btn.dataset.memberId));
      });
    } catch (e) {
      el.innerHTML = `<p class="text-xs text-error">שגיאה: ${e.message}</p>`;
    }
  },

  async shareWithEmail() {
    const email = document.getElementById('share-email-input').value.trim().toLowerCase();
    const errEl = document.getElementById('share-error');
    errEl.classList.add('hidden');
    if (!email) { errEl.textContent = 'נא להזין אימייל'; errEl.classList.remove('hidden'); return; }
    const btn = document.getElementById('btn-do-share');
    btn.textContent = 'מחפש...';
    btn.disabled = true;
    try {
      const res = await pb.list('users', { filter: `email="${email}"`, perPage: 1 });
      const user = res.items?.[0];
      if (!user) {
        errEl.textContent = 'משתמש לא נמצא במערכת';
        errEl.classList.remove('hidden');
        return;
      }
      if (user.id === pb.userId) {
        errEl.textContent = 'לא ניתן לשתף עם עצמך';
        errEl.classList.remove('hidden');
        return;
      }
      const existing = await pb.list(CONFIG.COLLECTIONS.TRIP_MEMBERS, {
        filter: `trip_id="${this._current.id}" && user_id="${user.id}"`, perPage: 1
      });
      if (existing.items?.length) {
        errEl.textContent = 'המשתמש כבר שותף בטיול';
        errEl.classList.remove('hidden');
        return;
      }
      await pb.create(CONFIG.COLLECTIONS.TRIP_MEMBERS, {
        trip_id: this._current.id,
        user_id: user.id,
        role: 'viewer',
      });
      document.getElementById('share-email-input').value = '';
      showToast(`הטיול שותף עם ${email} ✓`);
      await this._renderMembers();
    } catch (e) {
      errEl.textContent = `שגיאה: ${e.message}`;
      errEl.classList.remove('hidden');
    } finally {
      btn.textContent = 'שתף';
      btn.disabled = false;
    }
  },

  async _removeMember(memberId) {
    if (!confirm('להסיר את המשתתף מהטיול?')) return;
    try {
      await pb.delete(CONFIG.COLLECTIONS.TRIP_MEMBERS, memberId);
      showToast('המשתתף הוסר');
      await this._renderMembers();
    } catch (e) { showToast(`שגיאה: ${e.message}`); }
  },
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'numeric' });
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
