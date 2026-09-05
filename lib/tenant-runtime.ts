"use client";

import { getCurrentLocaleId, migrateLegacyToLocale, setCurrentLocaleId } from "./scoped-storage";
import { getLocale } from "./tenants";
import { useCassa } from "./cassa";
import { useLocaleStore, localeStoreDefaults } from "./locale-store";
import { useMenteStore, menteStoreDefaults } from "./store";
import { rebindSyncChannel } from "./sync";
import { useFiscal, defaultFiscalBundle } from "./fiscal";

/** Switch all persisted stores to a locale namespace and rehydrate. */
export function activateLocale(localeId: string) {
  const id = (localeId || "").trim().toLowerCase();
  if (!id) return;
  const switching = getCurrentLocaleId() !== id;

  setCurrentLocaleId(id);
  migrateLegacyToLocale(id);

  if (switching) {
    // Reset in-memory so previous locale data cannot bleed,
    // then rehydrate from ml:${id}:* keys.
    useMenteStore.setState({ ...menteStoreDefaults(), hydrated: false });
    useCassa.setState({ scontrini: [], chiusure: [], fondo: 150 });
    useLocaleStore.setState({ ...localeStoreDefaults() });
    useFiscal.setState({ ...defaultFiscalBundle(), rtLastOnline: null, rtLastCheckTs: 0, hydrated: false });
  }

  const after = () => {
    const loc = getLocale(id);
    const fondo = loc?.settings?.fondoIniziale;
    if (typeof fondo === "number" && Number.isFinite(fondo)) {
      const st = useCassa.getState();
      if (st.scontrini.length === 0 && st.chiusure.length === 0) {
        useCassa.getState().setFondo(fondo);
      }
    }
    rebindSyncChannel();
    useMenteStore.setState({ hydrated: true });
  };

  Promise.all([
    Promise.resolve(useMenteStore.persist.rehydrate()),
    Promise.resolve(useCassa.persist.rehydrate()),
    Promise.resolve(useLocaleStore.persist.rehydrate()),
    Promise.resolve(useFiscal.persist.rehydrate()),
  ]).then(() => {
    useFiscal.getState().loadFromTenant();
    after();
  }).catch(after);
}

export function deactivateLocale() {
  setCurrentLocaleId("");
  useMenteStore.setState({ ...menteStoreDefaults(), hydrated: false });
  useCassa.setState({ scontrini: [], chiusure: [], fondo: 150 });
  useLocaleStore.setState({ ...localeStoreDefaults() });
  useFiscal.setState({ ...defaultFiscalBundle(), rtLastOnline: null, rtLastCheckTs: 0, hydrated: false });
  rebindSyncChannel();
}

/** Re-apply tenant settings (fondo / brand) after titolare edits. */
export function applyTenantSettingsToRuntime(localeId: string) {
  const loc = getLocale(localeId);
  if (!loc) return;
  if (typeof loc.settings.fondoIniziale === "number") {
    // do not overwrite live fondo mid-service — only expose via settings UI
  }
}
