const SAFE_DESCRIPTORS = new Set([
  'boneless',
  'skinless',
  'fresh',
  'frozen',
  'raw',
  'cooked',
  'chopped',
  'diced',
  'sliced',
  'minced',
  'shredded',
  'grated',
  'whole',
  'large',
  'small',
  'medium',
  'extra',
]);

const singularizeToken = (token: string) => {
  if (token.length <= 3) return token;
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.endsWith('oes')) return token.slice(0, -2);
  if (token.endsWith('ches') || token.endsWith('shes')) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
};

export const normalizeMealIngredient = (value: unknown) => {
  const cleaned = String(value ?? '')
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[.,;:!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const tokens = cleaned
    .split(' ')
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter(Boolean)
    .filter((token) => !SAFE_DESCRIPTORS.has(token))
    .map(singularizeToken);

  return tokens.join(' ').trim();
};
