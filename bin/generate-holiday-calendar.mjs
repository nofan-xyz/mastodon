#!/usr/bin/env node
// Offline build helper. No calendar library is shipped to website visitors.
import { writeFileSync } from 'node:fs';

// eslint-disable-next-line import/no-extraneous-dependencies -- Used only by this offline development helper.
import { Lunar, Solar } from 'lunar-typescript';

const calendar = {};
const lunarDates = [
  [1, 1],
  [1, 15],
  [5, 5],
  [7, 7],
  [8, 15],
];

for (let year = 2000; year <= 2100; year++) {
  const dates = lunarDates.map(([month, day]) =>
    Lunar.fromYmd(year, month, day).getSolar(),
  );
  dates.push(Solar.fromYmd(year, 12, 1).getLunar().getJieQiTable().DONG_ZHI);
  calendar[year] = dates.map((date) => date.getMonth() * 100 + date.getDay());
}

writeFileSync(
  new URL(
    '../app/javascript/mastodon/utils/holiday_calendar.json',
    import.meta.url,
  ),
  `{\n${Object.entries(calendar)
    .map(([year, dates]) => `  "${year}": [${dates.join(', ')}]`)
    .join(',\n')}\n}\n`,
);
