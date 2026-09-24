# Hourly precipitation probability update

The CHANCE OF RAIN card displays Open-Meteo precipitation_probability in percent. This includes rain, showers and snow, not only liquid rain. The provider defines it as the probability of more than 0.1 mm during the hour ending at the selected timestamp. The UI labels the interval in Bangladesh time. Timeline playback updates this card alongside the other variables.

Source: https://open-meteo.com/en/docs (checked 2026-09-24). The provider documents ensemble-based probability at approximately 0.25 degree / 27 km resolution. It is a model estimate for a grid location, not an observation, a street-scale measurement or flood probability. It does not represent the percentage of the day that will be wet. Hourly probabilities are not summed or treated as a daily event probability.

The rainfall accumulation and experimental indicator still use forecast precipitation amount in mm. Neither is used to manufacture a probability.

Missing/null/invalid values display a dash; zero remains 0%. Units must be percent and provided arrays must align with the hourly timestamps. CSV exports a separate precipitation_probability_preceding_hour_percent column. Cache namespace v2 avoids using old responses without this field.

## Install on the existing GitHub project

Extract GeoForecast-Rain-Probability-Update.zip. Upload its src, tests and docs folders together to the repository root by dragging the whole folders into GitHub Upload files. Verify src/App.tsx and src/data.ts appear in the upload list. Commit to main. Wait for Test and deploy GeoForecast to complete, then refresh the website.

The updated header includes Created by Kazi Md. Jabed Hossain.

## Verification of this update

27 unit tests passed, including seven probability checks. TypeScript and Vite production build passed. A real Satkhira API request returned HTTP 200 with 192 hourly probability entries and percent units. Browser tests were attempted but could not launch because Chromium was absent; its download returned an invalid archive. New browser/mobile rendering is therefore not verified in this update. The browser test source was updated for the probability card and v2 cache. No deployment of this update has been performed.
