const App = {
  _prevScreen: 'trips',

  async init() {
    this._bind();
    if (pb.isAuth) {
      await this.goToTrips();
    } else {
      this.showScreen('auth');
    }
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

  openSettings() {
    this.showScreen('settings');
  },

  openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = '';
  },

  _bind() {
    // Auth
    document.getElementById('btn-login').addEventListener('click', () => this._login());
    document.getElementById('auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') this._login(); });
    document.getElementById('btn-logout').addEventListener('click', () => this._logout());

    // Trips
    document.getElementById('btn-add-trip').addEventListener('click', () => Trips.openModal());
    document.getElementById('btn-save-trip').addEventListener('click', () => Trips.save());

    // Trip detail
    document.getElementById('btn-back-trips').addEventListener('click', () => this.goToTrips());
    document.getElementById('btn-add-expense').addEventListener('click', () => Expenses.openModal());
    document.getElementById('btn-save-expense').addEventListener('click', () => Expenses.save());
    document.getElementById('btn-export-excel').addEventListener('click', () => ExcelExport.export(Trips.current, Expenses._list));
    document.getElementById('btn-edit-trip').addEventListener('click', () => Trips.openModal(Trips.current));

    // View expense
    document.getElementById('btn-delete-expense').addEventListener('click', () => Expenses.delete());
    document.getElementById('btn-edit-expense').addEventListener('click', () => Expenses.editCurrent());

    // Settings nav
    document.getElementById('nav-settings-trips').addEventListener('click', e => { e.preventDefault(); this.openSettings(); });
    document.getElementById('nav-settings-trip').addEventListener('click', e => { e.preventDefault(); this.openSettings(); });
    document.getElementById('nav-trips-from-settings').addEventListener('click', e => { e.preventDefault(); this.goToTrips(); });
    document.getElementById('nav-trips-from-trip').addEventListener('click', e => { e.preventDefault(); this.goToTrips(); });
    document.getElementById('btn-back-from-settings').addEventListener('click', () => this.showScreen(this._prevScreen));

    // Settings actions
    document.getElementById('btn-export-all').addEventListener('click', async () => {
      showToast('ייצוא כל הטיולים בקרוב...');
    });
    document.getElementById('btn-change-password').addEventListener('click', () => {
      showToast('שינוי סיסמה — פנה ל-PocketBase Admin');
    });

    // Currency buttons in settings
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

    // Close modal via data-close
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.close));
    });

    // Close modal on overlay click
    document.querySelectorAll('[id^="modal-"]').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) this.closeModal(overlay.id);
      });
    });

    // Currency change in expense form
    document.getElementById('exp-currency').addEventListener('change', e => {
      Expenses._updateCurrencyUI(e.target.value);
    });

    // Rate fetch
    document.getElementById('btn-fetch-rate').addEventListener('click', () => Expenses.fetchRate());

    // Amount/rate preview
    document.getElementById('exp-amount').addEventListener('input', () => Expenses._updateILSPreview());
    document.getElementById('exp-rate').addEventListener('input', () => Expenses._updateILSPreview());

    // Payment type change
    document.querySelectorAll('input[name="payment_type"]').forEach(r => {
      r.addEventListener('change', () => Expenses._updatePaymentTypeUI(r.value));
    });

    // Search
    document.getElementById('expense-search').addEventListener('input', () => Expenses._applyFilters());

    // Filter toggle
    document.getElementById('btn-filter').addEventListener('click', () => {
      document.getElementById('filter-panel').classList.toggle('hidden');
    });

    // Receipt upload
    document.getElementById('btn-camera').addEventListener('click', () => {
      const fi = document.getElementById('exp-receipt');
      fi.setAttribute('capture', 'environment');
      fi.click();
    });
    document.getElementById('btn-gallery').addEventListener('click', () => {
      document.getElementById('exp-receipt').removeAttribute('capture');
      document.getElementById('exp-receipt').click();
    });
    document.getElementById('exp-receipt').addEventListener('change', e => {
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

    // Set default currency in form from settings
    const defaultCurrency = localStorage.getItem('default_currency');
    if (defaultCurrency) {
      document.getElementById('exp-currency').value = defaultCurrency;
    }

    // ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('[id^="modal-"]').forEach(m => {
          if (!m.classList.contains('hidden')) this.closeModal(m.id);
        });
      }
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
