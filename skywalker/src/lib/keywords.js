// Cheap keyword extraction for the suggestion panel: no NLP, just
// normalize -> tokenize -> drop stop words -> fold plurals -> count.
// Synonyms and verb forms ("hiking" -> "hike") are the tag index's job
// (tag_aliases), so this file stays a pure, dependency-free text pass.

// Function words plus storytelling filler that would match nothing useful.
// Deliberately keeps content words that are also tags ("new", "fall"); "day"
// is out because every travel story says it.
const STOP_WORDS = new Set(
  `a about above after again against all also am an and any are around as at away back be because been before
  being below between both but by came can could day did didn do does doing don done down during each even ever every
  few for from further get gets getting got had has have having he her here hers herself him himself his how
  i if in into is it its itself just know let like lot lots made make many me more most much my myself next no
  nor not now of off on once one only or other our ours ourselves out over own pretty quite really same saw see
  she should so some still such than that the their theirs them themselves then there these they thing things
  this those though through to too took two under until up us very want was way we well went were what when
  where which while who whom why will with would yet you your yours yourself yourselves`.split(/\s+/)
);

const MIN_LENGTH = 3;
const MAX_LENGTH = 24;

/** Plural -> singular for the regular cases; irregulars go in tag_aliases. */
export function singular(word) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * Lowercase ASCII word tokens with markup, accents, digits and punctuation
 * removed ("Café <b>crawls</b>!" -> ["cafe", "crawls"]). Canvas text
 * elements store HTML, so tags and entities are stripped first.
 */
export function tokenize(text) {
  return (text ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/[a-z]+/g) ?? [];
}

const isTerm = (word) => word.length >= MIN_LENGTH && word.length <= MAX_LENGTH && !STOP_WORDS.has(word);

/** The keyword form of a raw token, or null for stop words ("does", and "days" -> "day"). */
export function keywordOf(raw) {
  const word = singular(raw);
  return isTerm(raw) && isTerm(word) ? word : null;
}

/**
 * Weighted keywords from one or more text sources, e.g.
 *   extractKeywords([{ text: title, weight: 3 }, { text: body }])
 * Returns Map<term, weight>. Terms are singularized words plus two-word
 * phrases ("road trip") from adjacent keywords; the matcher ignores any term
 * the tag index doesn't know, so unknown phrases cost nothing.
 *
 * Repeats count with diminishing returns (1, 2, 3, 4 mentions -> 1, 2, 2.6,
 * 3), so one long paragraph about lunch can't drown out the rest of the story.
 */
export function extractKeywords(sources) {
  const counts = new Map();
  const bump = (term, weight) => counts.set(term, (counts.get(term) ?? 0) + weight);

  for (const { text, weight = 1 } of sources) {
    let prev = null;
    for (const raw of tokenize(text)) {
      const word = keywordOf(raw);
      if (!word) {
        prev = null; // a stop word breaks a phrase: "road to trip" isn't "road trip"
        continue;
      }
      bump(word, weight);
      if (prev) bump(`${prev} ${word}`, weight);
      prev = word;
    }
  }

  const keywords = new Map();
  for (const [term, count] of counts) keywords.set(term, 1 + Math.log2(count));
  return keywords;
}
