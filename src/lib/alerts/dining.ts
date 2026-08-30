const DINING_WORDS = [
  "restaurant",
  "resto",
  "cafe",
  "café",
  "coffee",
  "bar",
  "bistro",
  "grill",
  "kitchen",
  "dining",
  "diner",
  "eatery",
  "hawker",
  "kopitiam",
  "bakery",
  "pub",
  "tavern",
  "steak",
  "ramen",
  "sushi",
  "pizza",
  "noodle",
  "wok",
  "izakaya",
  "brasserie",
  "canteen",
  "food",
  "burger",
  "pizz",
  "tapas",
  "oyster",
  "seafood",
  "bbq",
  "barbecue",
  "brunch",
  "tea",
  "patisserie",
  "gelato",
  "ice cream",
  "dessert",
  "wine",
  "brew",
  "craft beer",
];

const NON_DINING = [
  "cold storage",
  "fairprice",
  "ntuc",
  "7-eleven",
  "7 eleven",
  "shell",
  "esso",
  "spc ",
  "caltex",
  "petrol",
  "pharmacy",
  "guardian",
  "watsons",
  "uniqlo",
  "ikea",
  "courts",
  "challenger",
  "shopee",
  "lazada",
  "amazon",
  "netflix",
  "spotify",
  "youtube",
  "grabpay",
  "mrt",
  "simplygo",
  "lta",
  "singtel",
  "starhub",
  "circles.life",
];

export function looksLikeNonDining(merchant: string): boolean {
  const n = merchant.toLowerCase();
  return NON_DINING.some((w) => n.includes(w.trim()));
}

/** True for F&B names, Claude flags, or unknown merchants (restaurant names rarely contain "restaurant"). */
export function looksLikeDining(merchant: string, flagged?: boolean): boolean {
  if (flagged) return true;
  const n = merchant.toLowerCase();
  if (looksLikeNonDining(merchant)) return false;
  if (DINING_WORDS.some((w) => n.includes(w))) return true;
  return n.length > 1;
}
