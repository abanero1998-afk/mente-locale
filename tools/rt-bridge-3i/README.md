# Bridge RT 3i Acapulco A8010V (XON/XOFF)

Piccolo servizio Node su PC/Raspberry nella stessa Wi-Fi del RT.

## Requisiti

- Node.js >= 18
- Stessa Wi-Fi: tablet, PC bridge, RT
- Firewall PC: porta 8787

## Avvio

Cartella tools/rt-bridge-3i
Installa dipendenze e avvia con lo script start del package

Env: porta bridge 8787, host RT 192.168.1.60, porta RT 1723, token opzionale

## Bridge URL

In FISCALE/RT: Bridge URL = http://IP-DEL-PC:8787
Il PC non e il RT. Esempio PC .2 -> http://192.168.1.2:8787

## Endpoint
- GET /health
- POST /probe
- POST /scontrino
prezzo in EUR, conversione in centesimi

## Onesta
Software layer, non certificazione. Verifica primi scontrini su RT reale. Usa demoNonFiscale offline.

## Checklist
1 RT acceso
2 PC bridge stessa Wi-Fi
3 Tablet stessa Wi-Fi
4 Imposta Bridge URL e testa
5 Primo scontrino di prova
Vercel non sostituisce il bridge.

## Avvio rapido (4 passi)

1. PC stessa Wi-Fi: entra in tools/rt-bridge-3i e avvia lo script start del package
2. Bridge ascolta 0.0.0.0:8787 e parla all RT 192.168.1.60:1723
3. Bridge URL in app = http://192.168.1.61:8787 (PC fondatore, NON il RT)
4. Apri porta 8787 sul firewall PC, poi Test connessione
