import { ktabClass } from "./vocab.js";
/** KTAB KQ = KTAB/1000+1: verb class (see adventure.f / vocabHint). */
const CLASS_VERB = 3;
/**
 * Groups adventure.dat verb-class vocabulary by identical KTAB (true parser synonyms).
 */
export function buildVerbSynonymGroups(db) {
    const map = new Map();
    for (let i = 1; i < 1000; i++) {
        if (db.ktab[i] === 0 && db.atab[i].trim() === "")
            break;
        if (db.ktab[i] === -1)
            break;
        const ktab = db.ktab[i];
        if (ktabClass(ktab) !== CLASS_VERB)
            continue;
        const w = db.atab[i].trim();
        if (w.length === 0)
            continue;
        let set = map.get(ktab);
        if (!set) {
            set = new Set();
            map.set(ktab, set);
        }
        set.add(w);
    }
    const groups = [...map.entries()].map(([ktab, set]) => ({
        ktab,
        tokens: [...set].sort((a, b) => a.localeCompare(b)),
    }));
    groups.sort((a, b) => a.tokens[0].localeCompare(b.tokens[0]));
    return groups;
}
//# sourceMappingURL=verbSynonymGroups.js.map