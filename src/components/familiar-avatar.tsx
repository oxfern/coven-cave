"use client";

import { useEffect, useState } from "react";
import { FamiliarGlyph } from "./familiar-glyph";
import { Modal } from "./ui/modal";
import type { ResolvedFamiliar } from "@/lib/familiar-resolve";

type Size = "sm" | "md" | "lg" | "xl";

const PX: Record<Size, number> = { sm: 16, md: 22, lg: 36, xl: 48 };

type Props = {
  familiar: ResolvedFamiliar;
  size?: Size;
  className?: string;
  title?: string;
  /** When true, clicking the avatar opens a full-size preview modal. */
  expandable?: boolean;
};

export function FamiliarAvatar({ familiar, size = "md", className, title, expandable }: Props) {
  const px = PX[size];
  // Fall back to the glyph when the avatar image fails to load (e.g. a
  // transient 404 while the avatar route compiles on a cold start, a timeout,
  // or a decode failure) instead of leaving the browser's broken-image
  // placeholder. The avatar route's 404 contract assumes this fallback. Reset
  // on src change so a new familiar/version re-attempts the image.
  const [errored, setErrored] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [familiar.avatarImage]);

  const hasImage = Boolean(familiar.avatarImage) && !errored;

  const imgEl = hasImage ? (
    <img
      src={familiar.avatarImage}
      alt={familiar.display_name}
      width={px}
      height={px}
      className={className ?? "inline-block rounded-sm object-cover"}
      title={title}
      onError={() => setErrored(true)}
    />
  ) : (
    <FamiliarGlyph
      glyph={familiar.glyph}
      size={size}
      className={className}
      title={title}
    />
  );

  if (expandable && hasImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          className="cursor-zoom-in"
          aria-label={`Enlarge ${familiar.display_name} avatar`}
          title="Click to enlarge"
        >
          {imgEl}
        </button>
        {enlarged ? (
          <Modal
            open
            onClose={() => setEnlarged(false)}
            breadcrumb={[familiar.display_name, "Avatar"]}
            ariaLabel={`${familiar.display_name} avatar`}
          >
            <div className="grid aspect-square w-full max-w-[320px] place-items-center overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-base)]">
              <img
                src={familiar.avatarImage}
                alt={`${familiar.display_name} avatar`}
                className="h-full w-full object-cover"
              />
            </div>
          </Modal>
        ) : null}
      </>
    );
  }

  return imgEl;
}
