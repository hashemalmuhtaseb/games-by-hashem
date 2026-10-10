/** Drops a leading emoji (and its variation selector) from engine labels, so chrome stays icon-free. */
export function plainLabel(s: string): string {
  return s.replace(/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[️‍])+\s*/u, "");
}
