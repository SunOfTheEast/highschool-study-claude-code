const problemCardIdPattern = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;

export function isProblemCardId(value: string): boolean {
  return problemCardIdPattern.test(value);
}
