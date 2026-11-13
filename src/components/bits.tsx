// Programme furniture for pages that have the catalogue at hand. Everything
// but the creator lookup lives in "./bits-base"; client components that do not
// need the catalogue import from there instead, so GAMES and CREATORS stay out
// of their bundle.

import { creatorBySlug } from "@/data/catalog";
import { Entry as EntryCard, type EntryProps } from "./bits-base";

export { Joined, PlatformCodes, TrackChip, trackStyle } from "./bits-base";

/** The programme entry, with the creator's name looked up from the catalogue when not given. */
export function Entry(props: EntryProps) {
  return <EntryCard {...props} creatorName={props.creatorName ?? creatorBySlug(props.game.creator)?.name} />;
}
