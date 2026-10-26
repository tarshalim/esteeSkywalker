// Trigger words for the editor's suggestion panel. Keys are catalog ids (see
// buildCatalog in lib/assetRecommender.js), either:
//   * a category ("art-camping"): every asset in it inherits the triggers, so
//     a whole sticker sheet is covered by one entry; or
//   * one asset ("art-camping-03"): its triggers rank it above the rest of
//     its sheet, so the plaid tent beats the spoon for a camping story.
// Asset labels ("Plaid tent", "Polaroid print") already match on their own;
// list only what a label can't say.
//
// weight: 3 = it's *about* this, 2 = strongly related, 1 = loosely.
// Write terms singular and lowercase; plurals fold automatically. Two-word
// phrases ("road trip") work too.

export const KEYWORD_DICTIONARY = {
  "art-journals": { weight: 2, terms: ["journal", "diary", "memories", "memory", "notebook", "album", "letter", "nostalgia"] },
  "art-oldschool": { weight: 2, terms: ["vintage", "retro", "classic", "antique", "nostalgia"] },
  "art-washi": { weight: 2, terms: ["washi", "tape", "craft", "pastel"] },
  "art-paper": { weight: 1, terms: ["paper", "letter", "note", "craft"] },
  "art-travel-stickers": {
    weight: 3,
    terms: ["travel", "trip", "passport", "flight", "airport", "plane", "luggage", "suitcase", "vacation", "holiday", "abroad", "journey", "ticket", "boarding"],
  },
  "art-road-trip": { weight: 3, terms: ["road trip", "car", "drive", "highway", "van", "route", "map", "motel", "gas station"] },
  "art-tropics": {
    weight: 3,
    terms: ["beach", "tropical", "island", "ocean", "sea", "palm", "surf", "sand", "summer", "sunset", "coconut", "swim", "snorkel"],
  },
  "art-camping": {
    weight: 3,
    terms: ["camping", "tent", "campfire", "hike", "trail", "forest", "mountain", "outdoors", "backpacking", "lake", "star"],
  },
  "art-autumn": { weight: 3, terms: ["autumn", "fall", "leaf", "maple", "harvest", "pumpkin", "cozy", "october", "november"] },
  "art-winter": { weight: 3, terms: ["winter", "snow", "ski", "cold", "christmas", "december", "frost", "snowboard", "cozy"] },
  "art-cute": { weight: 2, terms: ["cute", "kawaii", "heart", "love", "pastel", "sweet", "friend", "fun"] },
  "art-planner": { weight: 2, terms: ["plan", "planner", "itinerary", "schedule", "checklist", "budget", "list", "agenda"] },
  "art-party": {
    weight: 3,
    terms: ["party", "birthday", "celebration", "festival", "cake", "concert", "wedding", "anniversary", "new year", "firework"],
  },
  "art-backdrops": { weight: 1, terms: ["background", "scenery", "landscape"] },
  notes: { weight: 1, terms: ["note", "memo", "reminder", "tip", "thought", "reflection"] },
  frames: { weight: 2, terms: ["photo", "picture", "camera", "snapshot", "polaroid", "film", "video", "selfie", "portrait"] },
  music: { weight: 3, terms: ["music", "song", "playlist", "concert", "band", "vinyl", "listen", "soundtrack"] },
  accents: { weight: 1, terms: ["stamp", "postcard", "mail", "pin", "souvenir"] },
  "paper-exercise": { weight: 1, terms: ["school", "study", "class", "note"] },
  "paper-scrapbook": { weight: 2, terms: ["vintage", "map", "adventure", "hike", "explore", "old"] },
  "template-vintage-travelogue": { weight: 2, terms: ["vintage", "travelogue", "airmail", "journal", "europe", "train", "postcard", "old"] },
  "template-backpacking-camp": { weight: 2, terms: ["backpacking", "hike", "trail", "mountain", "camping", "trek", "summit", "climb"] },
  "template-cute-lively": { weight: 2, terms: ["cute", "fun", "pastel", "friend", "playful", "colorful"] },
  "template-autumn-journal": { weight: 2, terms: ["autumn", "fall", "cozy", "harvest", "leaf"] },

  // Signature pieces of the mixed sheets above.
  "art-camping-03": { weight: 3, terms: ["camping", "tent", "campsite", "outdoors", "forest"] },
  "art-camping-04": { weight: 3, terms: ["hike", "trail", "mountain", "summit", "trek"] },
  "art-camping2-16": { weight: 3, terms: ["camping", "hike"] },
  "art-camping2-07": { weight: 2, terms: ["hike", "trail", "route", "trek"] },
  "art-camping2-11": { weight: 3, terms: ["campfire", "star", "night"] },
  "art-camping2-04": { weight: 2, terms: ["climb", "mountain", "summit"] },
  "art-travel2-01": { weight: 2, terms: ["tropical", "island", "jungle"] },
  "art-travel2-06": { weight: 2, terms: ["tropical", "island", "hawaii", "beach"] },
  "art-travel2-09": { weight: 3, terms: ["beach", "palm", "island", "tropical"] },
  "art-travel2-04": { weight: 2, terms: ["summer", "beach", "dessert", "gelato"] },
  "art-travel-01": { weight: 3, terms: ["road trip", "car", "drive"] },
  "art-travel-07": { weight: 2, terms: ["sea", "beach", "harbor", "coast"] },
  "art-travel-10": { weight: 2, terms: ["boat", "cruise", "sailing", "ferry", "sea"] },
  "art-travel3-06": { weight: 3, terms: ["flight", "airport", "plane", "boarding"] },
  "art-travel3-09": { weight: 3, terms: ["flight", "airport", "plane"] },
  "art-travel3-04": { weight: 2, terms: ["abroad", "border", "visa", "travel"] },
  "art-winter-04": { weight: 3, terms: ["snow", "winter"] },
  "art-winter-06": { weight: 3, terms: ["christmas", "holiday", "december"] },
  "art-winter-09": { weight: 3, terms: ["christmas", "holiday"] },
  "art-autumn-07": { weight: 3, terms: ["autumn", "fall", "maple", "canada"] },
  "art-autumn-20": { weight: 3, terms: ["halloween", "autumn", "harvest", "october"] },
  "art-party-01": { weight: 3, terms: ["birthday", "party", "celebration"] },
  "art-party-09": { weight: 3, terms: ["gift", "birthday", "christmas", "present"] },
};

/** Synonyms, verb forms and irregular plurals -> the term used above. */
export const KEYWORD_ALIASES = {
  hiking: "hike",
  hiked: "hike",
  trekking: "trek",
  climbing: "climb",
  hill: "mountain",
  camped: "camping",
  campsite: "camping",
  bonfire: "campfire",
  wood: "forest",
  seaside: "beach",
  shore: "beach",
  coast: "beach",
  swimming: "swim",
  snorkeling: "snorkel",
  surfing: "surf",
  snowy: "snow",
  skiing: "ski",
  xmas: "christmas",
  chilly: "cold",
  flew: "flight",
  flying: "flight",
  drove: "drive",
  driving: "drive",
  roadtrip: "road trip",
  bday: "birthday",
  celebrate: "celebration",
  gig: "concert",
  leave: "leaf", // "leaves" singularizes to "leave"
  photograph: "photo",
  pic: "photo",
  traveling: "travel",
  travelling: "travel",
  vacay: "vacation",
};
