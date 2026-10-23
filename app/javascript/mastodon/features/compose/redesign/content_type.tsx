import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { TextAaIcon } from '@phosphor-icons/react';

import { changeComposeContentType } from '@/mastodon/actions/compose';
import { Button } from '@/mastodon/components/button/redesign';
import {
  Menu,
  MenuItemRadio,
  MenuList,
  MenuTrigger,
} from '@/mastodon/components/menu';
import { showContentTypeChoice } from '@/mastodon/initial_state';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';

const messages = defineMessages({
  change: {
    id: 'compose.content-type.change',
    defaultMessage: 'Change advanced formatting options',
  },
  plain: { id: 'compose.content-type.plain', defaultMessage: 'Plain text' },
  markdown: { id: 'compose.content-type.markdown', defaultMessage: 'Markdown' },
  html: { id: 'compose.content-type.html', defaultMessage: 'HTML' },
});

const formats = [
  { value: 'text/plain', label: messages.plain },
  { value: 'text/markdown', label: messages.markdown },
  { value: 'text/html', label: messages.html },
] as const;

export const ComposeContentType: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const contentType = useAppSelector(
    (state) => state.compose.get('content_type') as string,
  );
  const onChange = useCallback(
    ({ value }: { value: string }) => {
      dispatch(changeComposeContentType(value));
    },
    [dispatch],
  );

  if (!showContentTypeChoice) return null;

  const selected =
    formats.find((format) => format.value === contentType) ?? formats[0];

  return (
    <Menu>
      <MenuTrigger
        as={Button}
        size='sm'
        leadingIcon={TextAaIcon}
        aria-label={intl.formatMessage(messages.change)}
      >
        {intl.formatMessage(selected.label)}
      </MenuTrigger>
      <MenuList placement='bottom-end' strategy='fixed'>
        {formats.map((format) => (
          <MenuItemRadio
            key={format.value}
            name='content_type'
            value={format.value}
            checked={contentType === format.value}
            onChange={onChange}
          >
            {intl.formatMessage(format.label)}
          </MenuItemRadio>
        ))}
      </MenuList>
    </Menu>
  );
};
