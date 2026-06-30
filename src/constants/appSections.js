const APP_SECTIONS = [
  'dashboard',
  'attendance',
  'employees',
  'payroll',
  'branches',
  'nfcTags',
  'groups',
  'users',
  'chat',
  'announcements',
];

const normalizeSections = (sections) => {
  if (!Array.isArray(sections)) {
    return [];
  }

  const normalized = sections
    .map((section) => {
      if (section === 'students') {
        return 'employees';
      }

      return section;
    })
    .filter((section) => APP_SECTIONS.includes(section));

  return [...new Set(normalized)];
};

module.exports = { APP_SECTIONS, normalizeSections };
