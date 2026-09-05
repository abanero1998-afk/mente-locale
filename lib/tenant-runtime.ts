"use client";

import { getCurrentLocaleId, migrateLegacyToLocale, setCurrentLocaleId } from "./scoped-storage";
import { getLocale } from "./tenants";
import { useCassa } from "./cassa";
import { useLocaleStore, localeStoreDefaults } from "./locale-store";
import { useMenteStore, menteStoreDefaults } from "./store";
import { rebindSyncChannel } from "./sync";
import { useFiscal, defaultFiscalBundle } from "./fiscal";
import {
  TESTEMATTE_LOCALE_ID,
  TESTEMATTE_MENU,
  TESTEMATTE_MENU_SEED_FLAG,
  TESTEMATTE_MENU_SEED_VERSION,
  isRtHardwareEmpty,
  testeMatteRtSeed,
  TESTEMATTE_HARDWARE,
} from "./locale-seeds/testematte";
import type { Piatto } from "./types";


/** True if menu still looks like the default Carbonara MENU_SEED (or empty). */
function isDefaultOrEmptyMenu(menu: Piatto[]): boolean {
  if (!menu || menu.length === 0) return true;
  const hasCarbonara = menu.some((p) => p.id === "1" && p.nome === "Carbonara");
  const hasTesteMatte = menu.some((p) => p.id.startsWith("tm-"));
  return hasCarbonara && !hasTesteMatte;
}

/** Seed Teste Matte dinner menu once; do not overwrite after dinner-v1 flag. */
export function ensureTesteMatteMenu() {
  if (typeof localStorage === "undefined") return;
  const flag = localStorage.getItem(TESTEMATTE_MENU_SEED_FLAG);
  const menu = useMenteStore.getState().menu || [];
  // Do NOT overwrite if already seeded (titolare may have edited).
  if (flag === TESTEMATTE_MENU_SEED_VERSION) return;
  // Seed when flag missing/outdated, or menu still default Carbonara / empty.
  if (flag !== TESTEMATTE_MENU_SEED_VERSION || isDefaultOrEmptyMenu(menu)) {
    useMenteStore.setState({ menu: TESTEMATTE_MENU });
    localStorage.setItem(TESTEMATTE_MENU_SEED_FLAG, TESTEMATTE_MENU_SEED_VERSION);
  }
}

/** Prefill A8010V / 3i_xonxoff ONLY for testematte when RT host empty. Never other locali. */
export function ensureTesteMatteHardware() {
  if (typeof localStorage === "undefined") return;
  if (getCurrentLocaleId() !== TESTEMATTE_LOCALE_ID) return;

  const fiscal = useFiscal.getState();
  const tenantRt = getLocale(TESTEMATTE_LOCALE_ID)?.settings?.fiscal?.rt;
  // Respect any existing host (runtime or tenant) — do not overwrite titolare edits.
  if (!isRtHardwareEmpty(fiscal.rt) || !isRtHardwareEmpty(tenantRt)) return;

  const seed = { ...testeMatteRtSeed(), hardwareModel: TESTEMATTE_HARDWARE.model };
  useFiscal.getState().setRt(seed);
  useFiscal.getState().syncToTenant();
}

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
    if (id === TESTEMATTE_LOCALE_ID) {
      ensureTesteMatteMenu();
      ensureTesteMatteHardware();
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
