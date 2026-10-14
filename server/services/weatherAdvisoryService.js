/** Deterministic planning notes based only on provider forecast fields. */
export function buildWeatherAdvisories(weather) {
  const days = Array.isArray(weather?.daily) ? weather.daily : [];
  if (!days.length) return [];

  const rainDays = days.filter((day) => (day.precipitationMm !== null && day.precipitationMm > 0) || (day.precipitationProbabilityPercent !== null && day.precipitationProbabilityPercent > 0));
  if (rainDays.length) {
    const dates = rainDays.slice(0, 3).map((day) => {
      const details = [];
      if (day.precipitationProbabilityPercent !== null) details.push(`${day.precipitationProbabilityPercent}% forecast probability`);
      if (day.precipitationMm !== null) details.push(`${day.precipitationMm} mm forecast total`);
      return `${formatDate(day.date)}${details.length ? ` (${details.join(', ')})` : ''}`;
    });
    return [{
      id: 'rain-and-field-operations',
      title: 'Rain appears in the forecast',
      type: 'planning-note',
      basis: `Forecast precipitation is indicated for ${dates.join('; ')}.`,
      message: 'Check the latest local forecast, field drainage, and soil trafficability before planning sowing or harvest work. Forecast rain alone does not establish waterlogging, soil moisture, or irrigation need.',
      officialWarning: false,
    }];
  }

  const firstThreeDays = days.slice(0, 3);
  if (firstThreeDays.length === 3 && firstThreeDays.every((day) => day.precipitationMm === 0 && day.precipitationProbabilityPercent === 0)) {
    return [{
      id: 'irrigation-field-check',
      title: 'Check field conditions before irrigation',
      type: 'planning-note',
      basis: 'The selected three-day forecast currently reports zero daily precipitation and zero maximum precipitation probability.',
      message: 'Check crop stage and soil moisture in the field before deciding about irrigation. A weather forecast alone cannot establish whether a crop needs water.',
      officialWarning: false,
    }];
  }
  return [];
}

function formatDate(value) {
  if (typeof value !== 'string') return 'a forecast day';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
