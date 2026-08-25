export const showThemedAlert = jest.fn();
export const showThemedConfirm = jest.fn();

export function __resetThemedAlertDouble(): void {
  showThemedAlert.mockClear();
  showThemedConfirm.mockClear();
}
