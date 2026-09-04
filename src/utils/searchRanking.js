const normalizeSearchValue = (value) => String(value ?? '').trim().toLocaleLowerCase();

export const getSearchMatchRank = (searchTerm, prioritizedValues = [], fallbackValue = '') => {
  const query = normalizeSearchValue(searchTerm);
  if (!query) return 0;

  const values = prioritizedValues.map(normalizeSearchValue).filter(Boolean);
  const fallback = normalizeSearchValue(fallbackValue);

  if (values.some((value) => value === query)) return 0;
  if (values.some((value) => value.startsWith(query))) return 1;
  if (values.some((value) => value.split(/\s+/).some((part) => part.startsWith(query)))) return 2;
  if (values.some((value) => value.includes(query))) return 3;
  if (fallback.startsWith(query)) return 4;
  if (fallback.split(/\s+/).some((part) => part.startsWith(query))) return 5;
  if (fallback.includes(query)) return 6;

  return Number.POSITIVE_INFINITY;
};

export const sortBySearchRelevance = (
  items,
  searchTerm,
  getPrioritizedValues,
  getFallbackValue = () => '',
  tieBreaker
) => [...items].sort((firstItem, secondItem) => {
  const rankComparison = getSearchMatchRank(
    searchTerm,
    getPrioritizedValues(firstItem),
    getFallbackValue(firstItem)
  ) - getSearchMatchRank(
    searchTerm,
    getPrioritizedValues(secondItem),
    getFallbackValue(secondItem)
  );

  if (rankComparison !== 0) return rankComparison;
  return tieBreaker?.(firstItem, secondItem) || 0;
});
