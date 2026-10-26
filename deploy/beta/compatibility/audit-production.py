import json,subprocess,hashlib
obj=json.loads(subprocess.check_output(['docker','inspect','mastodon-web-1']))[0]
env=dict(x.split('=',1) for x in obj['Config']['Env'] if '=' in x)
root=obj['Config']['WorkingDir']
def sql(query):
 text='BEGIN READ ONLY;\n'+query+'\nROLLBACK;'
 raw=subprocess.check_output(['docker','exec','-i','mastodon-db-1','psql','-q','-U','postgres','-d','mastodon_production','-At'],input=text.encode()).decode().strip()
 return json.loads(raw)
result={'source_commit':env.get('SOURCE_COMMIT'),'working_dir':root}
result['database']=sql("""SELECT json_build_object(
 'keypairs_table',to_regclass('public.keypairs') IS NOT NULL,
 'legacy_private_key_column',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='private_key'),
 'local_keypairs_migration_applied',EXISTS(SELECT 1 FROM schema_migrations WHERE version='20260702144128'),
 'flavour_skin_migration_applied',EXISTS(SELECT 1 FROM schema_migrations WHERE version='20260827000000'),
 'fasp_capabilities_table',to_regclass('public.fasp_capabilities') IS NOT NULL,
 'account_reach_filters_table',to_regclass('public.account_reach_filters') IS NOT NULL,
 'legacy_local_private_keys',(SELECT count(*) FROM accounts WHERE domain IS NULL AND private_key IS NOT NULL),
 'functional_local_accounts_without_keypair',(SELECT count(*) FROM accounts a WHERE a.domain IS NULL AND a.suspended_at IS NULL AND a.requested_deletion_at IS NULL AND NOT EXISTS (SELECT 1 FROM keypairs k WHERE k.account_id=a.id AND k.revoked=false AND k.private_key IS NOT NULL)),
 'local_keypairs',(SELECT count(*) FROM keypairs k JOIN accounts a ON a.id=k.account_id WHERE a.domain IS NULL),
 'fasp_providers',(SELECT count(*) FROM fasp_providers)
);""")
result['source_files']={}
for rel in ['app/models/account.rb','app/models/keypair.rb','app/models/setting.rb','app/models/user_settings.rb','app/lib/user_settings_serializer.rb','db/post_migrate/20260702144128_migrate_local_account_keypairs.rb']:
 data=subprocess.check_output(['docker','exec','mastodon-web-1','cat',root+'/'+rel])
 result['source_files'][rel]=hashlib.sha256(data).hexdigest()
print(json.dumps(result,indent=2))
