import { pfpGradient, type Profile } from '../../lib/profile';

/**
 * A profile picture: the uploaded image, or the wallet-seeded (or picked) `pfpGradient` disc. Never a letter: the
 * fallback span holds no text. Decorative: the link or heading around it names the person.
 */
export function Avatar({ profile, size, className = '', testId }: { profile: Pick<Profile, 'pfp' | 'wallet'>; size: number; className?: string; testId?: string }) {
  const { pfp, wallet } = profile;
  const box = { width: size, height: size };
  if (pfp.kind === 'image') {
    return (
      <img
        src={pfp.dataUrl}
        alt=""
        width={size}
        height={size}
        decoding="async"
        draggable={false}
        data-testid={testId}
        data-pfp="image"
        style={box}
        className={`block shrink-0 rounded-full bg-pk-gray-100 object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      data-pfp={pfp.kind === 'preset' ? pfp.id : 'generated'}
      // The gradient's last layer is a bare colour, valid in the `background` shorthand but not in `background-image`.
      style={{ ...box, background: pfpGradient(pfp, wallet) ?? undefined }}
      className={`block shrink-0 rounded-full bg-pk-gray-100 ${className}`}
    />
  );
}
