/** Maps auto-detected overlay regions to extracted field keys for hover highlighting. */
export const AADHAAR_REGION_FIELD_KEYS: Record<string, string[]> = {
  full_document: ['name', 'given_names', 'surname', 'dob', 'gender', 'doc_number'],
  letter_section: ['doc_number', 'name'],
  portrait: ['portrait'],
  identity_details: ['name', 'given_names', 'surname', 'dob', 'gender'],
  name: ['name', 'given_names', 'surname'],
  surname: ['surname', 'name'],
  given_names: ['given_names', 'name'],
  mrz: ['doc_number', 'dob', 'nationality'],
  father_name: ['given_names'],
  expiry_date: ['expiry_date'],
  expiry: ['expiry_date'],
  dob: ['dob'],
  gender: ['gender'],
  qr_code: ['qr_code'],
  doc_number: ['doc_number'],
};

export function isFieldInRegion(fieldKey: string, regionKey: string | null): boolean {
  if (!regionKey) return false;
  if (fieldKey === regionKey) return true;
  const group = AADHAAR_REGION_FIELD_KEYS[regionKey];
  return group?.includes(fieldKey) ?? false;
}
