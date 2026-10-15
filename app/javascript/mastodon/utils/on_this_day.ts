const DAY = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET = 8 * 60 * 60 * 1000;

export const getOnThisDayDate = (now = Date.now()) =>
  new Date(now + BEIJING_OFFSET).toISOString().slice(0, 10);

export const millisecondsUntilOnThisDayMidnight = (now = Date.now()) =>
  DAY - ((now + BEIJING_OFFSET) % DAY);
