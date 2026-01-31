export const isValidTime = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

export const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
};

export const isWithinWindow = (now: Date, startTime: string, endTime: string) => {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return minutes >= start && minutes <= end;
};

export const computeStatus = (
  capturedAt: Date,
  startTime: string,
  lateThresholdMinutes: number,
) => {
  const startMinutes = toMinutes(startTime);
  const captureMinutes = capturedAt.getHours() * 60 + capturedAt.getMinutes();
  if (captureMinutes <= startMinutes + lateThresholdMinutes) {
    return 'PRESENT' as const;
  }
  return 'LATE' as const;
};
