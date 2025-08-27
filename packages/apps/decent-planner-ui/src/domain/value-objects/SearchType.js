/**
 * SearchType Value Object
 * Immutable enumeration of search types
 */

export const SearchType = Object.freeze({
  TEXT: 'TEXT',
  SEMANTIC: 'SEMANTIC'
});

export function isValidSearchType(type) {
  return Object.values(SearchType).includes(type);
}

export function getSearchTypeLabel(type) {
  const labels = {
    [SearchType.TEXT]: 'Text Search',
    [SearchType.SEMANTIC]: 'Semantic Search'
  };
  return labels[type] || 'Unknown';
}