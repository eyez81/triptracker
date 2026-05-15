const ExcelExport = {
  async export(trip, expenses) {
    if (typeof XLSX === 'undefined') {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const rows = expenses.map(e => ({
      'שם הוצאה': e.name || '',
      'קטגוריה': e.category || '',
      'סכום (₪)': Number(e.amount_ils) || 0,
      'סכום מקורי': Number(e.amount) || 0,
      'מטבע': e.currency || 'ILS',
      'שער המרה': Number(e.exchange_rate) || 1,
      'סוג תשלום': e.payment_type || '',
      'אמצעי תשלום': e.payment_method || '',
      'תאריך': e.payment_date ? new Date(e.payment_date).toLocaleDateString('he-IL') : '',
      'מיקום': e.location || '',
      'הערות': e.notes || '',
      'קישור': e.link || '',
      'איש קשר': e.contact_name || '',
      'טלפון': e.contact_phone || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const totalSpent = expenses.filter(e => e.payment_type !== 'עתידי').reduce((s,e) => s + (Number(e.amount_ils)||0), 0);
    XLSX.utils.sheet_add_aoa(ws, [[], ['סה"כ בפועל (₪)', totalSpent], ['תקציב (₪)', trip.budget||0]], { origin: `A${rows.length+2}` });
    ws['!cols'] = [22,14,12,12,8,10,14,14,12,16,20,30,16,14].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'הוצאות');
    XLSX.writeFile(wb, `${trip.name||'טיול'}_הוצאות_${new Date().toLocaleDateString('he-IL').replace(/\./g,'-')}.xlsx`);
    showToast('הקובץ הורד ✓');
  },
};
