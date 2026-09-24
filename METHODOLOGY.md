# Methodology

## Scope

The application explores numerical weather forecasts at selected coordinates. It does not provide observations, inundation mapping, flood depth, river-level forecasts, emergency advice, or flood probabilities. Basemap water features are cartographic context, not live flood extent.

## Forecast and temporal support

Open-Meteo's default Best Match endpoint selects model information for the requested location. Returned coordinates identify the selected model grid location and may differ from the clicked point. Effective resolution and model availability vary; a point does not represent a continuous surface. Model issue time is not supplied by the selected endpoint and is displayed as unavailable. `generationtime_ms` is processing duration, not forecast issuance.

The app asks for eight calendar days, in Asia/Dhaka, with UNIX timestamps. The visible seven-day outlook starts at the next whole hour (or the current hour if exactly on its boundary) and ends 168 hours later, subject to provider coverage. This avoids presenting midnight-to-midnight data as seven complete days from now. There are up to 169 hourly boundary timestamps.

Temperature, humidity and wind are valid at the labelled timestamp. Precipitation is the provider's preceding-hour sum (rain, showers and snow-water equivalent), not an instantaneous rain rate. The first displayed precipitation interval can partly overlap the time before retrieval; accumulated FUTURE windows exclude the selected boundary's preceding-hour value.

For window start T and N in {24,48,72}:

`P_N(T) = sum(p(T + i * 1 hour), i = 1 ... N)`

Every required timestamp must occur once, in order, at hourly spacing and have a finite nonnegative value. Otherwise the accumulation is unavailable. Missing values, duplicate times, gaps, and a truncated forecast are not interpreted as dry weather. Values are rounded only after summation. There is no interpolation of missing values.

UNIX timestamps are handled as UTC instants; display uses the explicit IANA zone `Asia/Dhaka`, independent of the viewer's device timezone. CSV includes an ISO UTC column for unambiguous reuse.

## Experimental rainfall-pressure indicator

| Future 24-hour total  | Label              |
| --------------------- | ------------------ |
| 0 ≤ P < 25 mm         | Lower rainfall     |
| 25 ≤ P < 50 mm        | Elevated rainfall  |
| 50 ≤ P < 100 mm       | High rainfall      |
| P ≥ 100 mm            | Very high rainfall |
| Incomplete or invalid | Unavailable        |

The bands are author-selected round thresholds to demonstrate a reproducible classification pipeline. Their justification is readability and monotonicity, **not empirical calibration**. They are not official warning thresholds and must not be attributed to BMD or another agency. The indicator has not been validated against observed flooding. No accuracy, skill score or uncertainty interval is claimed.

Rainfall pressure is only a screening input potentially relevant to flood hazard. It is not a calibrated susceptibility index or a forecast of flooding. Low local rainfall does not rule out upstream river flooding, tidal inundation, drainage failures or storm surge. No elevation, slope, discharge, antecedent soil moisture, drainage, tides, defences, exposure or vulnerability enters the calculation.

Hazard is a potentially damaging process. Exposure describes people/assets that may encounter it. Vulnerability describes susceptibility to damage. Risk combines these with likelihood and consequences. This application does not implement that full combination.

## Spatial inputs

Preset locations are approximate town-centre navigation anchors, not gauges or administrative boundaries. Bangladesh extent is a navigation viewport rather than a jurisdiction mask; arbitrary coordinate and map selections remain possible outside Bangladesh, while place-name search is restricted to Bangladesh.

GeoJSON must use WGS84 coordinates in longitude, latitude order. The parser validates recognized geometry types, nesting, coordinate ranges, finite numbers, basic structure and closed rings, plus Turf basic validity checks. It is not a comprehensive test of polygon self-intersections or inter-feature topology. Uploaded polygon area is Turf's spherical area in square kilometres; overlaps are summed separately. Uploaded geometry does not change weather or risk calculations. No uploaded attributes are evaluated as HTML.

## Future scientific development

A defensible flood model would require catchment-scale forcing, river and terrain data, hydrological/hydraulic modelling, local observations, independent validation and uncertainty analysis. Those are future research tasks, not present capabilities.
