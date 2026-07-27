import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// This file is web-only and used to configure the root HTML for the web build.
export default function HTML({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* apple-touch-icon for iOS Add to Home Screen shortcut */}
        <link rel="apple-touch-icon" href="/icon.png" />

        {/* ScrollViewStyleReset resolves web ScrollView layout issues */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
