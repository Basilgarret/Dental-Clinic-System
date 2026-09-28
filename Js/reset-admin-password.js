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
        if (character === '\u0003') return finish(new Error('Password reset cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0008' || character === '\u007f') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const password = await readHidden('New admin password (at least 10 characters): ');
  const confirmation = await readHidden('Confirm new admin password: ');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  const hash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2 AND role = 'Administrator' AND disabled_at IS NULL RETURNING id",
      [hash, 'A1']
    );
    if (updated.rowCount !== 1) throw new Error('The active original administrator account A1 was not found.');
    const sessions = await client.query(
      "DELETE FROM app_sessions WHERE sess::jsonb->'user'->>'id' = $1",
      ['A1']
    );
    await client.query('COMMIT');
    console.log(`Admin password updated for ${updated.rows[0].id}; revoked ${sessions.rowCount} existing session(s).`);
    console.log('Sign in with username: Basil Sunog');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
