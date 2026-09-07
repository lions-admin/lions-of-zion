import {
  assetUrl,
  type ArchiveMedia,
  type ArchivePackageName,
  type ArchiveVersion,
} from './archive';

/**
 * The source media a record may hand to a native share integration.
 *
 * This deliberately walks content blocks in source order and accepts only a
 * block whose own `media_id` resolves to a locally-held image or video. Covers,
 * video thumbnails, OpenGraph art and generated derivatives cannot enter this
 * path because none of them is selected independently of a source media block.
 */
export type ArchiveShareMedia = {
  pkg: ArchivePackageName;
  mediaId: string;
  medium: 'video' | 'image';
  assetUrl: string;
};

export function firstArchiveSourceMedia(
  pkg: ArchivePackageName,
  version: ArchiveVersion,
  media: ReadonlyMap<string, ArchiveMedia>,
): ArchiveShareMedia | null {
  for (const block of version.content_blocks ?? []) {
    if ((block.type !== 'video' && block.type !== 'image') || !block.media_id) continue;
    const item = media.get(block.media_id);
    if (!item?.package_path) continue;
    if (item.type !== block.type) continue;
    return {
      pkg,
      mediaId: item.media_id,
      medium: item.type,
      assetUrl: assetUrl(pkg, item.package_path),
    };
  }
  return null;
}
