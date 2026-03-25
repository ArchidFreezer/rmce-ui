/**
 * A simple spinner component to indicate loading state.
 * @prop size The size of the spinner in pixels. Defaults to 16.
 * The spinner is a circular element that rotates indefinitely. It uses CSS animations for the rotation effect.
 */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
