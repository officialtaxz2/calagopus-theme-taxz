// Admin-Einstellungen (Designvorgabe 7.5): im taxz-Theme statt des Speichern-Knopfs jedes Reiters die Speichern-Leiste,
// die erscheint, sobald etwas geaendert ist ("2 ungespeicherte Änderungen · Verwerfen · Speichern") und unten klebt.
// Ohne Recht zum Speichern bleibt der gesperrte Knopf des Panels. Mit "Standard" rendert das Original.

import OriginalSettingsSaveButton from '@/pages/admin/settings/SettingsSaveButton.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import FormSaveBar from './FormSaveBar.tsx';
import { useIsTaxz } from './prefs.ts';
import { useCurrentSettingsForm } from './TaxzSettingsSection.ts';

type Props = Parameters<typeof OriginalSettingsSaveButton>[0];

export default function TaxzSettingsSaveButton(props: Props) {
  const isTaxz = useIsTaxz();
  const canUpdate = useAdminCan('settings.update');
  const form = useCurrentSettingsForm();
  if (!isTaxz || !canUpdate || !form) return <OriginalSettingsSaveButton {...props} />;
  return <FormSaveBar form={form} loading={props.loading} canSave={!props.disabled} />;
}
