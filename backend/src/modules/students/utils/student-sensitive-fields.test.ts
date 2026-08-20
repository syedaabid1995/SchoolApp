import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../../../config/env';
import { isEncryptedSensitiveField, isSensitiveLookupHash } from '../../../utils/sensitiveFieldCrypto';
import {
  decryptStudentSensitiveFieldList,
  decryptStudentSensitiveFields,
  encryptStudentSensitiveFields,
  isStudentSearchableContactHashField,
  studentAnyContactHashWhere,
  studentContactHashWhere,
} from './student-sensitive-fields';

const TEST_KEY = 'student_sensitive_field_key_32_chars_minimum';

const withSensitiveEncryptionEnv = <T>(
  enabled: boolean,
  callback: () => T,
) => {
  const originalEnabled = env.SENSITIVE_FIELD_ENCRYPTION_ENABLED;
  const originalKey = env.SENSITIVE_FIELD_ENCRYPTION_KEY;

  try {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = enabled;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = TEST_KEY;
    return callback();
  } finally {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = originalEnabled;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = originalKey;
  }
};

test('encryptStudentSensitiveFields leaves values plaintext when flag is disabled', () => {
  withSensitiveEncryptionEnv(false, () => {
    const stored = encryptStudentSensitiveFields({
      admissionNo: 'ADM-1',
      presentAddress: '12 Main Road',
      bloodGroup: 'O+',
      medicalConditions: 'Asthma',
      emergencyContact: '9000000004',
      doctorContact: '9000000005',
    });

    assert.equal(stored.admissionNo, 'ADM-1');
    assert.equal(stored.presentAddress, '12 Main Road');
    assert.equal(stored.bloodGroup, 'O+');
    assert.equal(stored.medicalConditions, 'Asthma');
    assert.equal(stored.emergencyContact, '9000000004');
    assert.equal(stored.doctorContact, '9000000005');
  });
});

test('encryptStudentSensitiveFields does not require a key for docAadhaar when flag is disabled', () => {
  const originalEnabled = env.SENSITIVE_FIELD_ENCRYPTION_ENABLED;
  const originalKey = env.SENSITIVE_FIELD_ENCRYPTION_KEY;

  try {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = false;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = undefined;

    const stored = encryptStudentSensitiveFields({ docAadhaar: 'plain-aadhaar-ref' });

    assert.equal(stored.docAadhaar, 'plain-aadhaar-ref');
    assert.equal(stored.docAadhaarHash, null);
  } finally {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = originalEnabled;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = originalKey;
  }
});

test('encryptStudentSensitiveFields encrypts configured high-risk student fields', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptStudentSensitiveFields({
      admissionNo: 'ADM-1',
      parentPhone: '9000000000',
      docAadhaar: '1234-5678-9012',
      presentAddress: '12 Main Road',
      permanentAddress: null,
      bloodGroup: 'O+',
      emergencyContact: '9000000004',
      doctorContact: '9000000005',
      docBirthCert: 's3://bucket/birth.pdf',
    });

    assert.equal(stored.admissionNo, 'ADM-1');
    assert.equal(isEncryptedSensitiveField(stored.parentPhone), true);
    assert.equal(isSensitiveLookupHash(stored.parentPhoneHash), true);
    assert.equal(isEncryptedSensitiveField(stored.docAadhaar), true);
    assert.equal(isSensitiveLookupHash(stored.docAadhaarHash), true);
    assert.equal(stored.permanentAddress, null);
    assert.equal(isEncryptedSensitiveField(stored.presentAddress), true);
    assert.equal(isEncryptedSensitiveField(stored.bloodGroup), true);
    assert.equal(isEncryptedSensitiveField(stored.emergencyContact), true);
    assert.equal(isEncryptedSensitiveField(stored.doctorContact), true);
    assert.equal(isSensitiveLookupHash(stored.emergencyContactHash), true);
    assert.equal(isSensitiveLookupHash(stored.doctorContactHash), true);
    assert.equal(isEncryptedSensitiveField(stored.docBirthCert), true);

    const apiResponse = decryptStudentSensitiveFields(stored);
    assert.equal(apiResponse.parentPhone, '9000000000');
    assert.equal(apiResponse.presentAddress, '12 Main Road');
    assert.equal(apiResponse.bloodGroup, 'O+');
    assert.equal(apiResponse.emergencyContact, '9000000004');
    assert.equal(apiResponse.doctorContact, '9000000005');
    assert.equal(apiResponse.docBirthCert, 's3://bucket/birth.pdf');
    assert.equal(apiResponse.docAadhaar, '1234-5678-9012');
  });
});

