import { Container, CardSkeleton } from '@/components/ui/primitives';

/**
 * Default route-level loading state.
 *
 * Skeletons rather than a spinner: they preserve the page's shape, so nothing
 * jumps when the real content arrives.
 */
export default function Loading() {
  return (
    <Container className="py-14">
      <span className="sr-only" role="status">
        Carregando…
      </span>

      <span className="skeleton mt-2 block h-[16px] w-[120px]" />
      <span className="skeleton mt-4 block h-[40px] w-[60%] max-w-[520px]" />
      <span className="skeleton mt-3 block h-[18px] w-[45%] max-w-[420px]" />

      <div className="mt-10 grid grid-cols-4 gap-[14px] max-lg:grid-cols-2 max-sm:grid-cols-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}
