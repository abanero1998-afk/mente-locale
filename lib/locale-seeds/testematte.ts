import type { Piatto } from "../types";

export const TESTEMATTE_LOCALE_ID = "testematte";
export const TESTEMATTE_NOME = "Teste Matte";
export const TESTEMATTE_PIN = "0000";

/** Flag localStorage: once dinner-v1, titolare edits are preserved. */
export const TESTEMATTE_MENU_SEED_FLAG = "ml:testematte:menu-seed";
export const TESTEMATTE_MENU_SEED_VERSION = "dinner-v1";

const U = (id: string) =>
  `https://images.unsplash.com/${id}?w=400&h=300&fit=crop`;

/** Dinner menu from testematteanzio.it — sections match website. */
export const TESTEMATTE_MENU: Piatto[] = [
  // Tacos (3 pezzi)
  {
    id: "tm-1",
    nome: "Fish tacos",
    prezzo: 7,
    reparto: "cucina",
    categoria: "Tacos",
    descrizione: "Salmone marinato in casa e guacamole — 3 pezzi",
    img: U("photo-1551504734-5ee1c4a1479b"),
  },
  {
    id: "tm-2",
    nome: "Beaf tacos",
    prezzo: 8,
    reparto: "cucina",
    categoria: "Tacos",
    descrizione: "Black angus, olio al sesamo, soia, porro e spicy mayo — 3 pezzi",
    img: U("photo-1565299585323-38d6b0865b47"),
  },
  {
    id: "tm-3",
    nome: "Chicken tacos",
    prezzo: 6,
    reparto: "cucina",
    categoria: "Tacos",
    descrizione: "Pulled di pollo e pico de gallo — 3 pezzi",
    img: U("photo-1599974579688-8dbdd335c77f"),
  },
  // Toastamatti
  {
    id: "tm-4",
    nome: "Il croccante",
    prezzo: 5,
    reparto: "cucina",
    categoria: "Toastamatti",
    descrizione:
      "Mortadella artigianale di montecompatri, stracciatella, granella di pistacchi",
    img: U("photo-1528735602780-2552fd46c7af"),
  },
  {
    id: "tm-5",
    nome: "Il sofisticato",
    prezzo: 6,
    reparto: "cucina",
    categoria: "Toastamatti",
    descrizione:
      "Prosciutto di crudo di bassiano km0, mozzarella di bufala campana dop, pico de gallo",
    img: U("photo-1482049016688-2d3e1b311543"),
  },
  {
    id: "tm-6",
    nome: "Il goloso",
    prezzo: 6,
    reparto: "cucina",
    categoria: "Toastamatti",
    descrizione: "Pollo alla cacciatora e salsa cheddar",
    img: U("photo-1509722747041-616f39b57569"),
  },
  // Fritti
  {
    id: "tm-7",
    nome: "Supplì artigianale 160 gr",
    prezzo: 3.5,
    reparto: "cucina",
    categoria: "Fritti",
    img: U("photo-1626082927389-6cd097cdc6ec"),
  },
  {
    id: "tm-8",
    nome: "Bombe ascolane giganti artigianali (3 pz)",
    prezzo: 6,
    reparto: "cucina",
    categoria: "Fritti",
    img: U("photo-1608039829570-428c5a3e67bb"),
  },
  {
    id: "tm-9",
    nome: "Fiori di zucca pastellati (2 pz)",
    prezzo: 3.5,
    reparto: "cucina",
    categoria: "Fritti",
    img: U("photo-1563379926898-05f4575a45d8"),
  },
  {
    id: "tm-10",
    nome: "Pop corn di pollo",
    prezzo: 5,
    reparto: "cucina",
    categoria: "Fritti",
    img: U("photo-1626645738196-c2a7c87a8f58"),
  },
  {
    id: "tm-11",
    nome: "French fries cacio e pepe",
    prezzo: 4,
    reparto: "cucina",
    categoria: "Fritti",
    img: U("photo-1573080496219-bb080dd4f877"),
  },
  {
    id: "tm-12",
    nome: "Patatine fritte classiche",
    prezzo: 3,
    reparto: "cucina",
    categoria: "Fritti",
    img: U("photo-1630384060421-c964ad5088a1"),
  },
  // Pinse
  {
    id: "tm-13",
    nome: "La sballata",
    prezzo: 9.5,
    reparto: "cucina",
    categoria: "Pinse",
    descrizione:
      "Prosciutto crudo di bassiano, mozzarella di bufala campana dop, pico de gallo",
    img: U("photo-1513104890138-7c749659a591"),
  },
  {
    id: "tm-14",
    nome: "Napoli quando",
    prezzo: 10,
    reparto: "cucina",
    categoria: "Pinse",
    descrizione: "Pomodoro merinda bruciato, stracciatella, alici, chimichurri",
    img: U("photo-1574071318508-1cdbab80d002"),
  },
  {
    id: "tm-15",
    nome: "Fiori di testa",
    prezzo: 11,
    reparto: "cucina",
    categoria: "Pinse",
    descrizione:
      "Zucchine alla scapece, zest di limone e menta fresca, provola fresca affumicata e stracciata e fiore di zucca pastellato",
    img: U("photo-1565299624946-b28f40a0ae38"),
  },
  {
    id: "tm-16",
    nome: "La signorina",
    prezzo: 10,
    reparto: "cucina",
    categoria: "Pinse",
    descrizione: "Mortadella, stracciatella e granella di pistacchio",
    img: U("photo-1604382354936-07c5d9983bd3"),
  },
  // Panini
  {
    id: "tm-17",
    nome: "Simple burger",
    prezzo: 10,
    reparto: "cucina",
    categoria: "Panini",
    descrizione: "Hamburger di manzo 200gr, insalata iceberg, pomodoro",
    img: U("photo-1568901346375-23c9450c58cd"),
  },
  {
    id: "tm-18",
    nome: "Cheese burger",
    prezzo: 13,
    reparto: "cucina",
    categoria: "Panini",
    descrizione:
      "Hamburger di manzo, cheddar, cipolla caramellata, bacon, con patatine",
    img: U("photo-1553979459-d2229ba7433b"),
  },
  {
    id: "tm-19",
    nome: "Royal burger",
    prezzo: 15,
    reparto: "cucina",
    categoria: "Panini",
    descrizione: "Hamburger di manzo, uovo, salsa burger, bacon, con patatine",
    img: U("photo-1594212699903-ec8a3eca50f5"),
  },
  {
    id: "tm-20",
    nome: "Double chicken burger",
    prezzo: 16,
    reparto: "cucina",
    categoria: "Panini",
    descrizione:
      "Doppia cotoletta, doppio bacon, salsa cheddar, cipolla, con patatine",
    img: U("photo-1606755962773-d324e0a13086"),
  },
  // Desserts
  {
    id: "tm-21",
    nome: "Tiramisù",
    prezzo: 5,
    reparto: "cucina",
    categoria: "Desserts",
    img: U("photo-1571877227200-a0d98ea607e9"),
  },
  {
    id: "tm-22",
    nome: "Torta del giorno",
    prezzo: 5,
    reparto: "cucina",
    categoria: "Desserts",
    img: U("photo-1578985545062-69928b1d9587"),
  },
  {
    id: "tm-23",
    nome: "Gelato (2 gusti)",
    prezzo: 5,
    reparto: "cucina",
    categoria: "Desserts",
    img: U("photo-1563805042-7684c019e1cb"),
  },
];

/** A8010V @ LAN — ONLY for locale id testematte. Do not reuse for other locali. */
export const TESTEMATTE_HARDWARE = {
  model: "A8010V",
  vendor: "3i_xonxoff" as const,
  host: "192.168.1.60",
  port: 1723,
  enabled: true,
  path: "/",
  devid: "A8010V",
  timeoutMs: 10000,
  useHttps: false,
};

/** RT patch for FiscalBundle.rt when hardware is empty. */
export function testeMatteRtSeed() {
  const h = TESTEMATTE_HARDWARE;
  return {
    enabled: h.enabled,
    vendor: h.vendor,
    host: h.host,
    port: h.port,
    path: h.path,
    devid: h.devid,
    timeoutMs: h.timeoutMs,
    useHttps: h.useHttps,
  };
}

export function isRtHardwareEmpty(rt: { host?: string } | null | undefined): boolean {
  return !(rt?.host || "").trim();
}

