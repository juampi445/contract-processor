/**
 * The generated mesh background, with the generator's controls kept live as
 * props instead of flattened into one fixed image.
 *
 *   blend   how far each colour stop reaches before it fades out
 *   grain   film grain over the whole field
 *
 * Both values are 0-100.
 */
export type MeshParams = {
  blend?: number;
  grain?: number;
};

const BASE_COLOR = '#397949';

const STOPS = [
  { x: 20, y: 15, color: '#698722' },
  { x: 52, y: 15, color: '#5e852e' },
  { x: 75, y: 32, color: '#548237' },
  { x: 26, y: 71, color: '#4a7f3e' },
  { x: 62, y: 89, color: '#417c44' },
  { x: 83, y: 62, color: '#397949' },
];

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export function MeshBackdrop({
  blend = 40,
  grain = 100,
  children,
}: MeshParams & { children: React.ReactNode }) {
  const spread = 30 + clamp(blend) * 0.5;
  const grainOpacity = (clamp(grain) / 100) * 0.18;

  const backgroundImage = STOPS.map(
    ({ x, y, color }) => `radial-gradient(at ${x}% ${y}%, ${color} 0px, transparent ${spread}%)`,
  ).join(', ');

  return (
    <div className="relative min-h-dvh overflow-hidden" style={{ backgroundColor: BASE_COLOR }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage }} />

      {grainOpacity > 0 && (
        <div
          aria-hidden
          className="auth-grain pointer-events-none absolute inset-0"
          style={{ opacity: grainOpacity }}
        />
      )}

      {/* Centred on small screens. From lg the card is pinned to a top offset
          that centres a 38rem card exactly, so a taller screen grows downward
          instead of pushing its own header up. max() keeps it off the top edge
          on short viewports. */}
      <div className="relative flex min-h-dvh items-center justify-center sm:p-6 lg:items-start lg:p-8 lg:pt-[max(2rem,calc(50dvh-19rem))]">
        {children}
      </div>
    </div>
  );
}
