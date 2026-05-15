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
    return `
      <div class="glass-card rounded-lg p-5 cursor-pointer active:scale-[0.98] transition-transform trip-card" data-id="${trip.id}">
        <div class="flex justify-between items-start mb-3">
          <div>
            <p class="font-bold text-lg text-on-surface">${esc(trip.name)}</p>
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
    try {
      if (this._editing) {
        await pb.update(CONFIG.COLLECTIONS.TRIPS, this._editing.id, data);
        // update current if we're editing the open trip
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

  setCurrent(trip) {
    this._current = trip;
    document.getElementById('trip-header-title').textContent = trip.name;
  },
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'numeric' });
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
