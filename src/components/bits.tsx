// Programme furniture for pages that have the catalogue at hand. Everything
// lives in "./bits-base"; this entry point only fills the creator's name from
// the game itself (the catalogue loader resolves it), so callers need not.

import { Entry as EntryCard, type EntryProps } from "./bits-base";

export { Joined, PlatformCodes, TrackChip, trackStyle } from "./bits-base";

/** The programme entry, with the creator's name taken from the game when not given. */
export function Entry(props: EntryProps) {
  return <EntryCard {...props} creatorName={props.creatorName ?? props.game.creatorName} />;
}
