const NORMALIZED_IRISH_MOBILE = /^353(\d{2})(\d{3})(\d{4})$/;
const NORMALIZED_INTERNATIONAL_PHONE = /^[1-9]\d{6,14}$/;

export function formatPhoneForDisplay(value: string): string {
  const match = NORMALIZED_IRISH_MOBILE.exec(value);

  if (match) {
    return `+353 ${match[1]} ${match[2]} ${match[3]}`;
  }

  if (NORMALIZED_INTERNATIONAL_PHONE.test(value)) {
    return `+${value}`;
  }

  return value;
}
