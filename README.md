# tute · contador

Contador de tute con cartas españolas, como app web estática (mobile-first).

- **Partida**: elegís quiénes juegan, cada mano se piden bazas y se cargan las ganadas; el puntaje se calcula solo (cumplís: 5 + lo pedido · fallás: restás la diferencia).
- **Planilla**: total acumulado mano a mano, con manos falladas y manos sin triunfo marcadas.
- **Torneo**: serie de partidas donde el puesto de cada una suma puntos; gana quien menos junta.
- **Jugadores**: nombres, colores y selfie para el avatar.
- **Reglas**: cómo se juega, con la mano fallada animada sobre la mesa.

Todo el estado vive en `localStorage` del dispositivo. Sin dependencias ni build: HTML + CSS + JS.

Diseño: sistema NEWRO (tipografías Mondwest, Formula Condensed y Gosha Sans).
