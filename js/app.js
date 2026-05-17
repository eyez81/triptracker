const Lightbox = {
  _zoomed: false,
  _hintTimer: null,
  _type: 'image',
  _url: '',

  /* PDF state */
  _pdfDoc: null,
  _pdfZoomIdx: 2,              // index into _PDF_ZOOMS, starts at 100%
  _PDF_ZOOMS: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],

  /* type: 'image' | 'pdf' */
  open(url, type = 'image', filename = '') {
    this._url = url;
    this._type = type;
    const lb      = document.getElementById('lightbox');
    const titleEl = document.getElementById('lightbox-title');
    const imgWrap = document.getElementById('lightbox-image-wrap');
    const pdfWrap = document.getElementById('lightbox-pdf-wrap');
    const hint    = document.getElementById('lightbox-zoom-hint');

    if (titleEl) titleEl.textContent = filename || (type === 'pdf' ? 'PDF' : 'תמונה');

    if (type === 'pdf') {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      return;
    } else {
      pdfWrap.classList.add('hidden');
      imgWrap.classList.remove('hidden');
      const img = document.getElementById('lightbox-img');
      this._zoomed = false;
      img.style.transform = 'scale(1)';
      img.style.transformOrigin = 'center center';
      img.classList.replace('cursor-zoom-out', 'cursor-zoom-in');
      img.src = url;
      this._showHint();
    }

    lb.classList.remove('hidden');
    lb.style.opacity = '0';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      lb.style.transition = 'opacity 0.2s ease';
      lb.style.opacity = '1';
    });
  },

  async _loadPDF(url) {
    const loadingEl = document.getElementById('lightbox-pdf-loading');
    const scrollEl  = document.getElementById('lightbox-pdf-scroll');
    const toolbar   = document.getElementById('lightbox-pdf-toolbar');
    const pagesEl   = document.getElementById('lightbox-pdf-pages');
    try {
      if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js לא נטען');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      /*
       * cMapUrl + cMapPacked: required for Hebrew/Arabic/CJK — maps character
       * codes to Unicode so text renders correctly instead of garbled/mirrored.
       * standardFontDataUrl: supplies the 14 standard PDF fonts so embedded-
       * font PDFs fall back gracefully when a font isn't fully embedded.
       */
      this._pdfDoc = await pdfjsLib.getDocument({
        url,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
      }).promise;
      if (loadingEl) loadingEl.style.display = 'none';
      if (scrollEl)  scrollEl.classList.remove('hidden');
      if (toolbar)   toolbar.classList.remove('hidden');
      await this._renderPDFPages();
    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (pagesEl) pagesEl.innerHTML =
        `<div style="color:rgba(255,255,255,0.55);text-align:center;padding:40px 16px;font-size:14px">
           שגיאה בטעינת PDF
           <br><span style="font-size:11px;opacity:0.6">${err.message}</span>
         </div>`;
      if (scrollEl) scrollEl.classList.remove('hidden');
      console.error('[PDF.js]', err);
    }
  },

  async _renderPDFPages() {
    const pagesEl  = document.getElementById('lightbox-pdf-pages');
    const scrollEl = document.getElementById('lightbox-pdf-scroll');
    if (!pagesEl || !this._pdfDoc) return;
    pagesEl.innerHTML = '';

    const dpr           = window.devicePixelRatio || 1;
    const containerW    = (scrollEl?.clientWidth || 360) - 16; // subtract px padding
    const zoom          = this._PDF_ZOOMS[this._pdfZoomIdx];
    const savedScrollTop = scrollEl?.scrollTop || 0;

    for (let i = 1; i <= this._pdfDoc.numPages; i++) {
      /* abort if the lightbox was closed while rendering */
      if (document.getElementById('lightbox').classList.contains('hidden')) return;

      const page     = await this._pdfDoc.getPage(i);
      const vp1      = page.getViewport({ scale: 1 });
      const baseScale = containerW / vp1.width;
      const viewport  = page.getViewport({ scale: baseScale * zoom });

      /* Outer wrapper carries the page number for scroll tracking */
      const wrap = document.createElement('div');
      wrap.dataset.pageNum = i;
      wrap.style.cssText = 'position:relative;max-width:100%';

      /*
       * Render at physical pixels (width × dpr, height × dpr) then CSS-scale
       * back down — this gives crisp text on retina / high-DPI screens.
       */
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(viewport.width  * dpr);
      canvas.height = Math.round(viewport.height * dpr);
      canvas.style.cssText =
        `width:${viewport.width}px;height:${viewport.height}px;` +
        `max-width:100%;border-radius:8px;` +
        `box-shadow:0 4px 20px rgba(0,0,0,0.5);display:block`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      /* Page number badge */
      if (this._pdfDoc.numPages > 1) {
        const badge = document.createElement('div');
        badge.textContent = i;
        badge.style.cssText =
          'position:absolute;bottom:8px;right:8px;' +
          'background:rgba(0,0,0,0.45);color:rgba(255,255,255,0.7);' +
          'font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;' +
          'pointer-events:none;backdrop-filter:blur(4px)';
        wrap.appendChild(badge);
      }

      wrap.insertBefore(canvas, wrap.firstChild);
      pagesEl.appendChild(wrap);

      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    /* Restore scroll position after re-render (zoom change) */
    if (scrollEl && savedScrollTop) scrollEl.scrollTop = savedScrollTop;
    this._updatePDFToolbar();
  },

  _pdfZoomIn() {
    if (!this._pdfDoc || this._pdfZoomIdx >= this._PDF_ZOOMS.length - 1) return;
    this._pdfZoomIdx++;
    this._renderPDFPages();
    document.getElementById('pdf-zoom-level').textContent =
      Math.round(this._PDF_ZOOMS[this._pdfZoomIdx] * 100) + '%';
  },

  _pdfZoomOut() {
    if (!this._pdfDoc || this._pdfZoomIdx <= 0) return;
    this._pdfZoomIdx--;
    this._renderPDFPages();
    document.getElementById('pdf-zoom-level').textContent =
      Math.round(this._PDF_ZOOMS[this._pdfZoomIdx] * 100) + '%';
  },

  _updatePDFToolbar() {
    const zoomEl = document.getElementById('pdf-zoom-level');
    if (zoomEl) zoomEl.textContent = Math.round(this._PDF_ZOOMS[this._pdfZoomIdx] * 100) + '%';
    this._updatePDFPageIndicator();
  },

  _updatePDFPageIndicator() {
    if (!this._pdfDoc) return;
    const scrollEl = document.getElementById('lightbox-pdf-scroll');
    const pagesEl  = document.getElementById('lightbox-pdf-pages');
    const indEl    = document.getElementById('pdf-page-indicator');
    if (!indEl || !scrollEl || !pagesEl) return;
    const midY = scrollEl.scrollTop + scrollEl.clientHeight / 2;
    let current = 1;
    pagesEl.querySelectorAll('[data-page-num]').forEach(p => {
      if (p.offsetTop <= midY) current = Number(p.dataset.pageNum);
    });
    indEl.textContent = `${current} / ${this._pdfDoc.numPages}`;
  },

  close() {
    const lb = document.getElementById('lightbox');
    lb.style.opacity = '0';
    setTimeout(() => {
      lb.classList.add('hidden');
      document.getElementById('lightbox-img').src = '';
      const pagesEl = document.getElementById('lightbox-pdf-pages');
      if (pagesEl) pagesEl.innerHTML = '';
      document.getElementById('lightbox-pdf-scroll')?.classList.add('hidden');
      document.getElementById('lightbox-pdf-toolbar')?.classList.add('hidden');
      this._pdfDoc = null;
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

  _download() {
    const url = this._url;
    if (!url) return;
    /* Attempt fetch→blob for proper download; fall back to new tab */
    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const ext = url.split('?')[0].split('.').pop() || 'bin';
        const name = url.split('/').pop()?.split('?')[0] || `attachment.${ext}`;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      })
      .catch(() => window.open(url, '_blank'));
  },

  _bind() {
    document.getElementById('lightbox-backdrop').addEventListener('click', () => this.close());
    document.getElementById('lightbox-close').addEventListener('click', () => this.close());
    document.getElementById('lightbox-img').addEventListener('click', e => {
      if (this._type === 'image') { e.stopPropagation(); this.toggleZoom(e); }
    });
    document.getElementById('lightbox-download').addEventListener('click', e => {
      e.stopPropagation();
      this._download();
    });
    document.getElementById('pdf-zoom-in')?.addEventListener('click', () => this._pdfZoomIn());
    document.getElementById('pdf-zoom-out')?.addEventListener('click', () => this._pdfZoomOut());
    document.getElementById('lightbox-pdf-scroll')?.addEventListener('scroll', () => this._updatePDFPageIndicator());
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
    this._bindEl('btn-trip-menu', 'click', (e) => {
      e.stopPropagation();
      const panel = document.getElementById('trip-menu-panel');
      if (!panel) return;
      const isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'block';
    });
    document.addEventListener('click', () => {
      const panel = document.getElementById('trip-menu-panel');
      if (panel) panel.style.display = 'none';
    });
    const menuPanel = document.getElementById('trip-menu-panel');
    if (menuPanel) {
      menuPanel.addEventListener('click', e => {
        e.stopPropagation();
        setTimeout(() => { menuPanel.style.display = 'none'; }, 90);
      });
    }
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
      const files = [...(e.target.files || [])].filter(f => /^(image\/(jpeg|png|webp)|application\/pdf)$/i.test(f.type));
      if (!files.length) return;
      Expenses._pendingFiles = [...(Expenses._pendingFiles || []), ...files];
      Expenses._renderAttachmentEditor();
      e.target.value = '';
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
    el.innerHTML = Object.entries(CATEGORIES).map(([name, def]) => {
      const { msIcon: msName } = getCatStyle(name);
      const iconHTML = msName
        ? `<span class="material-symbols-outlined" style="font-size:20px;color:#fff;font-variation-settings:'FILL' 1">${msName}</span>`
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

    const cat = existing ? CATEGORIES[existing] : null;
    const EMOJI_TO_MS = {
      '🏨':'hotel','🍽':'restaurant','🛍':'shopping_bag','🎡':'attractions',
      '🚗':'directions_car','🚌':'directions_bus','✈':'flight','🛡':'shield','📦':'category',
    };
    const rawIcon = cat?.icon || 'category';
    const currentIcon = /^[a-z][a-z_]+$/.test(rawIcon) ? rawIcon : (EMOJI_TO_MS[rawIcon] || 'category');
    const currentColor = cat?.color || CAT_COLORS[0];

    document.getElementById('cat-icon-value').value = currentIcon;
    document.getElementById('cat-color-value').value = currentColor;
    this._updateCatPreview(currentIcon, currentColor);

    // Color grid
    const colorGrid = document.getElementById('cat-color-grid');
    colorGrid.innerHTML = CAT_COLORS.map(c => `
      <button class="cat-color-btn rounded-full transition active:scale-90 ${c === currentColor ? 'ring-2 ring-white ring-offset-2 ring-offset-black/50' : ''}"
        data-color="${c}" style="width:32px;height:32px;background:${c}"></button>
    `).join('');
    colorGrid.querySelectorAll('.cat-color-btn').forEach(b => {
      b.addEventListener('click', () => {
        colorGrid.querySelectorAll('.cat-color-btn').forEach(x => x.classList.remove('ring-2','ring-white','ring-offset-2','ring-offset-black/50'));
        b.classList.add('ring-2','ring-white','ring-offset-2','ring-offset-black/50');
        document.getElementById('cat-color-value').value = b.dataset.color;
        this._updateCatPreview(document.getElementById('cat-icon-value').value, b.dataset.color);
      });
    });

    // Icon grid
    const grid = document.getElementById('cat-emoji-grid');
    grid.innerHTML = MS_ICON_LIST.map(icon => `
      <button class="cat-icon-btn flex items-center justify-center rounded-xl transition active:scale-90 ${icon === currentIcon ? 'bg-primary-container/50' : 'hover:bg-surface-container-high'}"
        data-icon="${icon}" style="height:44px">
        <span class="material-symbols-outlined" style="font-size:24px;color:rgba(255,255,255,0.85);font-variation-settings:'FILL' 1">${icon}</span>
      </button>
    `).join('');
    grid.querySelectorAll('.cat-icon-btn').forEach(b => {
      b.addEventListener('click', () => {
        grid.querySelectorAll('.cat-icon-btn').forEach(x => x.classList.remove('bg-primary-container/50'));
        b.classList.add('bg-primary-container/50');
        document.getElementById('cat-icon-value').value = b.dataset.icon;
        this._updateCatPreview(b.dataset.icon, document.getElementById('cat-color-value').value);
      });
    });

    this.openModal('modal-category');
  },

  _updateCatPreview(icon, color) {
    document.getElementById('cat-preview-circle').style.background = color;
    document.getElementById('cat-preview-icon').textContent = icon;
  },

  _saveCategory() {
    const name = document.getElementById('cat-name-input').value.trim();
    const icon = document.getElementById('cat-icon-value').value || 'category';
    const color = document.getElementById('cat-color-value').value || '#9e9e9e';
    if (!name) { showToast('נא להזין שם קטגוריה'); return; }

    const previousName = this._editingCatName;

    CategorySync.save(name, icon, color, previousName);
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
