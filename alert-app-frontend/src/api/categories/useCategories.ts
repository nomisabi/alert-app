import { useGetCategories } from '../generated/categories/categories';

/** Our news categories as a list of ids, in display order (GET /api/categories). */
export function useCategories() {
  return useGetCategories({
    query: {
      select: (list) => list.items.map((category) => category.id),
      // The list only changes with a backend release: load it once per visit
      staleTime: Infinity,
    },
  });
}
