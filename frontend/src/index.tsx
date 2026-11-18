import { faPalette } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Extension, ExtensionContext } from 'shared';
import AdminDefaultsPage from './AdminDefaultsPage.tsx';
import AppearancePage from './AppearancePage.tsx';
import { renderBackdrop } from './backdrop.ts';
import { registerBackupTimeline } from './BackupTimeline.tsx';
import { registerBreadcrumbs } from './Breadcrumbs.tsx';
import { registerConsoleColors } from './consoleColors.ts';
import { registerConsoleTools } from './ConsoleTools.tsx';
import { registerEditorDark } from './editorDark.ts';
import { registerGlow } from './glow.ts';
import { applyThemeColor, registerInstallPrompt } from './InstallHint.tsx';
import {
  applyPrefs,
  getEffectivePrefs,
  isTaxzActive,
  setAdminDefaultsFromIndex,
  type ThemePrefs,
  watchPrefs,
} from './prefs.ts';
import { registerServerHead } from './ServerHead.tsx';
import { registerStateHooks } from './states.tsx';
import { registerSidebarHooks } from './TaxzSidebar.tsx';
import { registerToastTiming } from './toastTiming.tsx';
import { getExtTranslations } from './translations.ts';


function apply(prefs: ThemePrefs) {
  applyPrefs(prefs);
  renderBackdrop(prefs.theme === 'taxz' ? prefs.background : null);
  applyThemeColor();
}

class DeTaxzThemeExtension extends Extension {
  public cardConfigurationPage: React.FC | null = AdminDefaultsPage;
  public cardIcon: React.ReactNode = <FontAwesomeIcon icon={faPalette} />;

  public initialize(ctx: ExtensionContext): void {
    setAdminDefaultsFromIndex(this.getIndexVariable('defaults'));
    registerInstallPrompt();

    // Sofort anwenden (vor dem ersten Zeichnen), danach bei jeder Aenderung, auch wenn ein anderes Geraet sie gespeichert hat.
    apply(getEffectivePrefs());
    watchPrefs(apply);

    ctx.extensionRegistry.enterRoutes((routes) =>
      routes.addAccountRoute({
        name: () => getExtTranslations().t('appearance.title', {}),
        icon: faPalette,
        path: '/appearance',
        element: AppearancePage,
      }),
    );

    // Serverliste: der eigene Seitenkopf (TaxzHomeTitle) ersetzt im taxz-Theme die Standard-Ueberschrift.
    ctx.extensionRegistry.enterPages((pages) => {
      const hideTitle = <P extends { hideTitleComponent?: boolean }>(props: P): P =>
        isTaxzActive() ? { ...props, hideTitleComponent: true } : props;
      pages.dashboard.home.containerAll.addPropsInterceptor(hideTitle);
      pages.dashboard.home.containerGrouped.addPropsInterceptor(hideTitle);
    });

    registerSidebarHooks();
    registerBreadcrumbs();
    registerServerHead();
    registerEditorDark(ctx);
    registerStateHooks();
    registerConsoleTools(ctx);
    registerConsoleColors(ctx);
    registerGlow();
    registerBackupTimeline(ctx);
    registerToastTiming(ctx);
  }
}

export default new DeTaxzThemeExtension();
