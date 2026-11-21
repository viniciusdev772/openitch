# Edição de arquivos: só com as ferramentas nativas

Para criar ou mudar arquivos, use sempre as ferramentas próprias: **Write** para criar ou reescrever um arquivo inteiro e **Edit** para trocar um trecho (leia antes com **Read**). Vale para código, texto, configuração, testes e scripts temporários no scratchpad.

## Proibido no shell (Bash ou PowerShell)
- Heredoc (`cat <<'EOF' > arquivo`, `cat >> arquivo <<EOF`, `python - <<'EOF'`).
- Scripts que gravam arquivos: Python, Node ou outro interpretador abrindo arquivo para escrita, `open(...).write`, `fs.writeFileSync`.
- Redirecionamento para criar ou mudar arquivo: `echo ... > arquivo`, `printf ... >> arquivo`, `tee`, `Set-Content`, `Out-File`, `Add-Content`.
- `awk`, `perl -i` e afins para editar.

## O máximo permitido
- `sed` numa linha só, para uma troca simples e mecânica (ex.: renomear um identificador em vários arquivos), quando o Edit seria muito repetitivo. Nada de `sed` com várias expressões encadeadas, multilinha ou que dependa de escapes frágeis: nesses casos, Edit.
- Comandos que mexem em arquivos sem editar conteúdo continuam valendo: `git rm`, `git mv`, `mkdir`, apagar arquivos temporários.

## Por quê
O usuário pediu (2026-11-21). Edições pelo shell já quebraram nesta sessão (heredoc com aspas cortado no meio, script Python com acento mal lido) e não aparecem como mudança revisável. Com Edit e Write a mudança é exata, aparece no diff da conversa e falha alto quando o trecho não bate.
