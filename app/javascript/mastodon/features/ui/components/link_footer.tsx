import { Link } from 'react-router-dom';

import { useHolidayEmoji } from 'mastodon/hooks/useHolidayEmoji';
import {
  domain,
  version,
  statusPageUrl,
  profile_directory as canProfileDirectory,
  termsOfServiceEnabled,
} from 'mastodon/initial_state';

import classes from './link_footer.module.scss';

const DONATE_URL = 'https://donate.nofan.xyz/';
const ROADMAP_URL = 'https://roadmap.nofan.xyz/';

export const LinkFooter: React.FC<{
  context?: 'default' | 'multi-column' | 'about';
}> = ({ context = 'default' }) => {
  const multiColumn = context === 'multi-column';
  const holidayEmoji = useHolidayEmoji();
  const fullVersion = version ?? '未知版本';
  const shortVersion = fullVersion
    .replace(/\+.*/, '')
    .replace(/^(\d+\.\d+\.\d+)\.0(?=-|$)/, '$1');
  const sourceCommit = /\b[0-9a-f]{40}\b/i.exec(fullVersion)?.[0];
  const sourceUrl = sourceCommit
    ? `https://github.com/nofan-xyz/mastodon/commit/${sourceCommit}`
    : 'https://github.com/nofan-xyz/mastodon';

  return (
    <footer className={classes.wrapper} data-context={context}>
      <ul className={classes.list}>
        <li>
          <a href='/overview' target={multiColumn ? '_blank' : undefined}>
            关于本站
            <span className='sr-only'> {domain}</span>
          </a>
        </li>
        <li>
          <a href={DONATE_URL} target='_blank' rel='noopener'>
            支持本站
          </a>
        </li>
        <li>
          <a href={ROADMAP_URL} target='_blank' rel='noopener'>
            开发路线图
          </a>
        </li>
        {statusPageUrl && (
          <li>
            <a href={statusPageUrl} target='_blank' rel='noopener'>
              服务状态
            </a>
          </li>
        )}
        {canProfileDirectory && (
          <li>
            <Link to='/directory'>用户目录</Link>
          </li>
        )}
        {termsOfServiceEnabled && (
          <li>
            <Link
              to='/terms-of-service'
              target={multiColumn ? '_blank' : undefined}
              rel='terms-of-service'
            >
              服务条款
            </Link>
          </li>
        )}
      </ul>
      <div className={classes.versionRow}>
        <a
          className={classes.version}
          href={sourceUrl}
          target='_blank'
          rel='noopener'
          title={`完整版本：${fullVersion}`}
          aria-label={`nofan · Mastodon ${shortVersion}，完整版本 ${fullVersion}，查看源码`}
        >
          nofan · Mastodon {shortVersion}
        </a>
        {holidayEmoji && (
          <span className={classes.holiday} aria-hidden='true'>
            {holidayEmoji}
          </span>
        )}
      </div>
    </footer>
  );
};
