const Lightbox = {
  _zoomed: false,
  _hintTimer: null,

  open(url) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    this._zoomed = false;
    img.style.transform = 'scale(1)';
    img.classList.replace('cursor-zoom-out', 'cursor-zoom-in');
    img.src = url;
    lb.classList.remove('hidden');
    lb.style.opacity = '0';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      lb.style.transition = 'opacity 0.2s ease';
      lb.style.opacity = '1';
    });
    this._showHint();
  },

  close() {
    const lb = document.getElementById('lightbox');
    lb.style.opacity = '0';
    setTimeout(() => {
      lb.classList.add('hidden');
      document.getElementById('lightbox-img').src = '';
      document.body.style.overflow = '';
    }, 200);
  },

  toggleZoom(e) {
    const img = document.getElementById('lightbox-img');
    this._zoomed = !this._zoomed;
    if (this._zoomed) {
      const rect = img.getBoundingClientRect();
      const ox = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
      const oy = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
      img.style.transformOrigin = `${ox}% ${oy}%`;
      img.style.transform = 'scale(2.5)';
      img.classList.replace('cursor-zoom-in', 'cursor-zoom-out');
    } else {
      img.style.transform = 'scale(1)';
      img.style.transformOrigin = 'center center';
      img.classList.replace('cursor-zoom-out', 'cursor-zoom-in');
    }
  },

  _showHint() {
    const hint = document.getElementById('lightbox-zoom-hint');
    if (!hint) return;
    hint.style.opacity = '1';
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => { hint.style.opacity = '0'; }, 2500);
  },

  _bind() {
    document.getElementById('lightbox-backdrop').addEventListener('click', () => this.close());
    document.getElementById('lightbox-close').addEventListener('click', () => this.close());
    document.getElementById('lightbox-img').addEventListener('click', e => { e.stopPropagation(); this.toggleZoom(e); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !document.getElementById('lightbox').classList.contains('hidden')) {
        e.stopImmediatePropagation();
        this.close();
      }
    }, true);
  },
};

const CategorySync = {
  _records: {}, // { name: pbRecordId }
  _meta: {},    // { name: { icon, color } } — icon/color for all categories

  _loadMeta() {
    try { this._meta = JSON.parse(localStorage.getItem('cat_meta') || '{}'); }
    catch { this._meta = {}; }
  },

  _saveMeta() {
    localStorage.setItem('cat_meta', JSON.stringify(this._meta));
  },

  async load() {
    this._loadMeta();
    // Reset to defaults, apply any locally overridden icon/color
    Object.keys(CATEGORIES).forEach(k => delete CATEGORIES[k]);
    Object.assign(CATEGORIES, DEFAULT_CATEGORIES);
    Object.entries(this._meta).forEach(([name, m]) => {
      if (CATEGORIES[name]) Object.assign(CATEGORIES[name], m);
    });
    // Fetch custom categories from PocketBase
    try {
      const res = await pb.list('categories', { filter: `user="${pb.userId}"`, perPage: 200 });
      this._records = {};
      for (const rec of res.items) {
        this._records[rec.name] = rec.id;
        const m = this._meta[rec.name] || {};
        CATEGORIES[rec.name] = { icon: m.icon || '📦', color: m.color || '#9e9e9e' };
      }
    } catch (e) {
      console.warn('Category sync unavailable:', e.message);
    }
  },

  async save(name, icon, color, previousName = null) {
    const isDefault = n => Object.prototype.hasOwnProperty.call(DEFAULT_CATEGORIES, n);
    const wasCustom = previousName && !isDefault(previousName);
    const isNowCustom = !isDefault(name);

    // Persist icon/color locally for all categories
    this._meta[name] = { icon, color };
    if (previousName && previousName !== name) delete this._meta[previousName];
    this._saveMeta();

    if (wasCustom && previousName !== name) {
      // Renamed a custom category
      const id = this._records[previousName];
      if (id) {
        try { await pb.update('categories', id, { name }); } catch {}
        this._records[name] = id;
        delete this._records[previousName];
      }
    } else if (isNowCustom && !this._records[name]) {
      // New custom category
      try {
        const rec = await pb.create('categories', { name, user: pb.userId });
        this._records[name] = rec.id;
      } catch (e) { showToast('שגיאה בשמירת קטגוריה: ' + e.message); }
    }

    if (previousName && previousName !== name) delete CATEGORIES[previousName];
    CATEGORIES[name] = { icon, color };
  },

  async remove(name) {
    const id = this._records[name];
    if (id) {
      try { await pb.delete('categories', id); } catch {}
      delete this._records[name];
    }
    delete this._meta[name];
    this._saveMeta();
    delete CATEGORIES[name];
  },

  async reset() {
    await Promise.all(Object.values(this._records).map(id => pb.delete('categories', id).catch(() => {})));
    this._records = {};
    this._meta = {};
    this._saveMeta();
    Object.keys(CATEGORIES).forEach(k => delete CATEGORIES[k]);
    Object.assign(CATEGORIES, DEFAULT_CATEGORIES);
  },
};

