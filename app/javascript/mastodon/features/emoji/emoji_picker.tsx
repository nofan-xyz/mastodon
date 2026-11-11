import { useEffect, useRef } from 'react';
import type {
  FC,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import type { EmojiProps, PickerProps } from 'emoji-mart';
import EmojiRaw from 'emoji-mart/dist-es/components/emoji/nimble-emoji';
import PickerRaw from 'emoji-mart/dist-es/components/picker/nimble-picker';

import { assetHost } from '@/mastodon/utils/config';

import { EMOJI_MODE_NATIVE } from './constants';
import EmojiData from './emoji_data.json';
import { useEmojiAppState } from './mode';
import { usePickerEmojis } from './picker';

const backgroundImageFnDefault = () => `${assetHost}/emoji/sheet_16_0.png`;

const useDesktopAnchorDrag = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<HTMLElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const clickResetTimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(clickResetTimerRef.current);
    },
    [],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || event.button !== 0) return;

    const target = event.target instanceof Element ? event.target : null;
    const anchors = target?.closest<HTMLElement>('.emoji-mart-anchors');
    if (!anchors || anchors.scrollWidth <= anchors.clientWidth) return;

    const captureTarget =
      target?.closest<HTMLElement>('.emoji-mart-anchor') ?? anchors;

    anchorsRef.current = anchors;
    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startScrollLeftRef.current = anchors.scrollLeft;
    captureTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const anchors = anchorsRef.current;
    if (!anchors || event.pointerId !== pointerIdRef.current) return;

    const deltaX = event.clientX - startXRef.current;
    if (!draggedRef.current && Math.abs(deltaX) < 4) return;

    if (!draggedRef.current) {
      draggedRef.current = true;
      anchors.classList.add('emoji-mart-anchors--dragging');
    }

    event.preventDefault();
    anchors.scrollLeft = startScrollLeftRef.current - deltaX;
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return;

    if (draggedRef.current) {
      suppressClickRef.current = true;
      window.clearTimeout(clickResetTimerRef.current);
      clickResetTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    anchorsRef.current?.classList.remove('emoji-mart-anchors--dragging');
    anchorsRef.current = null;
    pointerIdRef.current = null;
    draggedRef.current = false;
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (
      !suppressClickRef.current ||
      !(event.target instanceof Element) ||
      !event.target.closest('.emoji-mart-anchor')
    ) {
      return;
    }

    suppressClickRef.current = false;
    window.clearTimeout(clickResetTimerRef.current);
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    rootRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleClickCapture,
  };
};

export const Picker: FC<PickerProps> = ({
  set = 'twitter',
  sheetSize = 32,
  sheetColumns = 62,
  sheetRows = 62,
  backgroundImageFn = backgroundImageFnDefault,
  ...props
}) => {
  const {
    rootRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleClickCapture,
  } = useDesktopAnchorDrag();
  const { mode } = useEmojiAppState();
  const { categories, emojis } = usePickerEmojis();

  return (
    <div
      className='emoji-mart-picker-wrapper'
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onClickCapture={handleClickCapture}
    >
      <PickerRaw
        data={EmojiData}
        custom={emojis}
        include={categories}
        set={set}
        sheetSize={sheetSize}
        sheetColumns={sheetColumns}
        sheetRows={sheetRows}
        native={mode === EMOJI_MODE_NATIVE}
        backgroundImageFn={backgroundImageFn}
        {...props}
      />
    </div>
  );
};

export const Emoji: FC<EmojiProps> = ({
  set = 'twitter',
  sheetSize = 32,
  sheetColumns = 62,
  sheetRows = 62,
  backgroundImageFn = backgroundImageFnDefault,
  ...props
}) => {
  const { mode } = useEmojiAppState();
  return (
    <EmojiRaw
      backgroundImageFn={backgroundImageFn}
      data={EmojiData}
      native={mode === EMOJI_MODE_NATIVE}
      set={set}
      sheetColumns={sheetColumns}
      sheetRows={sheetRows}
      sheetSize={sheetSize}
      skin={1}
      tooltip={false}
      forceSize={false}
      {...{ useButton: true }}
      {...props}
    />
  );
};
