const bcrypt = require('bcryptjs');
const { pool } = require('./database');

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Run this command directly in an interactive terminal.'));
      return;
    }

    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = '';
    const finish = (error) => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') return finish(new Error('Admin replacement cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0008' || character === '\u007f') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function removeNewAdmin(id) {
  await pool.query("DELETE FROM app_sessions WHERE sess::jsonb->'user'->>'id' = $1", [id]);
  await pool.query('DELETE FROM users WHERE id = $1 AND role = $2', [id, 'Administrator']);
}

async function main() {
  const username = 'admin';
  const duplicate = await pool.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username]);
  if (duplicate.rowCount) throw new Error('The username admin is already in use; no account was changed.');

  const oldAdmin = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'Administrator' AND disabled_at IS NULL", ['A1']);
  if (oldAdmin.rowCount !== 1) throw new Error('The original active administrator A1 was not found; no account was changed.');

  const password = await readHidden('New password for the replacement admin (at least 10 characters): ');
  const confirmation = await readHidden('Confirm the new admin password: ');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  let newId;
  try {
    await client.query('BEGIN');
    const existingAdmin = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'Administrator' AND disabled_at IS NULL FOR UPDATE", ['A1']);
    if (!existingAdmin.rowCount) throw new Error('The original administrator changed; no account was replaced.');

    do {
      const nextId = await client.query("SELECT 'A' || nextval('admins_id_seq')::text AS id");
      newId = nextId.rows[0].id;
    } while ((await client.query('SELECT 1 FROM users WHERE id = $1', [newId])).rowCount);

    await client.query(
      'INSERT INTO users (id, username, password_hash, role, name) VALUES ($1, $2, $3, $4, $5)',
      [newId, username, passwordHash, 'Administrator', 'Administrator']
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  let loginStatus = 0;
  try {
    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    loginStatus = response.status;
    const result = await response.json();
    if (!response.ok || result.user?.id !== newId || result.user?.role !== 'Administrator') {
      await removeNewAdmin(newId);
      throw new Error(`Replacement login verification failed with HTTP ${loginStatus}; the original admin was kept.`);
    }
  } catch (error) {
    if (error.message.startsWith('Replacement login verification failed')) throw error;
    await removeNewAdmin(newId);
    throw new Error('Could not verify the new admin against the running app; the original admin was kept.');
  }

  const removalClient = await pool.connect();
  try {
    await removalClient.query('BEGIN');
    const currentAdmin = await removalClient.query("SELECT id FROM users WHERE id = $1 AND role = 'Administrator' FOR UPDATE", ['A1']);
    if (!currentAdmin.rowCount) throw new Error('The original admin was not found during replacement; the new admin remains available.');
    await removalClient.query("DELETE FROM app_sessions WHERE sess::jsonb->'user'->>'id' IN ($1, $2)", ['A1', newId]);
    await removalClient.query('DELETE FROM notifications WHERE user_id = $1', ['A1']);
    const removed = await removalClient.query("DELETE FROM users WHERE id = $1 AND role = 'Administrator'", ['A1']);
    if (removed.rowCount !== 1) throw new Error('The original admin could not be removed; the new admin remains available.');
    await removalClient.query('COMMIT');
  } catch (error) {
    await removalClient.query('ROLLBACK');
    throw error;
  } finally {
    removalClient.release();
  }

  console.log(`Verified replacement admin account ${newId} (username: ${username}).`);
  console.log('Removed the original A1 account and its sessions. The password was not displayed.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
