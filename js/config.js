const CONFIG = {
  PB_URL: 'https://pb.eyalnas.cc',
  COLLECTIONS: { TRIPS: 'trips', EXPENSES: 'expenses' },
};

const DEFAULT_CATEGORIES = {
  'לינה':         { icon: '🏨', color: '#4f8ef7' },
  'אוכל ושתייה':  { icon: '🍽', color: '#38c9a0' },
  'קניות':        { icon: '🛍', color: '#f5a623' },
  'אטרקציות':     { icon: '🎡', color: '#7b5ea7' },
  'רכב':           { icon: '🚗', color: '#e05252' },
  'תחבורה':       { icon: '🚌', color: '#3cb8e0' },
  'טיסות':        { icon: '✈',  color: '#5e7ef7' },
  'ביטוח':        { icon: '🛡', color: '#8bc34a' },
  'אחר':          { icon: '📦', color: '#9e9e9e' },
};

let CATEGORIES = { ...DEFAULT_CATEGORIES };

const CURRENCY_SYMBOLS = {
  ILS:'₪', USD:'$', EUR:'€', GBP:'£', JPY:'¥', THB:'฿', TRY:'₺', AED:'د.إ',
};

const MS_ICON_LIST = [
  'hotel','restaurant','shopping_bag','attractions','directions_car','directions_bus',
  'flight','shield','category','local_cafe','local_bar','spa','museum','beach_access',
  'hiking','sailing','sports_soccer','pool','fitness_center','medical_services',
  'camera_alt','music_note','movie','train','directions_boat','apartment','villa',
  'backpack','wallet','payments','savings','credit_card','park','pets','wine_bar',
  'icecream','cake','theater_comedy','landscape','shopping_cart','pharmacy',
  'smartphone','laptop','casino','sports_tennis','downhill_skiing','surfing',
  'kayaking','camping','temple_buddhist','church','forest','self_care','nightlife',
];

const CAT_COLORS = [
  '#4f8ef7','#38c9a0','#f5a623','#7b5ea7','#e05252',
  '#3cb8e0','#5e7ef7','#8bc34a','#e91e63','#ff5722',
  '#009688','#673ab7','#ff9800','#795548','#00bcd4',
  '#f44336','#4caf50','#2196f3','#9e9e9e','#607d8b',
];

const CAT_MS_ICONS = {
  'לינה':'hotel','אוכל ושתייה':'restaurant','קניות':'shopping_bag',
  'אטרקציות':'attractions','רכב':'directions_car','רכב שכור':'directions_car',
  'תחבורה':'directions_bus','טיסות':'flight','ביטוח':'shield','אחר':'category',
};

function getCatStyle(name) {
  const cat = CATEGORIES[name] || DEFAULT_CATEGORIES[name] || { icon:'📦', color:'#9e9e9e' };
  const msIcon = CAT_MS_ICONS[name] || (/^[a-z][a-z_]+$/.test(cat.icon) ? cat.icon : null);
  return { color: cat.color, icon: cat.icon, msIcon };
}
