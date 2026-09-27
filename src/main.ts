// Entry point: Vite loads this file from index.html.
import '@fontsource/caveat-brush/latin-400.css';   // fonts are bundled, so the game works offline
import '@fontsource/patrick-hand/latin-400.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { addRoute, startRouter } from './screens/ui';
import { homeScreen } from './screens/home';
import { setupScreen } from './screens/setup';
import { playScreen } from './screens/play';
import { dailyScreen } from './screens/daily';
import { duelScreen } from './screens/duel';
import { splitScreen } from './screens/split';
import { profileScreen } from './screens/profile';
import { settingsScreen } from './screens/settings';
import { applyTheme, connect } from './state';

applyTheme();

addRoute('home', homeScreen);
addRoute('setup', setupScreen);
addRoute('play', playScreen);
addRoute('daily', dailyScreen);
addRoute('duel', duelScreen);
addRoute('split', splitScreen);
addRoute('profile', profileScreen);
addRoute('settings', settingsScreen);

startRouter();
void connect();        // find the PC server and the logged-in player (fine if offline)
registerSW({ immediate: true }); // offline support (PWA service worker)