test('encryptStudentSensitiveFields encrypts searchable contacts and adds lookup hashes', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptStudentSensitiveFields({
      email: ' Student@Example.COM ',
      phone: '9000000000',
      fatherPhone: '9000000001',
      motherPhone: '9000000002',
      parentPhone: '9000000003',
      parentEmail: ' Parent@Example.COM ',
    });
    const same = encryptStudentSensitiveFields({
      email: 'student@example.com',
      parentEmail: 'parent@example.com',
    });

    assert.equal(isEncryptedSensitiveField(stored.email), true);
    assert.equal(isEncryptedSensitiveField(stored.phone), true);
    assert.equal(isEncryptedSensitiveField(stored.fatherPhone), true);
    assert.equal(isEncryptedSensitiveField(stored.motherPhone), true);
    assert.equal(isEncryptedSensitiveField(stored.parentPhone), true);
    assert.equal(isEncryptedSensitiveField(stored.parentEmail), true);
    assert.equal(isSensitiveLookupHash(stored.emailHash), true);
    assert.equal(isSensitiveLookupHash(stored.phoneHash), true);
    assert.equal(isSensitiveLookupHash(stored.fatherPhoneHash), true);
    assert.equal(isSensitiveLookupHash(stored.motherPhoneHash), true);
    assert.equal(isSensitiveLookupHash(stored.parentPhoneHash), true);
    assert.equal(isSensitiveLookupHash(stored.parentEmailHash), true);
    assert.equal(stored.emailHash, same.emailHash);
    assert.equal(stored.parentEmailHash, same.parentEmailHash);

    const apiResponse = decryptStudentSensitiveFields(stored);
    assert.equal(apiResponse.email, ' Student@Example.COM ');
    assert.equal(apiResponse.phone, '9000000000');
    assert.equal(apiResponse.fatherPhone, '9000000001');
    assert.equal(apiResponse.motherPhone, '9000000002');
    assert.equal(apiResponse.parentPhone, '9000000003');
    assert.equal(apiResponse.parentEmail, ' Parent@Example.COM ');
  });
});

test('encryptStudentSensitiveFields encrypts emergency and doctor contacts with lookup hashes', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptStudentSensitiveFields({
      emergencyContact: '9000000004',
      doctorContact: '9000000005',
    });
    const same = encryptStudentSensitiveFields({
      emergencyContact: '9000000004',
      doctorContact: '9000000005',
    });

    assert.equal(isEncryptedSensitiveField(stored.emergencyContact), true);
    assert.equal(isEncryptedSensitiveField(stored.doctorContact), true);
    assert.equal(isSensitiveLookupHash(stored.emergencyContactHash), true);
    assert.equal(isSensitiveLookupHash(stored.doctorContactHash), true);
    assert.equal(stored.emergencyContactHash, same.emergencyContactHash);
    assert.equal(stored.doctorContactHash, same.doctorContactHash);

    const apiResponse = decryptStudentSensitiveFields(stored);
    assert.equal(apiResponse.emergencyContact, '9000000004');
    assert.equal(apiResponse.doctorContact, '9000000005');
  });
});

test('encryptStudentSensitiveFields clears contact lookup hashes for empty values', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptStudentSensitiveFields({
      phone: '',
      parentEmail: null,
      emergencyContact: '',
      doctorContact: null,
    });

    assert.equal(stored.phone, '');
    assert.equal(stored.phoneHash, null);
    assert.equal(stored.parentEmail, null);
    assert.equal(stored.parentEmailHash, null);
    assert.equal(stored.emergencyContact, '');
    assert.equal(stored.emergencyContactHash, null);
    assert.equal(stored.doctorContact, null);
    assert.equal(stored.doctorContactHash, null);
  });
});

test('encryptStudentSensitiveFields maintains docAadhaarHash for exact lookup', () => {
  withSensitiveEncryptionEnv(true, () => {
    const first = encryptStudentSensitiveFields({ docAadhaar: ' 1234-5678-9012 ' });
    const second = encryptStudentSensitiveFields({ docAadhaar: '1234-5678-9012' });
    const cleared = encryptStudentSensitiveFields({ docAadhaar: null });
    const unchanged = encryptStudentSensitiveFields({ city: 'Chennai' });

    assert.equal(isEncryptedSensitiveField(first.docAadhaar), true);
    assert.equal(first.docAadhaarHash, second.docAadhaarHash);
    assert.notEqual(first.docAadhaar, second.docAadhaar);
    assert.equal(cleared.docAadhaar, null);
    assert.equal(cleared.docAadhaarHash, null);
    assert.equal(Object.prototype.hasOwnProperty.call(unchanged, 'docAadhaarHash'), false);
  });
});

