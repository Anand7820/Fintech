import { KYCDocument, VerificationStatus, BoundingBox } from '@/types/kyc';
import type { DetectedRegionApi, FieldMatchApi } from '@/lib/api';

export function useDocumentParser() {
  const mapApiStatus = (apiStatus: string): VerificationStatus => {
    if (apiStatus === 'verified') return 'success';
    if (apiStatus === 'flagged') return 'failed';
    return 'warning';
  };

  const fieldMatchLookup = (fieldMatches: FieldMatchApi[] | undefined) => {
    const map: Record<string, boolean> = {};
    if (!fieldMatches?.length) return map;
    for (const item of fieldMatches) {
      map[item.field] = item.match;
    }
    return map;
  };

  const resolveVerificationStatus = (
    apiStatus: string,
    extractedFields: KYCDocument['extractedFields'],
    identityVerified: boolean
  ): VerificationStatus => {
    const checked = extractedFields.filter((f) => f.isMatch !== undefined);
    if (checked.length > 0) {
      const failed = checked.filter((f) => f.isMatch === false);
      if (failed.length > 0) {
        return failed.length === checked.length ? 'failed' : 'warning';
      }
    }
    if (!identityVerified) {
      return apiStatus === 'flagged' ? 'failed' : 'warning';
    }
    return mapApiStatus(apiStatus);
  };

  const mapDetectedRegions = (regions: DetectedRegionApi[] | undefined): BoundingBox[] => {
    if (!regions?.length) return [];
    return regions.map((r) => ({
      label: r.label,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      fieldKey: r.field_key,
    }));
  };

  const buildPassportFields = (
    name: string | null | undefined,
    surname: string | null | undefined,
    givenNames: string | null | undefined,
    dob: string | null | undefined,
    docId: string | null | undefined,
    nationality: string | null | undefined,
    confidence: number,
    matchMap: Record<string, boolean>
  ) => {
    const fields: KYCDocument['extractedFields'] = [];
    const displayName = name || [givenNames, surname].filter(Boolean).join(' ');
    const nameOk = matchMap.name ?? false;
    if (displayName) {
      fields.push({ key: 'name', label: 'Full Name', value: displayName, confidence, isMatch: nameOk });
    }
    if (surname) {
      fields.push({ key: 'surname', label: 'Surname', value: surname, confidence, isMatch: nameOk });
    }
    if (givenNames) {
      fields.push({ key: 'given_names', label: 'Given Names', value: givenNames, confidence, isMatch: nameOk });
    }
    if (dob) {
      fields.push({
        key: 'dob',
        label: 'Date of Birth',
        value: dob,
        confidence,
        isMatch: matchMap.date_of_birth ?? false,
      });
    }
    if (nationality) {
      fields.push({
        key: 'nationality',
        label: 'Nationality',
        value: nationality,
        confidence,
        isMatch: nameOk,
      });
    }
    if (docId) {
      fields.push({
        key: 'doc_number',
        label: 'Passport Number',
        value: docId,
        confidence,
        isMatch: matchMap.document_id ?? false,
      });
    }
    fields.push({ key: 'doc_type', label: 'Document Type', value: 'PASSPORT (P)', confidence: 99 });
    return fields;
  };

  const buildPanFields = (
    name: string | null | undefined,
    fatherName: string | null | undefined,
    dob: string | null | undefined,
    pan: string | null | undefined,
    confidence: number,
    matchMap: Record<string, boolean>
  ) => {
    const fields: KYCDocument['extractedFields'] = [];
    const nameOk = matchMap.name ?? false;
    const panOk = matchMap.document_id ?? false;
    if (name) {
      fields.push({ key: 'name', label: 'Full Name', value: name, confidence, isMatch: nameOk });
    }
    if (fatherName) {
      fields.push({
        key: 'given_names',
        label: "Father's Name",
        value: fatherName,
        confidence,
        isMatch: nameOk,
      });
    }
    if (dob) {
      fields.push({
        key: 'dob',
        label: 'Date of Birth',
        value: dob,
        confidence,
        isMatch: matchMap.date_of_birth ?? false,
      });
    }
    if (pan) {
      fields.push({
        key: 'doc_number',
        label: 'PAN Number',
        value: pan,
        confidence,
        isMatch: panOk,
      });
    }
    fields.push({ key: 'doc_type', label: 'Document Type', value: 'PAN (India)', confidence: 99 });
    return fields;
  };

  const buildLicenseFields = (
    name: string | null | undefined,
    dob: string | null | undefined,
    expiry: string | null | undefined,
    licenseId: string | null | undefined,
    state: string | null | undefined,
    confidence: number,
    matchMap: Record<string, boolean>
  ) => {
    const fields: KYCDocument['extractedFields'] = [];
    const nameOk = matchMap.name ?? false;
    const idOk = matchMap.document_id ?? false;
    if (name) {
      fields.push({ key: 'name', label: 'Full Name', value: name, confidence, isMatch: nameOk });
    }
    if (dob) {
      fields.push({
        key: 'dob',
        label: 'Date of Birth',
        value: dob,
        confidence,
        isMatch: matchMap.date_of_birth ?? false,
      });
    }
    if (expiry) {
      fields.push({
        key: 'expiry_date',
        label: 'Expiry Date',
        value: expiry,
        confidence,
        isMatch: idOk,
      });
    }
    if (licenseId) {
      fields.push({
        key: 'doc_number',
        label: 'License Number',
        value: licenseId,
        confidence,
        isMatch: idOk,
      });
    }
    if (state) {
      fields.push({
        key: 'nationality',
        label: 'State / Region',
        value: state,
        confidence,
      });
    }
    fields.push({ key: 'doc_type', label: 'Document Type', value: "DRIVER'S LICENSE", confidence: 99 });
    return fields;
  };

  const buildAadhaarFields = (
    name: string | null | undefined,
    dob: string | null | undefined,
    docId: string | null | undefined,
    confidence: number,
    matchMap: Record<string, boolean>,
    checksumValid: boolean
  ) => {
    const fields: KYCDocument['extractedFields'] = [];
    const nameOk = matchMap.name ?? false;
    const dobOk = matchMap.date_of_birth ?? false;
    const uidOk = (matchMap.document_id ?? false) || checksumValid;
    if (name) {
      const parts = name.trim().split(/\s+/);
      const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
      fields.push({ key: 'name', label: 'Full Name', value: name, confidence, isMatch: nameOk });
      if (given) {
        fields.push({ key: 'given_names', label: 'Given Names', value: given, confidence, isMatch: nameOk });
      }
      fields.push({ key: 'surname', label: 'Surname', value: surname, confidence, isMatch: nameOk });
    }
    if (dob) {
      fields.push({ key: 'dob', label: 'Date of Birth', value: dob, confidence, isMatch: dobOk });
    }
    fields.push({ key: 'gender', label: 'Gender', value: 'Male', confidence, isMatch: nameOk && dobOk });
    if (docId) {
      const formatted = docId.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      fields.push({
        key: 'doc_number',
        label: 'Aadhaar Number',
        value: formatted,
        confidence,
        isMatch: uidOk,
      });
    }
    return fields;
  };

  return {
    mapApiStatus,
    fieldMatchLookup,
    resolveVerificationStatus,
    mapDetectedRegions,
    buildPassportFields,
    buildPanFields,
    buildLicenseFields,
    buildAadhaarFields,
  };
}
