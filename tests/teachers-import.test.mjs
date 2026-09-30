import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTeachers, planTeachers, applyTeachers } from '../scripts/lib/teachers-import.mjs';

const source = { schemaVersion: 1, teachers: [{ registration: '001234-5-01', fullName: 'Professor de Teste' }] };
const teachers = validateTeachers(source);
const existing = {
  id: 'test-id', email: teachers[0].email,
  app_metadata: { labmanager_login_type: 'matricula', matricula_login: '001234', matricula_full: '001234-5-01' },
};

test('validação bloqueia prefixos duplicados e números que perderiam zeros', () => {
  assert.equal(teachers[0].login, '001234');
  assert.throws(() => validateTeachers({ ...source, teachers: [...source.teachers, { registration: '001234-9-03', fullName: 'Outro' }] }), /duplicado/);
  assert.throws(() => validateTeachers({ ...source, teachers: [{ registration: 123456, fullName: 'Outro' }] }));
  assert.throws(() => validateTeachers({ ...source, teachers: [{ registration: '123456-1', fullName: '' }] }));
});

test('planejamento preserva conta importada e recusa colisão com outra identidade', async () => {
  const admin = { listUsers: async () => ({ data: { users: [existing] }, error: null }) };
  const plan = await planTeachers(admin, teachers);
  assert.equal(plan.create.length, 0);
  assert.equal(plan.skip.length, 1);
  await assert.rejects(planTeachers({ listUsers: async () => ({ data: { users: [{ ...existing, app_metadata: {} }] } }) }, teachers), /ocupado/);
  await assert.rejects(planTeachers({ listUsers: async () => ({ data: { users: [{ ...existing, app_metadata: { ...existing.app_metadata, matricula_full: '001234-9-99' } }] } }) }, teachers), /ocupado/);
});

test('planejamento pagina todos os usuários antes de decidir', async () => {
  const pages = [];
  const admin = { listUsers: async ({ page }) => {
    pages.push(page);
    return { data: { users: page === 1 ? Array.from({ length: 1000 }, (_, i) => ({ email: `other${i}@example.com` })) : [existing] } };
  } };
  assert.equal((await planTeachers(admin, teachers)).skip.length, 1);
  assert.deepEqual(pages, [1, 2]);
});

function fakeClient({ createError = null, role = 'user' } = {}) {
  const calls = [];
  return {
    calls,
    auth: { admin: { createUser: async (payload) => {
      calls.push(payload);
      return { data: { user: { id: 'new-id' } }, error: createError };
    } } },
    from: (table) => {
      assert.equal(table, 'user_profiles');
      return { select: () => ({ eq: () => ({ single: async () => ({ data: {
        id: 'new-id', role, full_name: teachers[0].fullName, email: teachers[0].email,
      } }) }) }) };
    },
  };
}

test('cria com senha pedida, metadata administrativo e perfil comum, sem enviar convite', async () => {
  const client = fakeClient();
  assert.deepEqual(await applyTeachers(client, { create: teachers, skip: [] }), { created: 1, skipped: 0 });
  const payload = client.calls[0];
  assert.equal(payload.password, '001234');
  assert.equal(payload.email_confirm, true);
  assert.equal(payload.app_metadata.matricula_full, '001234-5-01');
  assert.equal(payload.user_metadata.full_name, 'Professor de Teste');
  assert.equal(payload.app_metadata.role, undefined);
});

test('reexecução não redefine senha ou altera conta existente', async () => {
  const client = fakeClient();
  assert.deepEqual(await applyTeachers(client, { create: [], skip: [{ user: existing }] }), { created: 0, skipped: 1 });
  assert.equal(client.calls.length, 0);
});

test('erro interrompe o lote e não imprime a senha nem a resposta bruta', async () => {
  const client = fakeClient({ createError: { code: 'weak_password', message: 'sensitive raw response' } });
  await assert.rejects(applyTeachers(client, { create: [...teachers, ...teachers], skip: [] }), (error) => {
    assert.match(error.message, /weak_password/);
    assert.doesNotMatch(error.message, /001234|sensitive raw response/);
    return true;
  });
  assert.equal(client.calls.length, 1);
});

test('perfil inesperado interrompe a importação após a conta criada', async () => {
  await assert.rejects(applyTeachers(fakeClient({ role: 'admin' }), { create: teachers, skip: [] }), /perfil não corresponde/);
});
