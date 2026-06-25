const parsePaginationQuery = (query, { defaultLimit = 25, maxLimit = 100 } = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: total > 0 ? Math.ceil(total / limit) : 1,
});

module.exports = {
  parsePaginationQuery,
  buildPaginationMeta,
};