test('studentContactHashWhere builds exact contact lookup predicates without raw values', () => {
  withSensitiveEncryptionEnv(true, () => {
    const where = studentContactHashWhere('school-1', 'parentPhone', '9000000003');
    const serialized = JSON.stringify(where);

    assert.equal(where.schoolId, 'school-1');
    assert.equal(typeof where.parentPhoneHash, 'string');
    assert.match(String(where.parentPhoneHash), /^sfh1:/);
    assert.doesNotMatch(serialized, /9000000003|parentPhone":/);
  });
});

test('studentAnyContactHashWhere searches every searchable contact hash without raw values', () => {
  withSensitiveEncryptionEnv(true, () => {
    const where = studentAnyContactHashWhere('school-1', 'parent@example.com');
    const serialized = JSON.stringify(where);

    assert.equal(where.schoolId, 'school-1');
    assert.equal(Array.isArray(where.OR), true);
    assert.deepEqual(
      (where.OR as Array<Record<string, string>>).map((item) => Object.keys(item)[0]),
      ['emailHash', 'phoneHash', 'fatherPhoneHash', 'motherPhoneHash', 'parentPhoneHash', 'parentEmailHash'],
    );
    assert.match(String((where.OR as Array<Record<string, string>>)[0].emailHash), /^sfh1:/);
    assert.doesNotMatch(serialized, /parent@example\.com|email":|phone":|parentEmail":/);
  });
});

test('student contact hash helpers return no-match predicates for empty or unkeyed input', () => {
  const originalEnabled = env.SENSITIVE_FIELD_ENCRYPTION_ENABLED;
  const originalKey = env.SENSITIVE_FIELD_ENCRYPTION_KEY;

  try {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = false;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = undefined;

    assert.deepEqual(studentContactHashWhere('school-1', 'phone', '   '), {
      schoolId: 'school-1',
      phoneHash: '__no_match__',
    });
    assert.deepEqual(studentAnyContactHashWhere('school-1', '9000000000'), {
      schoolId: 'school-1',
      OR: [{ emailHash: '__no_match__' }],
    });
  } finally {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = originalEnabled;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = originalKey;
  }
});

test('isStudentSearchableContactHashField allows only searchable contact fields', () => {
  assert.equal(isStudentSearchableContactHashField('phone'), true);
  assert.equal(isStudentSearchableContactHashField('parentEmail'), true);
  assert.equal(isStudentSearchableContactHashField('emergencyContact'), false);
  assert.equal(isStudentSearchableContactHashField('docAadhaar'), false);
  assert.equal(isStudentSearchableContactHashField('schoolId'), false);
});

test('decryptStudentSensitiveFields is backward compatible with old plaintext rows', () => {
  withSensitiveEncryptionEnv(true, () => {
    const apiResponse = decryptStudentSensitiveFields({
      presentAddress: 'Plain old address',
      parentPhone: '9000000003',
      allergies: 'Peanuts',
      emergencyContact: '9000000004',
      doctorContact: '9000000005',
      docReportCard: null,
    });

    assert.equal(apiResponse.presentAddress, 'Plain old address');
    assert.equal(apiResponse.parentPhone, '9000000003');
    assert.equal(apiResponse.allergies, 'Peanuts');
    assert.equal(apiResponse.emergencyContact, '9000000004');
    assert.equal(apiResponse.doctorContact, '9000000005');
    assert.equal(apiResponse.docReportCard, null);
  });
});

test('student sensitive mapper does not double-encrypt fields', () => {
  withSensitiveEncryptionEnv(true, () => {
    const once = encryptStudentSensitiveFields({ city: 'Chennai', parentEmail: 'parent@example.com' });
    const twice = encryptStudentSensitiveFields(once);

    assert.equal(twice.city, once.city);
    assert.equal(twice.parentEmail, once.parentEmail);
    assert.equal(decryptStudentSensitiveFields(twice).city, 'Chennai');
    assert.equal(decryptStudentSensitiveFields(twice).parentEmail, 'parent@example.com');
  });
});

test('decryptStudentSensitiveFieldList decrypts arrays for list responses', () => {
  withSensitiveEncryptionEnv(true, () => {
    const rows = [
      encryptStudentSensitiveFields({ id: 'student-1', state: 'Tamil Nadu' }),
      { id: 'student-2', state: 'Plain state' },
    ];

    const response = decryptStudentSensitiveFieldList(rows);

    assert.equal(response[0].state, 'Tamil Nadu');
    assert.equal(response[1].state, 'Plain state');
  });
});
