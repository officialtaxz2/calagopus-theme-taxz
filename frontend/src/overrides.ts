// Ersetzungen von Panel-Dateien beim Bau (Calagopus-Erweiterungssystem, nur der Aufruf defineOverride(Original, Ersatz)
// wird ausgewertet). Jeder Ersatz rendert mit dem Theme "Standard" die Originaldatei, das Umschalten bleibt also zur Laufzeit
// pro Benutzer moeglich (Designvorgabe 1.1). Bei einem Calagopus-Update meldet die Typpruefung, wenn sich Props geaendert haben.

import OriginalAnnouncementAlert from '@/elements/DismissibleAnnouncementAlert.tsx';
import OriginalPierreEditor from '@/elements/editors/PierreEditor.tsx';
import OriginalAdminOverview from '@/pages/admin/home/overview/AdminOverview.tsx';
import OriginalSettingsSaveButton from '@/pages/admin/settings/SettingsSaveButton.tsx';
import { useSettingsSection as originalUseSettingsSection } from '@/pages/admin/settings/useSettingsSection.ts';
import OriginalAccountContainer from '@/pages/dashboard/account/AccountContainer.tsx';
import OriginalHomeTitle from '@/pages/dashboard/home/DashboardHomeTitle.tsx';
import OriginalServerItem from '@/pages/dashboard/home/ServerItem.tsx';
import OriginalServerConsole from '@/pages/server/console/ServerConsole.tsx';
import OriginalFileDeleteModal from '@/pages/server/files/modals/FileDeleteModal.tsx';
import OriginalScheduleRow from '@/pages/server/schedules/ScheduleRow.tsx';
import OriginalCronTriggerExtraForm from '@/pages/server/schedules/triggers/CronTriggerExtraForm.tsx';
import OriginalWebsocketStatusBanner from '@/pages/server/WebsocketStatusBanner.tsx';
import OriginalServerSettings from '@/pages/server/settings/ServerSettings.tsx';
import OriginalServerStartup from '@/pages/server/startup/ServerStartup.tsx';
import TaxzAccountContainer from './TaxzAccountContainer.tsx';
import TaxzAdminOverview from './TaxzAdminOverview.tsx';
import TaxzAnnouncement from './TaxzAnnouncement.tsx';
import TaxzFileDeleteModal from './TaxzFileDeleteModal.tsx';
import TaxzHomeTitle from './TaxzHomeTitle.tsx';
import TaxzPierreEditor from './TaxzPierreEditor.tsx';
import TaxzCronTriggerForm from './TaxzCronTriggerForm.tsx';
import TaxzScheduleRow from './TaxzScheduleRow.tsx';
import TaxzServerConsole from './TaxzServerConsole.tsx';
import TaxzServerItem from './TaxzServerItem.tsx';
import TaxzServerSettings from './TaxzServerSettings.tsx';
import TaxzServerStartup from './TaxzServerStartup.tsx';
import TaxzSettingsSaveButton from './TaxzSettingsSaveButton.tsx';
import { useSettingsSection as taxzUseSettingsSection } from './TaxzSettingsSection.ts';
import TaxzWebsocketBanner from './TaxzWebsocketBanner.tsx';

function defineOverride<T>(original: T, replacement: NoInfer<T>) {
  return { original, replacement };
}

export default [
  defineOverride(OriginalServerItem, TaxzServerItem),
  defineOverride(OriginalHomeTitle, TaxzHomeTitle),
  defineOverride(OriginalServerConsole, TaxzServerConsole),
  defineOverride(OriginalServerSettings, TaxzServerSettings),
  defineOverride(OriginalAdminOverview, TaxzAdminOverview),
  defineOverride(OriginalFileDeleteModal, TaxzFileDeleteModal),
  defineOverride(OriginalWebsocketStatusBanner, TaxzWebsocketBanner),
  defineOverride(OriginalScheduleRow, TaxzScheduleRow),
  defineOverride(OriginalCronTriggerExtraForm, TaxzCronTriggerForm),
  defineOverride(OriginalAnnouncementAlert, TaxzAnnouncement),
  defineOverride(OriginalServerStartup, TaxzServerStartup),
  defineOverride(OriginalPierreEditor, TaxzPierreEditor),
  defineOverride(OriginalAccountContainer, TaxzAccountContainer),
  defineOverride(OriginalSettingsSaveButton, TaxzSettingsSaveButton),
  defineOverride(originalUseSettingsSection, taxzUseSettingsSection),
];
