export function formatTaskCount(count: number): string {
  const absolute = Math.abs(count);
  const lastTwoDigits = absolute % 100;
  const lastDigit = absolute % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} заданий`;
  }

  if (lastDigit === 1) {
    return `${count} задание`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} задания`;
  }

  return `${count} заданий`;
}

