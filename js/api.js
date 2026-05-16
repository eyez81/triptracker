const pb = {
  get token() { return localStorage.getItem('pb_token'); },
  get userId() { return localStorage.getItem('pb_user_id'); },
  get isAuth() { return !!this.token; },

  async _req(method, path, body, isForm = false) {
    const url = `${CONFIG.PB_URL}/api/${path}`;
    const opts = { method, headers: {} };
    if (this.token) opts.headers['Authorization'] = this.token;
    if (body && !isForm) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (isForm) {
      opts.body = body;
    }
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[PocketBase error]', method, url, '\nstatus:', res.status, '\nresponse:', JSON.stringify(data, null, 2));
      const detail = data.data ? ' | ' + JSON.stringify(data.data) : '';
      throw new Error((data.message || `HTTP ${res.status}`) + detail);
    }
    return data;
  },

  async login(email, password) {
    const data = await this._req('POST', 'collections/users/auth-with-password', { identity: email, password });
    localStorage.setItem('pb_token', data.token);
    localStorage.setItem('pb_user_id', data.record?.id);
    return data;
  },

  logout() {
    localStorage.removeItem('pb_token');
    localStorage.removeItem('pb_user_id');
  },

  async list(collection, opts = {}) {
    const p = new URLSearchParams({ page: opts.page || 1 });
    if (opts.filter) p.set('filter', opts.filter);
    if (opts.sort) p.set('sort', opts.sort);
    if (opts.perPage) p.set('perPage', opts.perPage);
    return this._req('GET', `collections/${collection}/records?${p}`);
  },

  async get(collection, id) {
    return this._req('GET', `collections/${collection}/records/${id}`);
  },

  async create(collection, data) {
    return this._req('POST', `collections/${collection}/records`, data);
  },

  async createForm(collection, fd) {
    return this._req('POST', `collections/${collection}/records`, fd, true);
  },

  async update(collection, id, data) {
    return this._req('PATCH', `collections/${collection}/records/${id}`, data);
  },

  async updateForm(collection, id, fd) {
    return this._req('PATCH', `collections/${collection}/records/${id}`, fd, true);
  },

  async delete(collection, id) {
    return this._req('DELETE', `collections/${collection}/records/${id}`);
  },

  fileUrl(record, filename) {
    return `${CONFIG.PB_URL}/api/files/${record.collectionId}/${record.id}/${filename}`;
  },
};
