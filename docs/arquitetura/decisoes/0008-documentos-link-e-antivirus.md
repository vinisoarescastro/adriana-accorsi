# 0008. Documentos, segredo do link de acompanhamento e antivírus

- Estado: aceita
- Data: 2026-11-12

## Contexto

A fase 2 introduz três coisas sensíveis: arquivos enviados por usuários (documentos da demanda), o segredo do link que o cidadão usará na fase 3 e a verificação de vírus. O Mandatus aceitava ZIP sem verificação e guardava o segredo do link só como hash, o que impede reenviá-lo ao cidadão.

## Decisão

**Documentos**

- Aceitos: PDF, PNG, JPEG e ZIP, até 25 MB. O tipo é decidido pelos **primeiros bytes**, nunca pela extensão nem pelo `Content-Type` enviado.
- Todo arquivo passa pelo ClamAV (protocolo INSTREAM, em contêiner). **Falha fechada:** se o antivírus não responde, o envio é recusado (503). Arquivo infectado nunca é guardado, e a recusa é registrada na trilha (sem o conteúdo).
- Os bytes vão para o armazenamento **antes** da linha no banco; se a linha falha, os bytes são apagados. Remover só marca como removido.
- Download sempre como anexo, com `X-Content-Type-Options: nosniff` e CSP `sandbox`. Não há URL direta do armazenamento.
- O alcance do documento é o do registro a que pertence.

**Segredo do link de acompanhamento**

- 256 bits aleatórios. No banco ficam o **hash SHA-256** (para validar) e uma **cópia cifrada** com AES-256-GCM, cuja chave deriva do segredo da aplicação por HKDF. A cópia cifrada permite reenviar o mesmo link ao cidadão (fase 3) sem poder ler o segredo de um backup do banco isolado.
- O segredo nunca entra na trilha.

**Trilha e dados pessoais**

- A trilha de `pessoa` guarda só os **nomes dos campos alterados**, nunca nome, telefone nem e-mail. Assim eliminar os dados pessoais (LGPD) não deixa cópia na trilha imutável.

## Consequências

- O compose de produção passa a ter o serviço `clamav`, e a API **exige** `CLAMAV_HOST` em produção. A primeira subida baixa as assinaturas (alguns minutos) e o serviço usa cerca de 1 GB de memória.
- Perder `SESSAO_SEGREDO` torna as cópias cifradas ilegíveis (os links já emitidos deixam de poder ser reenviados), por isso o segredo entra no backup de segredos.
- Documentos maiores que 25 MB ou de outros tipos são recusados de propósito; ampliar a lista é uma decisão nova.
