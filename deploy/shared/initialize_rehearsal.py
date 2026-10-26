from pathlib import Path
import json
import os
import subprocess

os.umask(0o077)
root = Path('/home/mastodon-shared-rehearsal')
assert (root / 'results/restore.done').exists() and (root / 'results/images.json').exists()
assert not (root / 'results/initialized.done').exists(), 'Do not reinitialize an active rehearsal'
os.chdir(root)

def sql(query, output=False):
    command = ['docker', 'compose', 'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1', '-qAt', '-U', 'mastodon', '-d', 'mastodon_shared_rehearsal']
    if output:
        return subprocess.check_output(command, input=query.encode()).decode().strip()
    subprocess.run(command, input=query.encode(), check=True)

invariants = """SELECT json_build_object(
 'passwords', (SELECT md5(string_agg(id::text || ':' || encrypted_password, '|' ORDER BY id)) FROM users),
 'local_keys', (SELECT md5(string_agg(k.id::text || ':' || COALESCE(k.private_key,''), '|' ORDER BY k.id)) FROM keypairs k JOIN accounts a ON a.id=k.account_id WHERE a.domain IS NULL),
 'legacy_keys', (SELECT md5(string_agg(id::text || ':' || private_key, '|' ORDER BY id)) FROM accounts WHERE private_key IS NOT NULL),
 'users', (SELECT count(*) FROM users));"""
before = json.loads(sql(invariants, output=True))
sql("""DO $$ BEGIN IF current_database()<>'mastodon_shared_rehearsal' THEN RAISE EXCEPTION 'Wrong database'; END IF; END $$;
BEGIN;
DELETE FROM session_activations;
DELETE FROM web_push_subscriptions;
DELETE FROM oauth_access_grants;
DELETE FROM oauth_access_tokens;
DELETE FROM scheduled_statuses;
DELETE FROM webhooks;
UPDATE invites SET expires_at=NOW();
UPDATE oauth_applications SET secret=replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''), uid=replace(gen_random_uuid()::text,'-','');
COMMIT;""")
subprocess.run(['docker', 'compose', 'run', '--rm', '-T', 'web50', 'bundle', 'exec', 'rails', 'db:migrate'], check=True)
after = json.loads(sql(invariants, output=True))
assert before == after, 'Migration changed passwords, signing keys or account counts'
columns = json.loads(sql("""SELECT json_build_object(
 'legacy_private_key',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='private_key'),
 'legacy_fasp_capabilities',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='fasp_providers' AND column_name='capabilities'),
 'new_fasp_capabilities',to_regclass('public.fasp_capabilities') IS NOT NULL,
 'new_account_reach_filters',to_regclass('public.account_reach_filters') IS NOT NULL);""", output=True))
assert all(columns.values()), 'Coexistence schema did not preserve rollback columns'
(root / 'results/migration-invariants.json').write_text(json.dumps({'before': before, 'after': after, 'columns': columns}, indent=2))
(root / 'results/initialized.done').write_text('Coexistence migrations and identity invariants verified\n')
subprocess.run(['docker', 'compose', 'up', '-d', 'web47', 'web50', 'worker50', 'streaming'], check=True)
print('Isolated dual-Web rehearsal started; original passwords and signing keys preserved', flush=True)
