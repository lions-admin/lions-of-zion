import "server-only";

import {
  X_PUBLIC_SESSION_COOKIE,
  getPublicXWriteAccess,
  publicSessionCookieOptions,
} from "@/server/core/auth/public-x";
import { resolveArchiveMedia } from "./archive";
import { createXMediaShareService } from "./service";

const postArchiveMediaToX = createXMediaShareService({
  resolveMedia: resolveArchiveMedia,
  getWriteAccess: getPublicXWriteAccess,
});

export {
  X_PUBLIC_SESSION_COOKIE,
  postArchiveMediaToX,
  publicSessionCookieOptions,
};
