/**
 * Joins class names, dropping falsy values.
 *
 * Deliberately tiny: the components in this project compose classes by
 * variant maps rather than by merging conflicting utilities at runtime, so a
 * full tailwind-merge is not needed and would only add bundle weight.
 */
export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ');
}
