import { NextResponse } from "next/server";

export async function GET() {
  const csv = [
    "MENTE LOCALE — MODELLO ASL HACCP",
    "Compila dal tab HACCP per il file con i dati live della serata.",
    "",
    "Prodotto,Lotto,Apertura,Scadenza,Operatore",
    "Mozzarella,L12345,2026-09-01,2026-09-04,Marco",
    "",
    "Frigo,Temperatura,Min,Max,Stato",
    "Frigo Carne,2,0,4,OK",
    "Frigo Latticini,3,0,4,OK",
    "Cella,-18,-22,-16,OK",
    "",
    "Zona,Operatore,Stato,Note",
    "Cucina pavimento,Sala,DA FARE,",
  ].join("\n");
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ASL-Mente-Locale-modello.csv"`,
    },
  });
}