const App = {
  _prevScreen: 'trips',
  _theme: localStorage.getItem('theme') || 'dark',

  async init() {
    this._applyTheme(this._theme);
    try {
      const r = await fetch('http://192.168.0.176:8090/api/health', { signal: AbortSignal.timeout(1500) });
      if (r.ok) CONFIG.PB_URL = 'http://192.168.0.176:8090';
    } catch {}
    Lightbox._bind();
    this._bind();
    this._syncCurrencyUI();
    if (pb.isAuth) await this.goToTrips();
    else this.showScreen('auth');
  },

  // ===== תמה =====
  _applyTheme(theme) {
    const html = document.documentElement;
    html.classList.remove('dark', 'light');
    if (theme === 'system') {
      html.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      html.classList.add(theme);
    }
    this._theme = theme;
    localStorage.setItem('theme', theme);
    // עדכן כפתורי תמה
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

  // ===== מטבע — סנכרון UI עם localStorage =====
  _syncCurrencyUI() {
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
    await CategorySync.load();
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
    this._bindEl('btn-share-trip', 'click', () => Trips.openShareModal());
    this._bindEl('btn-do-share', 'click', () => Trips.shareWithEmail());
    this._bindEl('btn-show-categories', 'click', () => Expenses.openCategories());
    this._bindEl('btn-show-forecast', 'click', () => Expenses.openForecast());
    this._bindEl('btn-delete-expense', 'click', () => Expenses.delete());
    this._bindEl('btn-edit-expense', 'click', () => Expenses.editCurrent());
    this._bindEl('nav-settings-trips', 'click', e => { e.preventDefault(); this.openSettings(); });
    this._bindEl('nav-settings-trip', 'click', e => { e.preventDefault(); this.openSettings(); });
    this._bindEl('nav-trips-from-settings', 'click', e => { e.preventDefault(); this.goToTrips(); });
    this._bindEl('nav-trips-from-trip', 'click', e => { e.preventDefault(); this.goToTrips(); });
    this._bindEl('btn-back-from-settings', 'click', () => this.showScreen(this._prevScreen));
    this._bindEl('btn-add-category', 'click', () => this._openCategoryModal());
    this._bindEl('btn-save-category', 'click', () => this._saveCategory());
    this._bindEl('btn-reset-categories', 'click', () => this._resetCategories());

    // תמה
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => this._applyTheme(btn.dataset.theme));
    });

    // מטבע — תיקון: שימוש ב-classList.toggle במקום className.replace
    document.querySelectorAll('.currency-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.currency-btn').forEach(b => {
          b.classList.remove('bg-primary-container', 'text-on-primary-container', 'border-primary-container');
          b.classList.add('bg-surface-container-highest', 'text-on-surface-variant', 'border-transparent');
        });
        btn.classList.remove('bg-surface-container-highest', 'text-on-surface-variant', 'border-transparent');
        btn.classList.add('bg-primary-container', 'text-on-primary-container', 'border-primary-container');
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

    // מצלמה — iOS: input נפרד עם capture, גלריה בלי capture + תמיכה ב-PDF
    this._bindEl('btn-camera', 'click', () => {
      document.getElementById('exp-receipt-camera').click();
    });
    this._bindEl('btn-gallery', 'click', () => {
      document.getElementById('exp-receipt-gallery').click();
    });

    const handleFile = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      Expenses._receiptFile = file;
      const preview = document.getElementById('receipt-preview');
      const pdfBadge = document.getElementById('receipt-pdf-badge');
      if (file.type === 'application/pdf') {
        preview.classList.add('hidden');
        if (pdfBadge) {
          pdfBadge.classList.remove('hidden');
          const nameEl = pdfBadge.querySelector('span.pdf-name');
          if (nameEl) nameEl.textContent = file.name;
        }
      } else {
        if (pdfBadge) pdfBadge.classList.add('hidden');
        const reader = new FileReader();
        reader.onload = ev => { preview.src = ev.target?.result || ''; preview.classList.remove('hidden'); };
        reader.readAsDataURL(file);
      }
    };
    this._bindEl('exp-receipt-camera', 'change', handleFile);
    this._bindEl('exp-receipt-gallery', 'change', handleFile);

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
    const CAT_MS = {
      'לינה':'hotel','אוכל ושתייה':'restaurant','קניות':'shopping_bag',
      'אטרקציות':'attractions','רכב שכור':'directions_car','תחבורה':'directions_bus',
      'טיסות':'flight','ביטוח':'shield','אחר':'category',
    };
    el.innerHTML = Object.entries(CATEGORIES).map(([name, def]) => {
      const ms = CAT_MS[name];
      const iconHTML = ms
        ? `<span class="material-symbols-outlined" style="font-size:20px;color:#fff;font-variation-settings:'FILL' 1">${ms}</span>`
        : `<span style="font-size:18px;line-height:1">${def.icon}</span>`;
      return `
      <div class="flex items-center justify-between py-2.5 border-b border-white/5">
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0 flex items-center justify-center" style="width:40px;height:40px;border-radius:50%;background:${def.color}">${iconHTML}</div>
          <span class="font-medium text-on-surface">${esc(name)}</span>
        </div>
        <div class="flex gap-2">
          <button class="text-primary text-sm px-3 py-1.5 glass-card rounded-full active:scale-95 transition cat-edit-btn" data-name="${esc(name)}">ערוך</button>
          ${Object.keys(DEFAULT_CATEGORIES).includes(name) ? '' :
            `<button class="text-error text-sm px-3 py-1.5 glass-card rounded-full active:scale-95 transition cat-del-btn" data-name="${esc(name)}">מחק</button>`
          }
        </div>
      </div>`;
    }).join('');
    el.querySelectorAll('.cat-edit-btn').forEach(b => b.addEventListener('click', () => this._openCategoryModal(b.dataset.name)));
    el.querySelectorAll('.cat-del-btn').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(`למחוק "${b.dataset.name}"?`)) return;
      await CategorySync.remove(b.dataset.name);
      this._renderCategoriesSettings();
      Expenses._rebuildCategoryPills?.();
      showToast('קטגוריה נמחקה');
    }));
  },

  _editingCatName: null,
  _openCategoryModal(existing = null) {
    this._editingCatName = existing;
    document.getElementById('cat-modal-title').textContent = existing ? 'עריכת קטגוריה' : 'קטגוריה חדשה';
    document.getElementById('cat-name-input').value = existing || '';
    const currentIcon = existing ? (CATEGORIES[existing]?.icon || '📦') : '📦';
    document.getElementById('cat-selected-icon').textContent = currentIcon;
    document.getElementById('cat-icon-value').value = currentIcon;
    const grid = document.getElementById('cat-emoji-grid');
    grid.innerHTML = EMOJI_LIST.map(em => `
      <button class="emoji-pick text-2xl p-2 rounded-xl hover:bg-surface-container active:scale-95 transition ${em === currentIcon ? 'bg-primary-container/50' : ''}" data-emoji="${em}">${em}</button>
    `).join('');
    grid.querySelectorAll('.emoji-pick').forEach(b => {
      b.addEventListener('click', () => {
        grid.querySelectorAll('.emoji-pick').forEach(x => x.classList.remove('bg-primary-container/50'));
        b.classList.add('bg-primary-container/50');
        document.getElementById('cat-selected-icon').textContent = b.dataset.emoji;
        document.getElementById('cat-icon-value').value = b.dataset.emoji;
      });
    });
    this.openModal('modal-category');
  },

  _saveCategory() {
    const name = document.getElementById('cat-name-input').value.trim();
    const icon = document.getElementById('cat-icon-value').value || '📦';
    if (!name) { showToast('נא להזין שם קטגוריה'); return; }

    const previousName = this._editingCatName;
    const existingColor = previousName ? CATEGORIES[previousName]?.color : null;

    CategorySync.save(name, icon, existingColor || '#9e9e9e', previousName);
    this.closeModal('modal-category');
    this._renderCategoriesSettings();
    Expenses._rebuildCategoryPills?.();
    showToast('קטגוריה נשמרה ✓');
  },

  async _resetCategories() {
    if (!confirm('לאפס לקטגוריות ברירת מחדל?')) return;
    await CategorySync.reset();
    this._renderCategoriesSettings();
    Expenses._rebuildCategoryPills?.();
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
