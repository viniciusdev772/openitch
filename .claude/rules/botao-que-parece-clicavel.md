# Se parece botão, tem que clicar

Todo elemento com cara de controle (ícone de coração, "Curtir", "Seguir", contador ao lado de um ícone, pílula com borda) precisa ser um `<button>` ou um `<Link>` que faz alguma coisa. Não renderize um `<span>` ou `<p>` com o mesmo visual do botão "porque nesse caso a ação não vale".

## O que fazer quando a ação não vale para quem está vendo
- **Sem login:** o controle vira um `<Link>` para `/entrar?de=<volta para cá>`, com o mesmo visual.
- **Regra de negócio (dono, autor, conta nova etc.):** primeiro pergunte se a regra precisa existir. Se precisar, deixe o botão clicável e mostre o motivo ao clicar (`FormAlert`), ou mostre a informação com outro visual, sem cara de botão (texto simples, sem ícone de ação).
- Nunca use `cursor: default` num elemento estilizado como controle.

## Como testar
- Clique pela **posição** (`maestri portal click "Portal" "x,y"`, usando o centro do retângulo do snapshot), e não só pela ref `@eN`. A ref aciona o elemento direto e passa por cima do que estiver na frente.
- Teste com **quatro pessoas**: sem login, conta comum, dona do jogo e autora do comentário. Cada uma pode receber outro componente.

## Por quê
Em 2026-11-21 o usuário não conseguia curtir no portal. O coração do jogo e dos comentários aparecia igual ao botão, mas para quem é dono do jogo, autor do comentário ou está sem login era só um `<span>`/`<p>`. O servidor também recusava curtir o próprio conteúdo. Os testes passaram porque usaram uma conta que não era dona de nada e clicaram pela ref. O usuário pediu esta regra.
