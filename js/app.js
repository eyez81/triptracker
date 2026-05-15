const App = {
  _prevScreen: 'trips',
  _theme: localStorage.getItem('theme') || 'dark',

  async init() {
    this._applyTheme(this._theme);
    try {
      const r = await fetch('http://192.168.0.176:8090/api/health', { signal: AbortSignal.timeout(1500) });
      if (r.ok) CONFIG.PB_URL = 'http://192.168.0.176:8090';
    } catch {}
    this._bind();
    if (pb.isAuth) await this.goToTrips();
    else this.showScreen('auth');
  },

  _applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'system') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.toggle('dark', dark);
      html.classList.toggle('light', !dark);
    } else {
      html.classList.toggle('dark', theme === 'dark');
      html.classList.toggle('light', theme === 'light');
    }
    this._theme = theme;
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-btn').forEach(b => {
      b.classList.toggle('bg-primary-container', b.dataset.theme === theme);
      b.classList.toggle('text-on-primary-container', b.dataset.theme === theme);
      b.classList.toggle('bg-surface-container-highest', b.dataset.theme !== theme);
      b.classList.toggle('text-on-surface-variant', b.dataset.theme !== theme);
    });
  },

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
  },

  async goToTrips() {
    this._prevScreen = 'trips';
    this.showScreen('trips');
    await Trips.load();
  },

  async openTrip(trip) {
    this._prevScreen = 'trip';
    Trips.setCurrent(trip);
    this.showScreen('trip');
    await Expenses.loadForTrip(trip.id);
  },

  openSettings() { this.showScreen('settings'); },

  openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = '';
  },

  _bindEl(id, event, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  },

  _bind() {
    this._bindEl('btn-login', 'click', () => this._login());
    this._bindEl('auth-password', 'keydown', e => { if (e.key === 'Enter') this._login(); });
    this._bindEl('btn-logout', 'click', () => this._logout());
    this._bindEl('btn-add-trip', 'click', () => Trips.openModal());
    this._bindEl('btn-save-trip', 'click', () => Trips.save());
    this._bindEl('btn-delete-trip', 'click', () => Trips.deleteTrip()); // optional
    this._bindEl('btn-back-trips', 'click', () => this.goToTrips());
    this._bindEl('btn-add-expense', 'click', () => Expenses.openModal());
    this._bindEl('btn-save-expense', 'click', () => Expenses.save());
    this._bindEl('btn-export-excel', 'click', () => ExcelExport.export(Trips.current, Expenses._list));
    this._bindEl('btn-edit-trip', 'click', () => Trips.openModal(Trips.current));
    this._bindEl('btn-show-categories', 'click', () => Expenses.openCategories());
    this._bindEl('btn-show-forecast', 'click', () => Expenses.openForecast());
    this._bindEl('btn-delete-expense', 'click', () => Expenses.delete());
    this._bindEl('btn-edit-expense', 'click', () => Expenses.editCurrent());
    this._bindEl('btn-mark-paid', 'click', () => Expenses.markPaid());
    this._bindEl('nav-settings-trips', 'click', e => { e.preventDefault(); this.openSettings(); });
    this._bindEl('nav-settings-trip', 'click', e => { e.preventDefault(); this.openSettings(); });
    this._bindEl('nav-trips-from-settings', 'click', e => { e.preventDefault(); this.goToTrips(); });
    this._bindEl('nav-trips-from-trip', 'click', e => { e.preventDefault(); this.goToTrips(); });
    this._bindEl('btn-back-from-settings', 'click', () => this.showScreen(this._prevScreen));
    this._bindEl('btn-export-all', 'click', () => showToast('ייצוא כל הטיולים בקרוב...'));

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => this._applyTheme(btn.dataset.theme));
    });

    document.querySelectorAll('.currency-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.currency-btn').forEach(b => {
          b.className = b.className.replace('bg-primary-container text-on-primary-container border-primary-container', 'bg-surface-container-highest text-on-surface-variant border-transparent');
        });
        btn.className = btn.className.replace('bg-surface-container-highest text-on-surface-variant border-transparent', 'bg-primary-container text-on-primary-container border-primary-container');
        localStorage.setItem('default_currency', btn.dataset.currency);
        showToast(`מטבע ברירת מחדל: ${btn.dataset.currency}`);
      });
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.close));
    });
    document.querySelectorAll('[id^="modal-"]').forEach(overlay => {
      overlay.addEventListener('click', e => { if (e.target === overlay) this.closeModal(overlay.id); });
    });

    this._bindEl('exp-currency', 'change', e => { Expenses._updateCurrencyUI(e.target.value); });
    this._bindEl('btn-fetch-rate', 'click', () => Expenses.fetchRate());
    this._bindEl('exp-amount', 'input', () => Expenses._updateILSPreview());
    this._bindEl('exp-rate', 'input', () => Expenses._updateILSPreview());

    document.querySelectorAll('input[name="payment_type"]').forEach(r => {
      r.addEventListener('change', () => Expenses._updatePaymentTypeUI(r.value));
    });

    this._bindEl('expense-search', 'input', () => Expenses._applyFilters());
    this._bindEl('btn-filter', 'click', () => {
      document.getElementById('filter-panel').classList.toggle('hidden');
    });

    this._bindEl('btn-camera', 'click', () => {
      const fi = document.getElementById('exp-receipt');
      fi.setAttribute('capture', 'environment');
      fi.setAttribute('accept', 'image/*');
      fi.click();
    });
    this._bindEl('btn-gallery', 'click', () => {
      const fi = document.getElementById('exp-receipt');
      fi.removeAttribute('capture');
      fi.setAttribute('accept', 'image/*,application/pdf');
      fi.click();
    });
    this._bindEl('exp-receipt', 'change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = document.getElementById('receipt-preview');
        img.src = ev.target.result;
        img.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('[id^="modal-"]').forEach(m => {
          if (!m.classList.contains('hidden')) this.closeModal(m.id);
        });
      }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this._theme === 'system') this._applyTheme('system');
    });
  },

  async _login() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('btn-login');
    errEl.classList.add('hidden');
    btn.textContent = 'מתחבר...';
    btn.disabled = true;
    try {
      await pb.login(email, password);
      await this.goToTrips();
    } catch {
      errEl.textContent = 'אימייל או סיסמה שגויים';
      errEl.classList.remove('hidden');
    } finally {
      btn.textContent = 'התחברות';
      btn.disabled = false;
    }
  },

  _logout() {
    pb.logout();
    this.showScreen('auth');
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
  },
};

function showToast(msg, duration = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), duration);
}

document.addEventListener('DOMContentLoaded', () => App.init());
