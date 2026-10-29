\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'mastodon_beta' THEN RAISE EXCEPTION 'Wrong database'; END IF; END $$;
BEGIN;
CREATE TEMP TABLE snapshot_preserved_counts AS SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM statuses) statuses, (SELECT count(*) FROM media_attachments) media;
DELETE FROM session_activations;
DELETE FROM web_push_subscriptions;
DELETE FROM oauth_access_grants;
DELETE FROM oauth_access_tokens;
-- DELETE respects ON DELETE SET NULL; TRUNCATE CASCADE would also erase attachments.
DELETE FROM scheduled_statuses;
DELETE FROM webhooks;
UPDATE invites SET expires_at=NOW();
UPDATE oauth_applications SET secret=replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''), uid=replace(gen_random_uuid()::text,'-','');
DO $$ DECLARE col text; BEGIN
 FOREACH col IN ARRAY ARRAY['reset_password_token','confirmation_token','unlock_token','sign_in_token'] LOOP
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name=col) THEN
   EXECUTE format('UPDATE users SET %I = NULL',col);
  END IF;
 END LOOP;
END $$;
DO $$ DECLARE before_row record; BEGIN
 SELECT * INTO before_row FROM snapshot_preserved_counts;
 IF before_row.users <> (SELECT count(*) FROM users) OR before_row.statuses <> (SELECT count(*) FROM statuses) OR before_row.media <> (SELECT count(*) FROM media_attachments) THEN
  RAISE EXCEPTION 'Snapshot cleanup changed protected data counts';
 END IF;
END $$;
COMMIT;
