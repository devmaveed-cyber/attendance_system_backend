const UAE_MOBILE_PATTERN = /^9715\d{8}$/;

const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('971')) return digits;
  if (digits.startsWith('0')) return `971${digits.slice(1)}`;
  if (digits.length === 9) return `971${digits}`;
  return digits;
};

const isValidUaeMobile = (phone) => UAE_MOBILE_PATTERN.test(normalizePhone(phone));

const phoneLookupVariants = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  const variants = new Set([normalized, `+${normalized}`]);
  if (normalized.startsWith('971')) {
    variants.add(normalized.slice(3));
    variants.add(`0${normalized.slice(3)}`);
  }

  return [...variants];
};

module.exports = {
  UAE_MOBILE_PATTERN,
  normalizePhone,
  isValidUaeMobile,
  phoneLookupVariants,
};
