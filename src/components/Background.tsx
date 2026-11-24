import { memo } from 'react';

/**
 * Decorative brand background: soft drifting color fields in the Roboyell palette
 * and a fine dot grid. Hidden from assistive tech; motion stops under prefers-reduced-motion.
 */
export const Background = memo(function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__blob bg__blob--violet" />
      <div className="bg__blob bg__blob--blue" />
      <div className="bg__blob bg__blob--peach" />
      <div className="bg__dots" />
      <div className="bg__veil" />
    </div>
  );
});
