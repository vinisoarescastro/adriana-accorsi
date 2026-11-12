# Backup e restauração

Estado: **testado** contra um Postgres 17 real (backup criptografado, restauração em banco novo, conferência, recusas e invariantes no banco restaurado). Ainda não rodou na VPS de produção.

## Princípios

1. **Backup que nunca foi restaurado não é backup.** A restauração é testada, e deve ser repetida de tempos em tempos.
2. **Sempre criptografado.** O arquivo contém dados pessoais de cidadãos. O script se recusa a rodar sem `BACKUP_SENHA`.
3. **Fora da VPS.** Se o servidor se perde, os backups que estavam nele se perdem junto. Configure `BACKUP_DESTINO_RCLONE`.
4. **A senha do backup também fica fora da VPS** (num cofre de senhas). Sem ela, o arquivo não abre.
5. **A restauração nunca sobrescreve o banco em uso.** Ela cria um banco novo, confere, e só então você decide trocar.

## Fazer um backup

```
export BACKUP_SENHA='...'             # senha forte, guardada fora do servidor
export BACKUP_DESTINO_RCLONE='r2:gabinete-backups'   # opcional, usa rclone
export POSTGRES_USER=postgres POSTGRES_DB=gabinete
bash infra/scripts/backup.sh
```

Gera `backups/gabinete-AAAAMMDD-HHMMSS.dump.enc` (formato `pg_dump -Fc`, criptografado com AES-256 e PBKDF2), recusa arquivo vazio, envia para fora se configurado e apaga os locais com mais de `BACKUP_RETENCAO_DIAS` (padrão 14).

### Todo dia, automático

No `crontab` do servidor (por exemplo, às 03:00):

```
0 3 * * * cd /opt/gabinete && . ./.backup.env && bash infra/scripts/backup.sh >> /var/log/gabinete-backup.log 2>&1
```

O arquivo `.backup.env` (permissão 600, fora do repositório) exporta `BACKUP_SENHA`, `BACKUP_DESTINO_RCLONE` e `POSTGRES_USER`.

## Restaurar (e testar a restauração)

```
export BACKUP_SENHA='...'
bash infra/scripts/restaurar.sh backups/gabinete-20261112-030000.dump.enc gabinete_restaurado
```

O script cria `gabinete_restaurado`, restaura, e confere: número de tabelas, migrações aplicadas, usuários, administradores ativos e registros da trilha. Recusa: banco de destino já existente, o próprio banco em uso, senha errada (e nesse caso não deixa banco parcial).

**Teste a restauração** pelo menos a cada trimestre, e registre o resultado em `docs/operacao/conferencias/`. Meça o tempo: ele é o seu tempo de recuperação.

## Recuperação de desastre (servidor novo)

1. Provisione a VPS nova e instale Docker. Clone o repositório e recrie `.env.producao` e `.env.administrativo` (as senhas dos papéis devem ser as de antes).
2. Suba só o banco e crie os papéis: `docker compose -f compose.producao.yaml up -d postgres` e depois o comando de papéis (`implantar.sh` faz isso, mas pare antes de subir a API).
3. Baixe o backup mais recente de fora da VPS e restaure em um banco novo com `restaurar.sh`.
4. Confira os números e rode `npm run banco:verificar` apontando para o banco restaurado.
5. Aponte a aplicação para o banco restaurado (ou renomeie os bancos com o sistema parado) e suba a API e o Caddy.
6. Ajuste o DNS para o IP novo.

Os **dados dos arquivos** (documentos e fotos) ficam no Cloudflare R2, fora da VPS, e sobrevivem à perda do servidor. A **senha de sessão** (`SESSAO_SEGREDO`) pode ser a mesma ou nova; se nova, todos precisam entrar de novo.

## O que o teste verificou

- O arquivo gerado começa com o cabeçalho de criptografia e não contém o conteúdo em claro.
- Restaurado em banco novo: 13 tabelas, 6 migrações, usuários e trilha presentes.
- O dono das tabelas restaurado é o papel de migração (a aplicação consegue migrar o banco restaurado).
- Os 8 invariantes de segurança passam no banco restaurado.
- Senha errada, banco existente e banco em uso são recusados.
