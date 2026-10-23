import type { ComponentPropsWithRef } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';

import classNames from 'classnames';

import { useBodyScrollLock } from '@/mastodon/hooks/useBodyScrollLock';
import { useMergedRefs } from '@/mastodon/hooks/useMergedRefs';
import { useOnClickOutside } from '@/mastodon/hooks/useOnClickOutside';
import { useScrollSensor } from '@/mastodon/hooks/useScrollSensor';

import classes from './styles.module.scss';

interface BottomSheetProps extends Omit<
  ComponentPropsWithRef<'dialog'>,
  'onClose'
> {
  onClose: (e: Event) => void;
  reference?: Element | null;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  children,
  className,
  onClose,
  reference = null,
  ...props
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();

    return () => {
      dialog.close();
    };
  }, []);

  const handleCancel = useCallback(
    (event: React.SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onClose(event.nativeEvent);
    },
    [onClose],
  );

  useOnClickOutside([contentRef, reference], (e) => {
    onClose(e);
  });

  const { sensor, isInViewport } = useScrollSensor({
    placement: 'bottom',
    tolerance: 10,
  });

  return (
    <dialog
      {...props}
      onCancel={handleCancel}
      className={classNames(
        classes.dialog,
        !isInViewport && classes.withGradient,
      )}
      ref={useMergedRefs(props.ref, dialogRef)}
    >
      <div ref={contentRef} className={classNames(className, classes.sheet)}>
        {children}
      </div>
      {sensor}
    </dialog>
  );
};
