# VibeGames

Programa permanente de jogos independentes: um lugar aberto para publicar jogos, definir o preço (ou nenhum) e deixar as pessoas jogarem direto no navegador.

> Em construção. Contas, estante e rascunhos já funcionam (MongoDB). O catálogo começa vazio: publicar no programa, envio de arquivos e pagamentos ainda não estão ligados.

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
| `/` | Capa do programa: sala de exibição, "Hoje no programa", trilhas, área para criadores e agenda de jams |
| `/jogos` | Catálogo com filtros à vista (trilha, plataforma, preço, ordem) e busca (`?q=`, `?trilha=`) |
| `/jogo/[slug]` | Página do jogo: palco, preço/pague-o-que-quiser, downloads, detalhes |
| `/publicar` | Página do jogo em cinco passos com prévia ao vivo; salva como rascunho em `/conta/projetos` |
| `/jams` | Agenda de jams com a linha "agora" |
| `/criador/[slug]` | Página de quem fez |

## Estrutura

- `src/data/`: catálogo, jams, diário e coleções (vazios até haver jogos publicados); `base.ts` tem tipos, trilhas, plataformas e formatação
- `src/components/Cover.tsx`: estilos de capa em SVG usados pelos rascunhos
- `src/lib/auth`, `src/lib/library`, `src/lib/projects`: contas, estante e rascunhos sobre o MongoDB
- `src/app/globals.css`: tokens e estilos (Anybody + Schibsted Grotesk, auto-hospedadas via `@fontsource`)

## Design

Feito com a skill [Impeccable](https://impeccable.style) (`.claude/skills/impeccable`). Contexto de produto em `PRODUCT.md`, sistema visual em `DESIGN.md`, direção em `.impeccable/surfaces/`.
