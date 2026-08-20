import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../../../config/env';
import { isEncryptedSensitiveField, isSensitiveLookupHash } from '../../../utils/sensitiveFieldCrypto';
import {
  decryptStaffRecord,
  decryptStaffSensitiveFields,
  decryptTeacherBankDetails,
  encryptStaffSensitiveFields,
  encryptTeacherBankDetailsForStorage,
  staffContactHashWhere,
} from './staff-sensitive-fields';

const TEST_KEY = 'staff_sensitive_field_key_32_chars_minimum';

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

test('encryptStaffSensitiveFields leaves values plaintext when flag is disabled', () => {
  withSensitiveEncryptionEnv(false, () => {
    const stored = encryptStaffSensitiveFields({
      phone: '9000000000',
      address: '12 Staff Road',
      emergencyMobile: '9000000001',
      currentAddress: 'Current address',
      permanentAddress: 'Permanent address',
    });

    assert.equal(stored.phone, '9000000000');
    assert.equal(isSensitiveLookupHash(stored.phoneHash), true);
    assert.equal(stored.address, '12 Staff Road');
    assert.equal(stored.emergencyMobile, '9000000001');
    assert.equal(stored.currentAddress, 'Current address');
    assert.equal(stored.permanentAddress, 'Permanent address');
  });
});

test('encryptStaffSensitiveFields encrypts profile fields and adds lookup hashes', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptStaffSensitiveFields({
      employeeNo: 'EMP-1',
      phone: '9000000000',
      address: '12 Staff Road',
      emergencyMobile: '9000000001',
      drivingLicense: 'DL-123',
      currentAddress: 'Current address',
      permanentAddress: 'Permanent address',
    });

    assert.equal(stored.employeeNo, 'EMP-1');
    assert.equal(isEncryptedSensitiveField(stored.phone), true);
    assert.equal(isSensitiveLookupHash(stored.phoneHash), true);
    assert.equal(isEncryptedSensitiveField(stored.address), true);
    assert.equal(isEncryptedSensitiveField(stored.emergencyMobile), true);
    assert.equal(isSensitiveLookupHash(stored.emergencyMobileHash), true);
    assert.equal(isEncryptedSensitiveField(stored.drivingLicense), true);
    assert.equal(isEncryptedSensitiveField(stored.currentAddress), true);
    assert.equal(isEncryptedSensitiveField(stored.permanentAddress), true);

    const apiResponse = decryptStaffSensitiveFields(stored);
    assert.equal(apiResponse.phone, '9000000000');
    assert.equal(apiResponse.address, '12 Staff Road');
    assert.equal(apiResponse.emergencyMobile, '9000000001');
    assert.equal(apiResponse.drivingLicense, 'DL-123');
    assert.equal(apiResponse.currentAddress, 'Current address');
    assert.equal(apiResponse.permanentAddress, 'Permanent address');
  });
});

test('staff encryption does not double encrypt and remains backward compatible with plaintext', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptStaffSensitiveFields({ phone: '9000000000', address: '12 Staff Road' });
    const storedAgain = encryptStaffSensitiveFields(stored);

    assert.equal(storedAgain.phone, stored.phone);
    assert.equal(storedAgain.address, stored.address);

    const legacy = decryptStaffSensitiveFields({ phone: '9000000000', address: '12 Staff Road' });
    assert.equal(legacy.phone, '9000000000');
    assert.equal(legacy.address, '12 Staff Road');
  });
});

test('teacher bank details encrypt selected high-risk fields', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptTeacherBankDetailsForStorage({
      accountHolderName: 'Staff User',
      accountNumber: '1234567890',
      ifscCode: 'IFSC0001234',
      accountType: 'Savings',
      bankName: 'Bank',
      branchName: 'Main',
      panNumber: 'ABCDE1234F',
    });

    assert.equal(stored.accountHolderName, 'Staff User');
    assert.equal(stored.accountType, 'Savings');
    assert.equal(stored.bankName, 'Bank');
    assert.equal(stored.branchName, 'Main');
    assert.equal(isEncryptedSensitiveField(stored.accountNumber), true);
    assert.equal(isEncryptedSensitiveField(stored.ifscCode), true);
    assert.equal(isEncryptedSensitiveField(stored.panNumber), true);

    const apiResponse = decryptTeacherBankDetails(stored);
    assert.equal(apiResponse.accountNumber, '1234567890');
    assert.equal(apiResponse.ifscCode, 'IFSC0001234');
    assert.equal(apiResponse.panNumber, 'ABCDE1234F');
  });
});

test('decryptStaffRecord decrypts profile and bank details together', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = {
      ...encryptStaffSensitiveFields({ phone: '9000000000', address: '12 Staff Road' }),
      bankDetails: encryptTeacherBankDetailsForStorage({ accountNumber: '1234567890' }),
    };

    const apiResponse = decryptStaffRecord(stored);
    assert.equal(apiResponse.phone, '9000000000');
    assert.equal(apiResponse.address, '12 Staff Road');
    assert.equal(apiResponse.bankDetails?.accountNumber, '1234567890');
  });
});

test('staffContactHashWhere builds exact lookup predicates without raw values', () => {
  withSensitiveEncryptionEnv(true, () => {
    const predicates = staffContactHashWhere('9000000000');

    assert.equal(predicates.length, 2);
    assert.equal(isSensitiveLookupHash(predicates[0]?.phoneHash), true);
    assert.equal(isSensitiveLookupHash(predicates[1]?.emergencyMobileHash), true);
    assert.equal(JSON.stringify(predicates).includes('9000000000'), false);
  });
});
