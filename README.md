# Mente Locale — Restaurant OS

App operativa per ristoranti: dashboard live, gestione tavoli, prenotazioni, KDS cucina, magazzino, HACCP e assistente IA.

## Stack
- Next.js 14
- Tailwind CSS
- Framer Motion

## Avvio locale
```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Fiscale / bridge 3i (A8010V)

Su Vercel l app non raggiunge la LAN. Per Teste Matte:

1. RT: 192.168.1.60:1723
2. PC bridge: tools/rt-bridge-3i (PC fondatore http://192.168.1.61:8787)
3. In FISCALE/RT: Bridge URL = http://192.168.1.61:8787
4. Tablet, PC e RT sulla stessa Wi-Fi

Layer software — non certificazione; verificare i primi scontrini sull RT. demoNonFiscale offline.
