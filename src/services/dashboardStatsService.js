const DashboardDailyStat = require('../models/DashboardDailyStat');
const DashboardMeta = require('../models/DashboardMeta');
const Branch = require('../models/Branch');
const NfcTag = require('../models/NfcTag');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { resolveAllowedSections } = require('./authService');
const {
  aggregateDashboardDayStats,
  buildOverviewRows,
  dateKeyFor,
  listDateKeysInRange,
  parseDateKey,
  formatDateKeyFromDate,
} = require('../utils/attendanceOverviewBuilder');

const STATS_VERSION = 1;
const COVERAGE_DOC_ID = 'attendance_coverage';
const DEFAULT_TREND_DAYS = 7;
const MAX_TREND_DAYS = 31;

const pendingDayRebuilds = new Set();
let rebuildFlushScheduled = false;

const trendLabelFor = (dateKey) => {
  const date = parseDateKey(dateKey);
  return `${date.getDate()}/${date.getMonth() + 1}`;
};

const listTrendDateKeys = (trendDays, anchorDateKey = dateKeyFor()) => {
  const anchor = parseDateKey(anchorDateKey);
  const keys = [];

  for (let offset = trendDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(anchor);
    day.setDate(day.getDate() - offset);
    keys.push(formatDateKeyFromDate(day));
  }

  return keys;
};

const updateCoverage = async ({ earliestKey, latestKey }) => {
  const meta = await DashboardMeta.findById(COVERAGE_DOC_ID);
  const existing = meta?.toObject() || {};
  const sameVersion = existing.version === STATS_VERSION;

  let earliest = sameVersion ? existing.earliestDate : null;
  let latest = sameVersion ? existing.latestDate : null;

  if (earliestKey && (!earliest || earliestKey < earliest)) {
    earliest = earliestKey;
  }
  if (latestKey && (!latest || latestKey > latest)) {
    latest = latestKey;
  }

  await DashboardMeta.findByIdAndUpdate(
    COVERAGE_DOC_ID,
    {
      _id: COVERAGE_DOC_ID,
      version: STATS_VERSION,
      earliestDate: earliest,
      latestDate: latest,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const rebuildDay = async (dateKey) => {
  const rows = await buildOverviewRows({ dateKeys: [dateKey] });
  const aggregated = aggregateDashboardDayStats(rows);

  await DashboardDailyStat.findByIdAndUpdate(
    dateKey,
    {
      _id: dateKey,
      dateKey,
      version: STATS_VERSION,
      summary: aggregated.summary,
      byBranch: aggregated.byBranch,
      byMethod: aggregated.byMethod,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await updateCoverage({ earliestKey: dateKey, latestKey: dateKey });

  return aggregated;
};

const rebuildDays = async (startKey, endKey) => {
  const dateKeys = listDateKeysInRange(startKey, endKey);
  const results = [];

  for (const dateKey of dateKeys) {
    results.push(await rebuildDay(dateKey));
  }

  return results;
};

const getStoredDayStats = async (dateKey) => {
  const doc = await DashboardDailyStat.findById(dateKey);
  if (!doc || doc.version !== STATS_VERSION) {
    return null;
  }

  return {
    dateKey: doc.dateKey,
    summary: doc.summary,
    byBranch: doc.byBranch,
    byMethod: doc.byMethod,
    source: 'precomputed',
  };
};

const getOrBuildDayStats = async (dateKey, { forceLive = false } = {}) => {
  if (!forceLive) {
    const stored = await getStoredDayStats(dateKey);
    if (stored) {
      return stored;
    }
  }

  const aggregated = await rebuildDay(dateKey);
  return {
    dateKey,
    summary: aggregated.summary,
    byBranch: aggregated.byBranch,
    byMethod: aggregated.byMethod,
    source: 'live',
  };
};

const flushPendingDayRebuilds = async () => {
  rebuildFlushScheduled = false;
  const keys = [...pendingDayRebuilds];
  pendingDayRebuilds.clear();

  for (const dateKey of keys) {
    try {
      await rebuildDay(dateKey);
    } catch (error) {
      console.error(`dashboard day rebuild failed for ${dateKey}`, error);
    }
  }
};

const scheduleDayRebuild = (dateKey) => {
  if (!dateKey) return;
  pendingDayRebuilds.add(dateKey);
  if (rebuildFlushScheduled) return;
  rebuildFlushScheduled = true;
  setImmediate(() => {
    flushPendingDayRebuilds().catch((error) => {
      console.error('dashboard day rebuild flush failed', error);
    });
  });
};

const ensureTrendBackfill = async (dateKeys) => {
  for (const dateKey of dateKeys) {
    const stored = await getStoredDayStats(dateKey);
    if (!stored) {
      await rebuildDay(dateKey);
    }
  }
};

const buildWeekTrend = (dayStats) =>
  dayStats.map((day) => ({
    dateKey: day.dateKey,
    label: trendLabelFor(day.dateKey),
    present: day.summary.checkedInCount,
    absent: Math.max(0, day.summary.totalRows - day.summary.checkedInCount),
    late: day.summary.lateCount,
  }));

const getSummary = async (requester, { trendDays = DEFAULT_TREND_DAYS } = {}) => {
  if (requester.accountRole !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }

  const allowedSections = await resolveAllowedSections(requester);
  const canEmployees = allowedSections.includes('employees');
  const canBranches = allowedSections.includes('branches');
  const canNfcTags = allowedSections.includes('nfcTags');
  const canAttendance = allowedSections.includes('attendance');

  const counts = {};

  const countTasks = [];

  if (canEmployees) {
    countTasks.push(
      User.countDocuments({ accountRole: 'employee', isActive: true }).then(
        (value) => {
          counts.employees = value;
        }
      )
    );
  }

  if (canBranches) {
    countTasks.push(
      Branch.countDocuments().then((value) => {
        counts.branches = value;
      })
    );
  }

  if (canNfcTags) {
    countTasks.push(
      NfcTag.countDocuments({ isActive: true }).then((value) => {
        counts.nfcTags = value;
      })
    );
  }

  await Promise.all(countTasks);

  const response = {
    counts,
    trendDays: Math.min(
      MAX_TREND_DAYS,
      Math.max(1, Number.parseInt(String(trendDays), 10) || DEFAULT_TREND_DAYS)
    ),
  };

  if (!canAttendance) {
    return response;
  }

  const todayKey = dateKeyFor();
  const trendDateKeys = listTrendDateKeys(response.trendDays, todayKey);

  await ensureTrendBackfill(trendDateKeys);

  const dayStats = await Promise.all(
    trendDateKeys.map((dateKey) => getOrBuildDayStats(dateKey))
  );

  const todayStats =
    dayStats.find((day) => day.dateKey === todayKey) ||
    (await getOrBuildDayStats(todayKey, { forceLive: true }));

  response.today = {
    dateKey: todayKey,
    summary: todayStats.summary,
    byBranch: todayStats.byBranch,
    byMethod: todayStats.byMethod,
    source: todayStats.source,
  };
  response.weekTrend = buildWeekTrend(dayStats);

  return response;
};

module.exports = {
  STATS_VERSION,
  DEFAULT_TREND_DAYS,
  MAX_TREND_DAYS,
  rebuildDay,
  rebuildDays,
  scheduleDayRebuild,
  getSummary,
  getOrBuildDayStats,
};
