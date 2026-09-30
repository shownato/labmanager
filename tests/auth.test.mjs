import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as matricula from '../src/lib/auth/matricula.mjs';

function authorization(emails = '', domains = '') {
  const previous = [process.env.AUTHORIZED_EMAILS, process.env.AUTHORIZED_EMAIL_DOMAINS];
  process.env.AUTHORIZED_EMAILS = emails;
  process.env.AUTHORIZED_EMAIL_DOMAINS = domains;
  try {
    const source = readFileSync(new URL('../src/lib/auth/authorization.ts', import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
    const exports = {};
    new Function('require', 'exports', outputText)((name) => {
      assert.equal(name, './matricula.mjs');
      return matricula;
    }, exports);
    return exports;
  } finally {
    for (const [i, name] of ['AUTHORIZED_EMAILS', 'AUTHORIZED_EMAIL_DOMAINS'].entries()) {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    }
  }
}

const teacher = {
  email: matricula.matriculaEmail('001234'),
  app_metadata: { labmanager_login_type: 'matricula', matricula_login: '001234' },
};

test('login preserva zeros e rejeita matrícula completa, curta ou caracteres extras', () => {
  assert.equal(matricula.matriculaEmail('001234'), '001234@matricula.labmanager.invalid');
  for (const value of ['12345', '1234567', '123456-7-01', 'abcdef', ' 123456', '１２３４５６']) {
    assert.throws(() => matricula.matriculaEmail(value));
  }
});

test('professor importado passa independentemente da lista de emails de funcionários', () => {
  const auth = authorization('admin@example.com', 'cci.example.com');
  assert.equal(auth.isUserAuthorized(teacher), true);
  assert.equal(auth.isEmailAuthorized(teacher.email), false);
});

test('alias sozinho ou user_metadata forjado nunca autoriza o acesso', () => {
  for (const auth of [authorization(), authorization('', 'matricula.labmanager.invalid')]) {
    assert.equal(auth.isUserAuthorized({ email: teacher.email, app_metadata: {} }), false);
    assert.equal(auth.isUserAuthorized({ email: teacher.email, user_metadata: teacher.app_metadata, app_metadata: {} }), false);
    assert.equal(auth.isUserAuthorized({ ...teacher, email: matricula.matriculaEmail('654321') }), false);
  }
});

test('regras existentes da equipe CCI continuam funcionando', () => {
  const auth = authorization(' ADMIN@EXAMPLE.COM ', '@cci.example.com');
  assert.equal(auth.isUserAuthorized({ email: 'admin@example.com', app_metadata: {} }), true);
  assert.equal(auth.isUserAuthorized({ email: 'staff@cci.example.com', app_metadata: {} }), true);
  assert.equal(auth.isUserAuthorized({ email: 'other@example.com', app_metadata: {} }), false);
  assert.equal(auth.isUserAuthorized(null), false);
  assert.equal(authorization().isUserAuthorized({ email: 'legacy@example.com', app_metadata: {} }), true);
});
