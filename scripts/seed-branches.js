#!/usr/bin/env node
/**
 * Seed branches from the official branch list.
 *
 * Usage:
 *   node scripts/seed-branches.js          # insert missing branches
 *   node scripts/seed-branches.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Branch = require('../src/models/Branch');
const {
  DEFAULT_SHIFT_START,
  DEFAULT_SHIFT_END,
  DEFAULT_GRACE_MINUTES_LATE,
} = require('../src/constants/attendanceConstants');

const DEFAULT_IMPORT_LATITUDE = 25.14758;
const DEFAULT_IMPORT_LONGITUDE = 55.241171;
const DEFAULT_IMPORT_RADIUS_METERS = 500;

const BRANCH_NAMES = [
  'AL KARAMA - NEW',
  'AL KARAMA - OLD',
  'AL NAHDA BRANCH',
  'AL QUOZ LABOUR CAMP',
  'AL SALEM MALL',
  'AZHAR AL MADINA',
  'BURJ NAHAR MALL NESTO',
  'CITY CENTER MAISEM',
  'CORPORATE BRANCH - HEAD OFFICE',
  'DIERA CITY CENTER',
  'DISCOVERY GARDEN',
  'DUBAI FESTIVAL CITY',
  'DUBAI MALL BRANCH',
  'ECO AL FAHIDI',
  'ECO AL TAWAR',
  'ECO CIG CENTRAL MALL',
  'ECO CIRCLE MALL',
  'ECO DRAGON MART',
  'ECO DRIVE AL QUOZ CENTER',
  'ECO EASY LEASE',
  'ECO FRIJ MURAR',
  'ECO GRAND MALL',
  'ECO LULU AL BARSHA',
  'ECO MALL OF EMIRATES',
  'ECO MIRDIF CITY CENTER',
  'ECO NESTO MALL (NEW)',
  'ECO SHOPPER MALL',
  'FIDA AL MADINA',
  'HEAD OFFICE',
  'HOR AL ANZ - BRANCH - TALAL SUPERM',
  'HOR AL ANZ - NEW',
  'HOR AL ANZ AL MADINA - OLD',
  'IBN BATUTA MALL',
  'INTERNATIONAL CITY',
  'INTERNET CITY METRO STATION',
  'LULU AL QUSAIS',
  'LULU AL RASHIDIYA',
  'LULU AL WARQA',
  'NESTO JEBEL ALI (OLD)',
  'SAPHIRE MALL DIC',
  'SATWA BRANCH',
  'SONAPUR',
  'SOUQ EXTRA - DSO',
  'SOUQ XTRA DIP',
  'THE PARKS SHOPPING CENTER DIP',
  'UNION COOP AL AWEER',
  'VIP BRANCH',
];

const dryRun = process.argv.includes('--dry-run');

const normalizeBranchName = (value) => value.trim().replace(/\s+/g, ' ');
const normalizeBranchKey = (value) => normalizeBranchName(value).toLowerCase();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB${dryRun ? ' [DRY RUN]' : ''}`);

  const existing = await Branch.find().select('_id name');
  const lookup = new Map(
    existing.map((branch) => [normalizeBranchKey(branch.name), branch])
  );

  const toCreate = [];
  const skipped = [];

  for (const rawName of BRANCH_NAMES) {
    const name = normalizeBranchName(rawName);
    const key = normalizeBranchKey(name);

    if (lookup.has(key)) {
      skipped.push({ name, id: lookup.get(key)._id });
      continue;
    }

    toCreate.push(name);
  }

  console.log(`\nBranch list: ${BRANCH_NAMES.length}`);
  console.log(`Already in DB: ${skipped.length}`);
  console.log(`To create: ${toCreate.length}`);

  if (skipped.length) {
    console.log('\nSkipped (already exist):');
    for (const item of skipped) {
      console.log(`  - ${item.id} ${item.name}`);
    }
  }

  if (toCreate.length) {
    console.log('\nWill create:');
    for (const name of toCreate) {
      console.log(`  - ${name}`);
    }
  }

  if (!toCreate.length) {
    console.log('\nAll branches already exist. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  if (dryRun) {
    console.log('\nDry run only — nothing inserted. Re-run without --dry-run to insert.');
    await mongoose.disconnect();
    return;
  }

  const created = [];

  for (const name of toCreate) {
    const branch = await Branch.create({
      name,
      address: name,
      latitude: DEFAULT_IMPORT_LATITUDE,
      longitude: DEFAULT_IMPORT_LONGITUDE,
      radiusMeters: DEFAULT_IMPORT_RADIUS_METERS,
      shiftStartTime: DEFAULT_SHIFT_START,
      shiftEndTime: DEFAULT_SHIFT_END,
      graceMinutesLate: DEFAULT_GRACE_MINUTES_LATE,
      isActive: true,
    });
    created.push(branch);
    console.log(`Created ${branch._id} — ${branch.name}`);
  }

  const total = await Branch.countDocuments();
  console.log(`\nDone. Created ${created.length} branch(es). Total branches in DB: ${total}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
