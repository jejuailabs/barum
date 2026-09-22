import {readFile} from 'node:fs/promises';
import {afterAll, beforeAll, expect, it} from 'vitest';
import {assertFails, initializeTestEnvironment, type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';
import {ref, uploadBytes} from 'firebase/storage';
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({projectId: 'demo-barum',
    firestore: {host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8')},
    storage: {host: '127.0.0.1', port: 9199, rules: await readFile('storage.rules', 'utf8')}
  });
});
afterAll(async () => { await env?.cleanup(); });
it.each(['anonymous', 'owner', 'other'])('denies unimplemented database access for %s', async actor => {
  const context = actor === 'anonymous' ? env.unauthenticatedContext() : env.authenticatedContext(actor);
  await assertFails(setDoc(doc(context.firestore(), 'users/owner'), {name: 'test'}));
  await assertFails(getDoc(doc(context.firestore(), 'users/owner')));
  await assertFails(getDoc(doc(context.firestore(), 'tideCache/sample')));
});
it('denies uploads before upload contracts are implemented', async () => {
  await assertFails(uploadBytes(ref(env.authenticatedContext('owner').storage(), 'users/owner/file.txt'), new Uint8Array([1])));
  expect(env.projectId).toBe('demo-barum');
});
