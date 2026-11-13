# openitch

Programa permanente de jogos independentes: um lugar aberto para publicar jogos, definir o preço (ou nenhum) e deixar as pessoas jogarem direto no navegador.

> Protótipo. Todo o catálogo (jogos, criadores, jams, números) é material de amostra. Pagamentos, contas e envio de arquivos ainda não estão conectados.

## Rodar

Copie `.env.example` para `.env.local` e preencha `MONGODB_URI` (e `AUTH_SECRET`, se o banco não for local). Na Vercel as duas variáveis já estão cadastradas.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Páginas

| Rota | O que é |
|---|---|
| `/` | Capa do programa: jogo jogável em cartaz, "Hoje no programa", trilhas, área para criadores e agenda de jams |
| `/jogos` | Catálogo com filtros à vista (trilha, plataforma, preço, ordem) e busca (`?q=`, `?trilha=`) |
| `/jogo/[slug]` | Página do jogo: palco, preço/pague-o-que-quiser, downloads, detalhes |
| `/publicar` | Publicação em cinco passos com prévia ao vivo da entrada |
| `/jams` | Agenda de jams com a linha "agora" |
| `/criador/[slug]` | Página de quem fez |

## Estrutura

- `src/data/catalog.ts`: dados de amostra tipados (substituir por backend)
- `src/components/Cover.tsx`: capas autorais em SVG para os jogos de amostra
- `src/components/OrbitaGame.tsx`: Órbita, o jogo de navegador de demonstração (canvas)
- `src/app/globals.css`: tokens e estilos (Anybody + Schibsted Grotesk, auto-hospedadas via `@fontsource`)

## Design

Feito com a skill [Impeccable](https://impeccable.style) (`.claude/skills/impeccable`). Contexto de produto em `PRODUCT.md`, sistema visual em `DESIGN.md`, direção em `.impeccable/surfaces/`.
