import type { ParsedItem } from './nlp';
import type { Product } from './products';

// Every spoken item lands in exactly one of three buckets (PRD B-2):
//   matched   → one clear product
//   ambiguous → several plausible products, the buyer picks (max 5 shown)
//   unmatched → nothing plausible, the buyer can search manually
export type MatchResult =
  | { kind: 'matched'; item: ParsedItem; product: Product }
  | { kind: 'ambiguous'; item: ParsedItem; candidates: Product[] }
  | { kind: 'unmatched'; item: ParsedItem };

const MAX_CANDIDATES = 5;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function matchItem(item: ParsedItem, products: Product[]): MatchResult {
  const spoken = normalize(item.name);
  if (!spoken) return { kind: 'unmatched', item };
  const spokenTokens = spoken.split(' ');

  // Score each product by how well its name overlaps the spoken words.
  const scored = products
    .map((product) => {
      const prodNorm = normalize(product.name);
      if (prodNorm === spoken) return { product, score: 1000 }; // exact name
      // full containment either way ("indomie" ⊂ "indomie goreng jumbo")
      let score = 0;
      if (prodNorm.includes(spoken) || spoken.includes(prodNorm)) score += 100;
      // shared words ("minyak goreng bimoli" vs "Minyak Goreng Sania 1L" → 2)
      const prodTokens = prodNorm.split(' ');
      score += spokenTokens.filter((t) => prodTokens.includes(t)).length * 10;
      return { product, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: 'unmatched', item };
  // A single candidate, or one clearly ahead of the rest → confident match.
  if (scored.length === 1 || scored[0].score >= scored[1].score * 2) {
    return { kind: 'matched', item, product: scored[0].product };
  }
  return {
    kind: 'ambiguous',
    item,
    candidates: scored.slice(0, MAX_CANDIDATES).map((s) => s.product),
  };
}

export function matchOrder(items: ParsedItem[], products: Product[]): MatchResult[] {
  return items.map((item) => matchItem(item, products));
}
