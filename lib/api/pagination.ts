export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildMeta(total: number, page: number, limit: number) {
  return { total, page, limit, hasMore: page * limit < total };
}

// Cursor mode -- for feeds too unbounded for page/limit (e.g. message
// history), where "page 40 of a 10,000-message thread" isn't a meaningful
// request. `cursor` is the last-seen row's id.
export function parseCursorPagination(searchParams: URLSearchParams) {
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const cursor = searchParams.get('cursor');
  return { take, cursor };
}

// Pass `take + 1` to the query; this trims the lookahead row back off and
// turns its presence into hasMore/nextCursor.
export function buildCursorMeta<T extends { id: string }>(rows: T[], take: number) {
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { page, meta: { hasMore, nextCursor: hasMore ? page[page.length - 1].id : null } };
}
