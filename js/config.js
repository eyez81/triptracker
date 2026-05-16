const CONFIG = {
  PB_URL: 'https://pb.eyalnas.cc',
  COLLECTIONS: { TRIPS: 'trips', EXPENSES: 'expenses', TRIP_MEMBERS: 'trip_members' },
};

const DEFAULT_CATEGORIES = {
  'לינה':         { icon: '🏨', color: '#4f8ef7' },
  'אוכל ושתייה': { icon: '🍽', color: '#38c9a0' },
  'קניות':        { icon: '🛍', color: '#f5a623' },
  'אטרקציות':     { icon: '🎡', color: '#7b5ea7' },
  'רכב שכור':     { icon: '🚗', color: '#e05252' },
  'תחבורה':       { icon: '🚌', color: '#3cb8e0' },
  'טיסות':        { icon: '✈',  color: '#5e7ef7' },
  'ביטוח':        { icon: '🛡', color: '#8bc34a' },
  'אחר':          { icon: '📦', color: '#9e9e9e' },
};

function loadCategories() {
  try {
    const s = localStorage.getItem('custom_categories');
    if (s) return JSON.parse(s);
  } catch {}
  return { ...DEFAULT_CATEGORIES };
}

function saveCategories(cats) {
  localStorage.setItem('custom_categories', JSON.stringify(cats));
}

let CATEGORIES = loadCategories();

const CURRENCY_SYMBOLS = {
  ILS:'₪', USD:'$', EUR:'€', GBP:'£', JPY:'¥', THB:'฿', TRY:'₺', AED:'د.إ',
};

const EMOJI_LIST = [
  '🏨','🍽','🛍','🎡','🚗','🚌','✈','🛡','📦','🎭','🏖','🏔','🎪',
  '🚢','🏕','🎵','🎨','⚽','🏊','🚴','🍕','☕','🍺','🛒','💊',
  '📱','💻','🎁','💰','🏦','🎓','🔧','🌐','🏛','🗺','📸','🎬','🎿','🧘',
];
