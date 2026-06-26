const normalizeBranchName = (value) => value.trim().replace(/\s+/g, ' ');

const normalizeBranchKey = (value) => normalizeBranchName(value).toLowerCase();

const tokenizeBranchName = (value) =>
  normalizeBranchKey(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const EXPLICIT_BRANCH_ALIASES = {
  'al karama branch': 'AL KARAMA - NEW',
  'eco grand hybermarket': 'ECO GRAND MALL',
  'eco grand hypermarket': 'ECO GRAND MALL',
  'eco nest mall': 'ECO NESTO MALL (NEW)',
  'hor al anz - branch': 'HOR AL ANZ - BRANCH - TALAL SUPERM',
  'nesto hypermarket': 'NESTO JEBEL ALI (OLD)',
};

const scoreBranchNameMatch = (excelName, dbName) => {
  const excelKey = normalizeBranchKey(excelName);
  const dbKey = normalizeBranchKey(dbName);

  if (excelKey === dbKey) {
    return 1000;
  }

  const excelTokens = tokenizeBranchName(excelName);
  const dbTokens = new Set(tokenizeBranchName(dbName));
  const overlap = excelTokens.filter((token) => dbTokens.has(token)).length;

  let score = overlap * 20;

  if (dbKey.includes(excelKey) || excelKey.includes(dbKey)) {
    score += 50;
  }

  return score;
};

const buildBranchLookup = (branches) => {
  const lookup = new Map();

  for (const branch of branches) {
    lookup.set(normalizeBranchKey(branch.name), branch);
  }

  return lookup;
};

const resolveBranchFromExcelName = (excelBranchName, branches) => {
  const trimmed = normalizeBranchName(excelBranchName);

  if (!trimmed) {
    return { branch: null, matchType: 'empty' };
  }

  const lookup = buildBranchLookup(branches);
  const aliasTarget = EXPLICIT_BRANCH_ALIASES[normalizeBranchKey(trimmed)];

  if (aliasTarget) {
    const branch = lookup.get(normalizeBranchKey(aliasTarget));

    if (branch) {
      return { branch, matchType: 'alias', matchedName: branch.name };
    }
  }

  const exact = lookup.get(normalizeBranchKey(trimmed));

  if (exact) {
    return { branch: exact, matchType: 'exact', matchedName: exact.name };
  }

  let best = null;
  let bestScore = 0;

  for (const branch of branches) {
    const score = scoreBranchNameMatch(trimmed, branch.name);

    if (score > bestScore) {
      bestScore = score;
      best = branch;
    }
  }

  if (best && bestScore >= 40) {
    return {
      branch: best,
      matchType: 'fuzzy',
      matchedName: best.name,
      score: bestScore,
    };
  }

  return { branch: null, matchType: 'unmatched', excelName: trimmed };
};

module.exports = {
  normalizeBranchName,
  normalizeBranchKey,
  EXPLICIT_BRANCH_ALIASES,
  scoreBranchNameMatch,
  buildBranchLookup,
  resolveBranchFromExcelName,
};
