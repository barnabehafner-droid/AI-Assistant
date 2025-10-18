// --- Levenshtein distance function for fuzzy string matching ---
export const levenshteinDistance = (a: string, b: string): number => {
    const an = a ? a.length : 0;
    const bn = b ? b.length : 0;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = new Array(bn + 1);
    for (let i = 0; i <= bn; ++i) {
        matrix[i] = new Array(an + 1);
    }
    for (let i = 0; i <= bn; ++i) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= an; ++j) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= bn; ++i) {
        for (let j = 1; j <= an; ++j) {
            const cost = a[j - 1] === b[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost,
            );
        }
    }
    return matrix[bn][an];
};

export const findBestMatch = <T extends { [key in K]: any }, K extends keyof T>(
  items: T[],
  query: string,
  key: K,
  threshold = 0.6
): T | null => {
  if (!items || items.length === 0 || !query) {
    return null;
  }

  const lowerQuery = query.toLowerCase();
  let bestMatch: T | null = null;
  let minDistance = Infinity;

  for (const item of items) {
    const itemText = item[key];
    if (typeof itemText !== 'string') {
        continue;
    }
    
    const distance = levenshteinDistance(lowerQuery, itemText.toLowerCase());
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = item;
    }
  }

  if (bestMatch) {
      const bestMatchText = bestMatch[key];
      if (typeof bestMatchText === 'string' && minDistance <= Math.max(lowerQuery.length, bestMatchText.length) * threshold) {
        return bestMatch;
      }
  }
  
  return null;
};