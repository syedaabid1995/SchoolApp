import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '../student-management.core';
import * as facade from '../student-management.service';

const studentRouteHandlers = [
  'acceptTransferRequest',
  'addStudentDocument',
  'addStudentPhoto',
  'addStudentTimeline',
  'changeStudentStatus',
  'createStudent',
  'createTransferRequest',
  'deleteStudent',
  'deleteStudentDocument',
  'deleteStudentPhoto',
  'deleteStudentTimeline',
  'downloadStudentImportSample',
  'getStudent',
  'importStudents',
  'linkParent',
  'listIncomingTransferRequests',
  'listStudents',
  'listTransferTargets',
  'rejectTransferRequest',
  'unlinkParent',
  'updateStudent',
  'uploadStudentImportMiddleware',
] as const;

test('student management facade preserves the existing route handler export surface', () => {
  for (const handlerName of studentRouteHandlers) {
    assert.equal(typeof facade[handlerName], 'function', `${handlerName} should be exported by the student facade`);
    assert.equal(facade[handlerName], core[handlerName], `${handlerName} should delegate to the existing implementation`);
  }
});
