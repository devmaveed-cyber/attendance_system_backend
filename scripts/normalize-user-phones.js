#!/usr/bin/env node
/**
 * Normalize all user phone numbers to 9715XXXXXXXX storage format.
 *
 * Usage:
 *   node scripts/normalize-user-phones.js          # dry run (report only)
 *   node scripts/normalize-user-phones.js --apply  # write changes to DB
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');
const { normalizePhone } = require('../src/utils/phoneUtils');

const applyChanges = process.argv.includes('--apply');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB (${applyChanges ? 'APPLY' : 'DRY RUN'})\n`);

  const users = await User.find({}).select('_id name email phone accountRole').lean();
  const updates = [];
  const emptyPhones = [];
  const phoneGroups = new Map();

  for (const user of users) {
    const current = String(user.phone || '').trim();
    const normalized = normalizePhone(current);

    if (!normalized) {
      emptyPhones.push(user);
    } else {
      const group = phoneGroups.get(normalized) || [];
      group.push(user);
      phoneGroups.set(normalized, group);
    }

    if (current !== normalized) {
      updates.push({ user, from: current, to: normalized });
    }
  }

  console.log(`Total users: ${users.length}`);
  console.log(`Phones to normalize: ${updates.length}`);
  console.log(`Empty phones: ${emptyPhones.length}`);

  const duplicates = [...phoneGroups.entries()].filter(([, group]) => group.length > 1);
  console.log(`Duplicate phone groups: ${duplicates.length}\n`);

  if (updates.length > 0) {
    console.log('Format updates:');
    for (const entry of updates.slice(0, 20)) {
      console.log(
        `  ${entry.user._id} (${entry.user.name}): "${entry.from}" -> "${entry.to}"`
      );
    }
    if (updates.length > 20) {
      console.log(`  ... and ${updates.length - 20} more`);
    }
    console.log('');
  }

  if (duplicates.length > 0) {
    console.log('Duplicate phones (login will fail until resolved):');
    for (const [phone, group] of duplicates) {
      console.log(`  ${phone} (${group.length} accounts):`);
      for (const user of group) {
        console.log(`    - ${user._id} ${user.name} (${user.accountRole}) ${user.email}`);
      }
    }
    console.log('');
  }

  if (emptyPhones.length > 0) {
    console.log('Users without phone (cannot login with phone):');
    for (const user of emptyPhones) {
      console.log(`  - ${user._id} ${user.name} (${user.accountRole}) ${user.email}`);
    }
    console.log('');
  }

  if (!applyChanges) {
    console.log('Dry run complete. Re-run with --apply to save normalized phones.');
    return;
  }

  let changed = 0;
  for (const entry of updates) {
    await User.updateOne({ _id: entry.user._id }, { $set: { phone: entry.to } });
    changed += 1;
  }

  console.log(`Applied ${changed} phone normalization updates.`);
  if (duplicates.length > 0) {
    console.log(
      'Warning: duplicate phones remain. Update conflicting accounts before enforcing unique phone login.'
    );
  }
}

main()
  .catch((error) => {
    console.error('FAIL:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
