import React from 'react';
import {AppShell} from './components/AppShell';
import {PWAStatusBanners} from './components/PWAStatusBanners';
import {AppProvider} from './context/AppContext';
import {ReaderChromeProvider} from './context/ReaderChromeContext';
import {HelpScreen} from './features/help/HelpScreen';
import {ImportScreen} from './features/import/ImportScreen';
import {LibraryScreen} from './features/library/LibraryScreen';
import {ReaderScreen} from './features/reader/ReaderScreen';
import {SettingsScreen} from './features/settings/SettingsScreen';
import {useHashRoute} from './hooks/useHashRoute';

export default function App() {
  const {route, navigate} = useHashRoute();

  return (
    <AppProvider>
      <ReaderChromeProvider>
        <AppShell route={route} onNavigate={navigate}>
          {route.name === 'library' && <LibraryScreen onNavigate={navigate} />}
          {route.name === 'import' && <ImportScreen onNavigate={navigate} />}
          {route.name === 'settings' && <SettingsScreen />}
          {route.name === 'help' && <HelpScreen section={route.section} onNavigate={navigate} />}
          {route.name === 'read' && (
            <ReaderScreen documentId={route.documentId} onNavigate={navigate} />
          )}
        </AppShell>
        <PWAStatusBanners />
      </ReaderChromeProvider>
    </AppProvider>
  );
}
