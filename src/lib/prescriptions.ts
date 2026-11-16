export interface PrescriptionItem {
  name: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
}

const plainText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim() === '[object Object]' ? '' : value.trim();
  if (typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';

  const record = value as Record<string, unknown>;
  for (const key of ['name', 'medication', 'medicament', 'drugName', 'medicationName', 'genericName', 'displayName', 'label', 'value', 'text']) {
    const candidate = plainText(record[key]);
    if (candidate) return candidate;
  }
  return '';
};

export const normalizePrescription = (value: unknown): PrescriptionItem => {
  if (typeof value === 'string') {
    return { name: plainText(value), dosage: '', route: '', frequency: '', duration: '', quantity: '', instructions: '' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { name: '', dosage: '', route: '', frequency: '', duration: '', quantity: '', instructions: '' };
  }
  const item = value as Record<string, unknown>;
  return {
    name: plainText(item.name) || plainText(item.medication) || plainText(item.medicament) || plainText(item.drugName) || plainText(item.medicationName) || plainText(item.genericName),
    dosage: plainText(item.dosage),
    route: plainText(item.route),
    frequency: plainText(item.frequency),
    duration: plainText(item.duration),
    quantity: plainText(item.quantity),
    instructions: plainText(item.instructions),
  };
};

export const normalizePrescriptions = (values: unknown): PrescriptionItem[] =>
  (Array.isArray(values) ? values : [])
    .map(normalizePrescription)
    .filter((item) => Boolean(item.name));

export const displayPrescriptionValue = (value: string, translate: (key: string) => string): string =>
  value.startsWith('preset:') ? translate(value.slice('preset:'.length)) : value;
