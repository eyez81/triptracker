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
    this._initCurrencyUI();
    if (pb.isAuth) await this.goToTrips();
    else this.showScreen('auth');
  },

  _applyTheme(theme) {
    const html = document.documentElement;
    // הסר קלאסים קיימים
    html.classList.remove('dark', 'light');
    if (theme === 'system') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.add(dark ? 'dark' : 'light');
      // עדכן body background בהתאם
      document.body.style.backgroundColor = dark ? '#0b1326' : '#f0f4ff';
    } else {
      html.classList.add(theme);
      document.body.style.backgroundColor = theme === 'light' ? '#f0f4ff' : '#0b1326';
    }
    this._theme = theme;
    localStorage.setItem('theme', theme);
    // Update UI buttons
    document.querySelectorAll('.theme-btn').forEach(b => {
      const active = b.dataset.theme === theme;
      b.classList.toggle('bg-primary-container', active);
      b.classList.toggle('text-on-primary-container', active);
      b.classList.toggle('border-primary-container', active);
      b.classList.toggle('bg-surface-container-highest', !active);
      b.classList.toggle('text-on-surface-variant', !active);
      b.classList.toggle('border-transparent', !active);
    });
  },

  _initCurrencyUI() {
    const saved = localStorage.getItem('default_currency') || 'ILS';
    document.querySelectorAll('.currency-btn').forEach(b => {
      const active = b.dataset.currency === saved;
      b.classList.toggle('bg-primary-container', active);
      b.classList.toggle('text-on-primary-container', active);
      b.classList.toggle('border-primary-container', active);
      b.classList.toggle('bg-surface-container-highest', !active);
      b.classList.toggle('text-on-surface-variant', !active);
      b.classList.toggle('border-transparent', !active);
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

  openSettings() {
    this.showScreen('settings');
    this._renderCategoriesSettings();
  },

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
    this._bindEl('btn-delete-trip', 'click', () => Trips.deleteTrip());
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
    this._bindEl('btn-add-category', 'click', () => this._openCategoryModal());
    this._bindEl('btn-save-category', 'click', () => this._saveCategory());
    this._bindEl('btn-reset-categories', 'click', () => this._resetCategories());

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => this._applyTheme(btn.dataset.theme));
    });

    // Currency buttons
    document.querySelectorAll('.currency-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.currency-btn').forEach(b => {
          b.classList.remove('bg-primary-container', 'text-on-primary-container', 'border-primary-container');
          b.classList.add('bg-surface-container-highest', 'text-on-surface-variant', 'border-transparent');
        });
        btn.classList.remove('bg-surface-container-highest', 'text-on-surface-variant', 'border-transparent');
        btn.classList.add('bg-primary-container', 'text-on-primary-container', 'border-primary-container');
        localStorage.setItem('default_currency', btn.dataset.currency);
        // עדכן ב-select של הוצאה
        const sel = document.getElementById('exp-currency');
        if (sel) sel.value = btn.dataset.currency;
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

    // מצלמה — iOS צריך input נפרד עם capture
    this._bindEl('btn-camera', 'click', () => {
      document.getElementById('exp-receipt-camera').click();
    });
    this._bindEl('btn-gallery', 'click', () => {
      document.getElementById('exp-receipt-gallery').click();
    });

    const handleReceiptFile = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const preview = document.getElementById('receipt-preview');
      const pdfIcon = document.getElementById('receipt-pdf-icon');
      if (file.type === 'application/pdf') {
        preview.classList.add('hidden');
        if (pdfIcon) {
          pdfIcon.classList.remove('hidden');
          pdfIcon.querySelector('span').textContent = file.name;
        }
      } else {
        if (pdfIcon) pdfIcon.classList.add('hidden');
        const reader = new FileReader();
        reader.onload = ev => {
          preview.src = ev.target.result;
          preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    };
    this._bindEl('exp-receipt-camera', 'change', handleReceiptFile);
    this._bindEl('exp-receipt-gallery', 'change', handleReceiptFile);

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

  // ===== ניהול קטגוריות =====
  _renderCategoriesSettings() {
    const el = document.getElementById('categories-list');
    if (!el) return;
    el.innerHTML = Object.entries(CATEGORIES).map(([name, def]) => `
      <div class="flex items-center justify-between py-2.5 border-b border-white/5">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${def.icon}</span>
          <span class="font-medium text-on-surface">${esc(name)}</span>
        </div>
        <div class="flex gap-2">
          <button class="text-primary text-sm px-3 py-1 glass-card rounded-full active:scale-95 transition cat-edit-btn" data-name="${esc(name)}">ערוך</button>
          ${Object.keys(DEFAULT_CATEGORIES).includes(name) ? '' :
            `<button class="text-error text-sm px-3 py-1 glass-card rounded-full active:scale-95 transition cat-del-btn" data-name="${esc(name)}">מחק</button>`
          }
        </div>
      </div>`).join('');

    el.querySelectorAll('.cat-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this._openCategoryModal(btn.dataset.name));
    });
    el.querySelectorAll('.cat-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm(`למחוק את הקטגוריה "${btn.dataset.name}"?`)) return;
        delete CATEGORIES[btn.dataset.name];
        saveCategories(CATEGORIES);
        this._renderCategoriesSettings();
        showToast('קטגוריה נמחקה');
      });
    });
  },

  _editingCategory: null,

  _openCategoryModal(existingName = null) {
    this._editingCategory = existingName;
    document.getElementById('cat-modal-title').textContent = existingName ? 'עריכת קטגוריה' : 'קטגוריה חדשה';
    document.getElementById('cat-name-input').value = existingName || '';
    const currentIcon = existingName ? CATEGORIES[existingName]?.icon : '📦';
    document.getElementById('cat-selected-icon').textContent = currentIcon;
    document.getElementById('cat-icon-value').value = currentIcon;

    // בנה רשת אמוג'י
    const grid = document.getElementById('cat-emoji-grid');
    grid.innerHTML = EMOJI_LIST.map(e => `
      <button class="emoji-pick text-2xl p-2 rounded-xl hover:bg-surface-container active:scale-95 transition ${e === currentIcon ? 'bg-primary-container' : ''}" data-emoji="${e}">${e}</button>
    `).join('');
    grid.querySelectorAll('.emoji-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.emoji-pick').forEach(b => b.classList.remove('bg-primary-container'));
        btn.classList.add('bg-primary-container');
        document.getElementById('cat-selected-icon').textContent = btn.dataset.emoji;
        document.getElementById('cat-icon-value').value = btn.dataset.emoji;
      });
    });

    this.openModal('modal-category');
  },

  _saveCategory() {
    const name = document.getElementById('cat-name-input').value.trim();
    const icon = document.getElementById('cat-icon-value').value || '📦';
    if (!name) { showToast('נא להזין שם קטגוריה'); return; }

    if (this._editingCategory && this._editingCategory !== name) {
      // שינוי שם — מחק ישן
      delete CATEGORIES[this._editingCategory];
    }
    CATEGORIES[name] = { icon, color: CATEGORIES[name]?.color || '#9e9e9e' };
    saveCategories(CATEGORIES);
    this.closeModal('modal-category');
    this._renderCategoriesSettings();
    // עדכן pills בטופס הוצאה
    Expenses._rebuildCategoryPills();
    showToast('קטגוריה נשמרה ✓');
  },

  _resetCategories() {
    if (!confirm('לאפס לקטגוריות ברירת מחדל?')) return;
    CATEGORIES = { ...DEFAULT_CATEGORIES };
    saveCategories(CATEGORIES);
    this._renderCategoriesSettings();
    Expenses._rebuildCategoryPills();
    showToast('קטגוריות אופסו');
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

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', () => App.init());
