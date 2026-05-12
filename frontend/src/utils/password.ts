export interface PasswordChecks {
  length: boolean;
  letter: boolean;
  digit: boolean;
}

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= 10,
    letter: /[A-Za-zА-Яа-яЁё]/.test(password),
    digit: /\d/.test(password),
  };
}

export function isPasswordValid(checks: PasswordChecks): boolean {
  return checks.length && checks.letter && checks.digit;
}
