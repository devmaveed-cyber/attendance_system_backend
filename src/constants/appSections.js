const APP_SECTIONS = [
  'dashboard',
  'attendance',
  'employees',
  'branches',
  'nfcTags',
  'groups',
  'users',
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
