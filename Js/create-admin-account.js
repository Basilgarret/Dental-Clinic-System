const bcrypt = require('bcryptjs');
const readline = require('readline/promises');
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
        if (character === '\u0003') return finish(new Error('Admin account creation cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0008' || character === '\u007f') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  let name;
  let username;
  try {
    name = (await prompt.question('Administrator display name: ')).trim();
    username = (await prompt.question('Administrator username: ')).trim();
  } finally {
    prompt.close();
  }
  if (!name || !username) throw new Error('Name and username are required.');

  const password = await readHidden('New admin password (at least 10 characters): ');
  const confirmation = await readHidden('Confirm new admin password: ');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');

    const activeAdmins = await client.query(
      "SELECT 1 FROM users WHERE role = 'Administrator' AND disabled_at IS NULL LIMIT 1"
    );
    if (activeAdmins.rowCount) throw new Error('An active administrator already exists; no account was created.');

    const existingUsername = await client.query(
      'SELECT 1 FROM users WHERE lower(username) = lower($1)',
      [username]
    );
    if (existingUsername.rowCount) throw new Error('That username is already in use; no account was created.');

    let id;
    do {
      const sequence = await client.query("SELECT 'A' || nextval('admins_id_seq')::text AS id");
      id = sequence.rows[0].id;
    } while ((await client.query('SELECT 1 FROM users WHERE id = $1', [id])).rowCount);

    await client.query(
      'INSERT INTO users (id, username, password_hash, role, name) VALUES ($1, $2, $3, $4, $5)',
      [id, username, passwordHash, 'Administrator', name]
    );
    await client.query('COMMIT');
    console.log(`Administrator account created (username: ${username}).`);
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