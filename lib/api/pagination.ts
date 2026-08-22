export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildMeta(total: number, page: number, limit: number) {
  return { total, page, limit, hasMore: page * limit < total };
}
