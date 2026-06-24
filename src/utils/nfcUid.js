const normalizeTagUid = (uid) => {
  if (!uid || typeof uid !== 'string') {
    return '';
  }

  return uid.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
};

const formatTagUid = (normalized) => {
  if (!normalized) {
    return '';
  }

  const pairs = [];
  for (let i = 0; i < normalized.length; i += 2) {
    pairs.push(normalized.slice(i, i + 2));
  }

  return pairs.join(':');
};

const isValidTagUid = (uid) => {
  const normalized = normalizeTagUid(uid);
  return normalized.length >= 4 && normalized.length <= 32;
};

module.exports = {
  normalizeTagUid,
  formatTagUid,
  isValidTagUid,
};
