import { ChatOpenProvider, AskAboutFileCta, DesignSurface } from 'lions-of-zion';

/**
 * Context, not chrome. `ChatOpenProvider` holds the shared open-state that
 * `ParticleChatLauncher` and the dossier pages both read, so the "Ask the Lion
 * about this file" call-to-action at the foot of a page can open the launcher
 * that lives in the app's root layout.
 *
 * A provider has nothing to show on its own, so this previews what it enables:
 * the CTA below only works inside it.
 */
export function WhatItEnables() {
  return (
    <ChatOpenProvider>
      <DesignSurface>
        <AskAboutFileCta href="/war-update" />
      </DesignSurface>
    </ChatOpenProvider>
  );
}
