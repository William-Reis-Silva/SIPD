# Convites — Convite de Orador via Link Público (UC-CONV-001 a 007)

**Data:** 2026-08-21
**Módulo:** Convites (`06.1.6 - Convites.md`)
**Fora de escopo (fatias futuras):** UC-ORA-007 (Vincular Conta ao Orador), Motor de Regras/alertas soft (`06.1.9`), Relatório de Convites (UC-REL-004), Dashboard/Pendências (UC-INT-004/005) — ver "Não-objetivos".

---

## Contexto

`14-Roadmap.md` coloca Convites como a 6ª fatia, depois de Programações e Oradores (ambas já construídas). O módulo cobre 7 Casos de Uso: criar, enviar, reenviar, cancelar (lado da equipe) e aceitar, recusar, confirmar (lado do Orador).

**Achado 1 — numeração de RN trocada em `06.1.6`** (mesmo tipo de erro já visto em `06.1.5 - Programações.md`): os UCs desse documento referenciam RN-050/051/054 nas seções "Regras de Negócio Relacionadas", mas essas são as regras de **Programações**. As regras reais de Convites são **RN-060 a RN-064**, e as de Confirmação são **RN-070 a RN-073**:

- RN-060: todo convite deve estar vinculado a uma programação.
- RN-061: todo convite é destinado a apenas um orador.
- RN-062: ao aceitar, o sistema disponibiliza automaticamente o formulário de confirmação.
- RN-063: estados possíveis — Enviado, Aceito, Recusado, Cancelado, Expirado (o banco já usa também `Criado`, estado inicial antes do envio — ver "Modelo de Dados").
- RN-064: o convite permanece no histórico mesmo após cancelado.
- RN-070: toda confirmação pertence a exatamente um convite.
- RN-071: a confirmação pode conter cântico inicial, uso de imagens, arquivos, observações, confirmação de permanência até o final.
- RN-072: arquivos enviados ficam vinculados à confirmação.
- RN-073: após o envio da confirmação, a programação assume automaticamente o status **Confirmada**.

Esta spec usa o conteúdo correto; a correção da numeração em `06.1.6` fica registrada aqui, sem editar o documento formal (mesma decisão já tomada nas fatias anteriores).

**Achado 2 — UC-CONV-005/006/007 dependiam de uma peça que nunca foi construída.** A especificação assume que o Orador responde ao convite **autenticado**, via conta vinculada (RN-035/036, UC-ORA-007 "Vincular Conta ao Orador"). Essa vinculação nunca foi implementada (sem RPC, sem UI) e não existe hoje nenhuma área autenticada para o Orador — o `(app)` atual é um painel para equipe de congregação (Perfil-based), incompatível com uma conta de Orador puro (que, por decisão de arquitetura, nunca tem Perfil).

**Decisão tomada com o usuário:** em vez de construir UC-ORA-007 e um portal autenticado, o Orador responde por um **link público com token**, sem login — o mesmo mecanismo que a congregação já usa hoje manualmente (WhatsApp com datas em aberto + Google Forms para resposta, ver imagens de referência em `exemplos/`). Isso elimina a dependência de UC-ORA-007 para esta fatia.

**Achado 3 — o fluxo real é diferente do que a especificação assume.** Em `06.1.6`, uma Programação já nasce com data e tema fixos (RN-050) antes de o Convite existir — o convite só é aceito/recusado. Na prática observada (imagens de referência), é o **Orador quem escolhe a data** entre várias oferecidas pela equipe, **e quem declara o tema** que tem preparado. A Programação só existe de fato depois dessa escolha.

**Modelo adotado (aprovado com o usuário):** o Convite é desacoplado de uma Programação pré-existente. Ele nasce com um Orador, uma Congregação e uma lista de **datas candidatas**; a Programação só é criada quando o Orador responde. Tema não é pré-definido pela equipe — na resposta, o sistema oferece ao Orador os temas que ele já tem preparados (`temas_preparados`, cadastro já existente do módulo Oradores), filtrando os que já estão comprometidos em outra Programação futura da mesma congregação.

**Decisão de segurança que precisa de ADR própria:** o mecanismo de convite parecido que já existe (`convites_usuario`, `13-ADR.md` ADR-010) exige sessão autenticada nas RPCs — há inclusive uma migração (`20260818012300`) revogando explicitamente o acesso do papel `anon`. Aqui é o oposto, por pedido direto do usuário: as RPCs de resposta ao convite precisam ser chamáveis por `anon` (a identidade é a posse do token da URL, não uma conta). É uma exceção deliberada ao padrão vigente, não um descuido — vai virar **ADR-011** em `13-ADR.md` quando implementada (ver "Documentação a atualizar").

**Achado 4 — o gatilho de RN-073 (Programação → Confirmada ao enviar a Confirmação) ainda não existe no banco.** `12-API.md` já documentava a intenção ("efeitos colaterais implementados via trigger"), mas nenhuma migração criou esse trigger. Construído nesta fatia.

## Não-objetivos

- **UC-ORA-007 (Vincular Conta ao Orador) e portal autenticado do Orador** — substituídos pelo link público com token (ver Achado 2). Fica como possibilidade futura, não dependência.
- **Notificação in-app (tabela `notificacoes`)** — a comunicação do link continua manual (WhatsApp, como hoje), no espírito do ADR-010. A tabela já existe (0 linhas) e é o encaixe natural para isso depois; fora de escopo agora.
- **Alertas de repetição de tema "soft" (RN-090/091, Inteligência `06.1.9`)** — são avisos históricos não-bloqueantes, de um módulo que ainda não existe. A exclusividade de tema desta fatia é uma trava **dura** e diferente (ver "Regras de Exclusividade"), não substitui nem antecipa o Motor de Regras.
- **Relatório de Convites (UC-REL-004) e Dashboard/Pendências (UC-INT-004/005)** — dependem desta fatia existir primeiro; ficam para os módulos Relatórios/Inteligência no roadmap.
- **Reenvio automático / lembrete de expiração** — reenviar é uma ação manual do staff (UC-CONV-003); não há job agendado nesta fatia (mesmo padrão "preguiçoso" já usado em `convites_usuario`, ver "Modelo de Dados").
- **Edição da resposta depois de enviada** (trocar data/tema já aceitos, ou editar a Confirmação já enviada) — se o Orador errou, a equipe cancela e cria um novo convite; mesmo espírito de "não reabrir" já usado em Suporte.
- Testes automatizados — projeto ainda sem framework configurado; verificação manual via Playwright.

## Arquitetura

### Modelo de Dados

**Alterações em `convites`** (tabela já existe, criada em `20260812130000_replace_prototype_with_der_schema.sql`):

```sql
alter table public.convites
  alter column programacao_id drop not null,
  add column congregacao_id uuid references public.congregacoes (id),
  add column token uuid not null default gen_random_uuid(),
  add column expira_em timestamptz not null default (now() + interval '7 days'),
  add constraint convites_token_key unique (token);

update public.convites set congregacao_id = (select p.congregacao_id from public.programacoes p where p.id = convites.programacao_id);
alter table public.convites alter column congregacao_id set not null;

create index convites_congregacao_id_idx on public.convites (congregacao_id);
create index convites_token_idx on public.convites (token);
```

`token` é um `uuid` (não um código de 8 caracteres como em `convites_usuario`) — aqui ninguém digita o código manualmente, só clica num link (`/convite/{token}`), então entropia alta sem necessidade de retry-loop de geração é a escolha mais simples.

**Nova tabela `convite_datas`** (datas candidatas oferecidas ao Orador):

```sql
create table public.convite_datas (
  id          uuid primary key default gen_random_uuid(),
  convite_id  uuid not null references public.convites (id) on delete cascade,
  data        date not null,
  criado_em   timestamptz not null default now(),
  constraint convite_datas_convite_data_key unique (convite_id, data)
);

create index convite_datas_convite_id_idx on public.convite_datas (convite_id);
```

**Gatilho de exclusividade de data** (Ponto 1 confirmado: nenhuma data candidata pode se repetir entre convites simultaneamente abertos da mesma congregação):

```sql
create or replace function public.convite_datas_verifica_exclusividade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_congregacao_id uuid;
begin
  select congregacao_id into v_congregacao_id from public.convites where id = new.convite_id;

  if exists (
    select 1
    from public.convite_datas cd
    join public.convites c on c.id = cd.convite_id
    where cd.data = new.data
      and c.congregacao_id = v_congregacao_id
      and c.status in ('Criado', 'Enviado')
      and c.id <> new.convite_id
  ) then
    raise exception 'data_ja_ofertada';
  end if;

  return new;
end;
$$;

create trigger convite_datas_verifica_exclusividade before insert on public.convite_datas
  for each row execute function public.convite_datas_verifica_exclusividade();
```

Como o convite deixa de contar (`status not in ('Criado','Enviado')`) assim que é aceito, recusado, cancelado ou expira, a data volta a ficar disponível automaticamente — sem faxina extra.

**Coluna nova em `confirmacoes`** (anexos — RN-072):

```sql
alter table public.confirmacoes add column anexos jsonb not null default '[]';
```

`anexos` guarda `[{ "caminho": "...", "nome_arquivo": "..." }]`. Optei por `jsonb` em vez de uma tabela relacional própria porque todos os anexos de uma confirmação são criados juntos, no mesmo envio, sem necessidade de estado individual por arquivo — uma tabela dedicada seria estrutura sem uso nesta fatia (mesmo raciocínio de `historicos.dados` já usado no schema).

**Trigger novo — RN-073** (Programação → Confirmada ao enviar a Confirmação; não existia, ver Achado 4):

```sql
create or replace function public.confirmacao_confirma_programacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.programacoes
  set status = 'Confirmada'
  where id = (select programacao_id from public.convites where id = new.convite_id)
    and status not in ('Realizada', 'Cancelada', 'Arquivada');
  return new;
end;
$$;

create trigger confirmacao_confirma_programacao after insert on public.confirmacoes
  for each row execute function public.confirmacao_confirma_programacao();
```

**RLS ajustada em `convites`** — as políticas `convites_staff_write`/`convites_staff_update` hoje verificam permissão via `join` em `programacoes` (`exists (select 1 from programacoes p where p.id = convites.programacao_id ...)`), mas `programacao_id` agora é nulo até o Orador responder. Reescritas para usar a nova coluna `congregacao_id` diretamente:

```sql
drop policy convites_staff_write on public.convites;
create policy convites_staff_write on public.convites
  for insert to authenticated
  with check (
    public.is_administrador_global()
    or (public.is_coordenador_ou_editor() and congregacao_id = public.current_usuario_congregacao_id())
  );

drop policy convites_staff_update on public.convites;
create policy convites_staff_update on public.convites
  for update to authenticated
  using (
    public.is_administrador_global()
    or (public.is_coordenador_ou_editor() and congregacao_id = public.current_usuario_congregacao_id())
  )
  with check (
    public.is_administrador_global()
    or (public.is_coordenador_ou_editor() and congregacao_id = public.current_usuario_congregacao_id())
  );
```

A policy `convites_orador_responde` (RN-036, resposta via conta vinculada) fica como está — inofensiva e inerte, já que nenhum Orador tem `usuario_id` vinculado nesta fatia (Achado 2). Não é removida: se UC-ORA-007 for construído no futuro, já funciona.

`convite_datas` e `confirmacoes` (leitura pelo staff) seguem o mesmo critério de `congregacao_id`/`convite_id`, mesmo padrão das policies já existentes de `convites_select`.

**Sem policy de INSERT/UPDATE para `anon`** em nenhuma tabela — todo o acesso público passa pelas RPCs abaixo (`security definer`, bypassa RLS internamente, valida pelo token).

### RPCs públicas (sem login — ver Achado 2 e a decisão de segurança)

```sql
create or replace function public.consultar_convite_publico(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_convite record;
  v_resultado jsonb;
begin
  select c.*, o.nome as orador_nome, o.sobrenome as orador_sobrenome,
         cg.nome as congregacao_nome, cg.numero as congregacao_numero
  into v_convite
  from public.convites c
  join public.oradores o on o.id = c.orador_id
  join public.congregacoes cg on cg.id = c.congregacao_id
  where c.token = p_token;

  if v_convite.id is null then
    raise exception 'convite_invalido';
  end if;

  if v_convite.status in ('Criado', 'Enviado') and v_convite.expira_em < now() then
    update public.convites set status = 'Expirado' where id = v_convite.id;
    v_convite.status := 'Expirado';
  end if;

  v_resultado := jsonb_build_object(
    'status', v_convite.status,
    'orador_nome', v_convite.orador_nome || ' ' || v_convite.orador_sobrenome,
    'congregacao_nome', v_convite.congregacao_nome,
    'datas_candidatas', (
      select coalesce(jsonb_agg(cd.data order by cd.data), '[]'::jsonb)
      from public.convite_datas cd where cd.convite_id = v_convite.id
    ),
    'temas_disponiveis', case when v_convite.status in ('Criado', 'Enviado') then (
      select coalesce(jsonb_agg(jsonb_build_object('tema_id', tp.tema_id, 'numero', t.numero, 'titulo', t.titulo)), '[]'::jsonb)
      from public.temas_preparados tp
      join public.temas t on t.id = tp.tema_id
      where tp.orador_id = v_convite.orador_id and tp.ativo = true
        and not exists (
          select 1 from public.programacoes p
          where p.congregacao_id = v_convite.congregacao_id
            and p.tema_id = tp.tema_id
            and p.status not in ('Realizada', 'Cancelada', 'Arquivada')
        )
    ) else null end,
    'confirmacao_pendente', v_convite.status = 'Aceito' and not exists (
      select 1 from public.confirmacoes cf where cf.convite_id = v_convite.id
    )
  );

  return v_resultado;
end;
$$;

revoke execute on function public.consultar_convite_publico(uuid) from public;
grant execute on function public.consultar_convite_publico(uuid) to anon, authenticated;
```

**Regra de exclusividade de tema (Ponto 1 — "imagina 2 oradores em sequência com mesmo tema"):** um tema já usado por outra Programação **futura e não cancelada** da mesma congregação some da lista oferecida a um novo Orador respondendo, até essa Programação passar (ser realizada), ser cancelada ou arquivada. É uma decisão de projeto que estou tomando explicitamente aqui — não olha "proximidade de data", só "já está agendado e ainda não aconteceu". Se quiser uma janela diferente (ex.: só bloquear se for nas próximas N semanas), me avisa antes de eu rodar a migração.

```sql
create or replace function public.responder_convite_publico(
  p_token uuid,
  p_recusar boolean,
  p_data date default null,
  p_tema_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_convite record;
  v_programacao_id uuid;
begin
  select * into v_convite from public.convites where token = p_token for update;
  if v_convite.id is null or v_convite.status not in ('Criado', 'Enviado') then
    raise exception 'convite_invalido';
  end if;
  if v_convite.expira_em < now() then
    update public.convites set status = 'Expirado' where id = v_convite.id;
    raise exception 'convite_expirado';
  end if;

  if p_recusar then
    update public.convites set status = 'Recusado', respondido_em = now() where id = v_convite.id;
    insert into public.historicos (usuario_id, tipo, descricao, dados)
    values (null, 'convite_recusado', 'Convite recusado pelo orador', jsonb_build_object('convite_id', v_convite.id));
    return jsonb_build_object('status', 'Recusado');
  end if;

  if not exists (select 1 from public.convite_datas where convite_id = v_convite.id and data = p_data) then
    raise exception 'data_invalida';
  end if;
  if not exists (
    select 1 from public.temas_preparados tp
    where tp.orador_id = v_convite.orador_id and tp.tema_id = p_tema_id and tp.ativo = true
  ) then
    raise exception 'tema_invalido';
  end if;
  if exists (
    select 1 from public.programacoes p
    where p.congregacao_id = v_convite.congregacao_id and p.tema_id = p_tema_id
      and p.status not in ('Realizada', 'Cancelada', 'Arquivada')
  ) then
    raise exception 'tema_indisponivel';
  end if;

  insert into public.programacoes (congregacao_id, tema_id, orador_id, data, status, criado_por)
  values (v_convite.congregacao_id, p_tema_id, v_convite.orador_id, p_data, 'Convite Enviado',
          (select criado_por from public.convites where id = v_convite.id))
  returning id into v_programacao_id;

  update public.convites
  set status = 'Aceito', respondido_em = now(), programacao_id = v_programacao_id
  where id = v_convite.id;

  insert into public.historicos (programacao_id, usuario_id, tipo, descricao, dados)
  values (v_programacao_id, null, 'convite_aceito', 'Convite aceito pelo orador',
          jsonb_build_object('convite_id', v_convite.id, 'data', p_data, 'tema_id', p_tema_id));

  return jsonb_build_object('status', 'Aceito', 'programacao_id', v_programacao_id);
end;
$$;

revoke execute on function public.responder_convite_publico(uuid, boolean, date, uuid) from public;
grant execute on function public.responder_convite_publico(uuid, boolean, date, uuid) to anon, authenticated;
```

`criado_por` da Programação herda o `criado_por` do próprio Convite (quem da equipe criou o convite) — `programacoes.criado_por` é `not null`, e não existe usuário autenticado nesse fluxo pra atribuir.

```sql
create or replace function public.enviar_confirmacao_convite_publico(
  p_token uuid,
  p_cantico_inicial varchar,
  p_utilizara_imagens boolean,
  p_permanecera_ate_final boolean,
  p_observacoes text,
  p_anexos jsonb default '[]'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_convite record;
begin
  select * into v_convite from public.convites where token = p_token for update;
  if v_convite.id is null or v_convite.status <> 'Aceito' then
    raise exception 'convite_invalido';
  end if;
  if exists (select 1 from public.confirmacoes where convite_id = v_convite.id) then
    raise exception 'confirmacao_ja_enviada';
  end if;
  if not p_permanecera_ate_final then
    raise exception 'permanencia_obrigatoria';
  end if;

  insert into public.confirmacoes (convite_id, cantico_inicial, utilizara_imagens, permanecera_ate_final, observacoes, anexos)
  values (v_convite.id, p_cantico_inicial, p_utilizara_imagens, p_permanecera_ate_final, p_observacoes, p_anexos);

  insert into public.historicos (programacao_id, usuario_id, tipo, descricao, dados)
  values (v_convite.programacao_id, null, 'convite_confirmado', 'Confirmação enviada pelo orador',
          jsonb_build_object('convite_id', v_convite.id));
end;
$$;

revoke execute on function public.enviar_confirmacao_convite_publico(uuid, varchar, boolean, boolean, text, jsonb) from public;
grant execute on function public.enviar_confirmacao_convite_publico(uuid, varchar, boolean, boolean, text, jsonb) to anon, authenticated;
```

`p_permanecera_ate_final` obrigatoriamente `true` porque o UC-CONV-007 (passo 8) trata como confirmação necessária, não uma opção — não há "não vou ficar até o final" no fluxo oficial.

**Storage — anexos (RN-072).** Não existe nenhum bucket configurado no projeto ainda (primeiro uso de Storage no SIPD). Bucket novo `convite-anexos`, path `{token}/{nome_arquivo}`:

```sql
insert into storage.buckets (id, name, public) values ('convite-anexos', 'convite-anexos', false);

create policy convite_anexos_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'convite-anexos'
    and exists (
      select 1 from public.convites c
      where c.token::text = (storage.foldername(name))[1] and c.status = 'Aceito'
    )
  );

create policy convite_anexos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'convite-anexos'
    and exists (
      select 1 from public.convites c
      join public.programacoes p on p.id = c.programacao_id
      where c.token::text = (storage.foldername(name))[1]
        and (public.is_administrador_global() or p.congregacao_id = public.current_usuario_congregacao_id())
    )
  );
```

O upload acontece direto pro Storage (client-side, antes de chamar `enviar_confirmacao_convite_publico`); a RPC só recebe os caminhos já enviados, em `p_anexos`.

### Frontend

**Mudança de UX em relação ao UC original:** o gatilho documentado ("usuário acessa a Programação → Criar Convite") não se aplica mais — não existe Programação nesse ponto do fluxo (Achado 3). A entrada passa a ser uma **aba própria "Convites"**, mesmo padrão das demais.

**Nova aba "Convites"** em `app-tabs.tsx`/`app-tabs.web.tsx` — visível a todos os perfis (Leitor só consulta); botão "Novo Convite" só para Administrador Global/Coordenador/Editor.

**Rotas (pasta, mesmo padrão de Programações/Oradores):**

```
src/app/(app)/convites/
  index.tsx   — lista de convites da congregação (filtro por status)
  [id].tsx    — detalhe: datas candidatas, link (copiar), status, ações (Reenviar/Cancelar), resposta (data/tema escolhidos) e Confirmação quando existir
  novo.tsx    — orador + datas candidatas

src/app/convite/
  [token].tsx — tela pública, sem login (mesmo nível de aceitar-convite.tsx/login.tsx, fora do grupo (app))
```

**`convites/novo.tsx`:**
- Orador: `Dropdown` de busca (mesmo padrão de `oradores/novo.tsx`, `DropdownSearchInput`).
- Datas candidatas: reaproveita `CalendarioMensal` em um modo novo de seleção múltipla (`diasSelecionados: Set<string>` em vez de `diaSelecionado` único — cada toque adiciona/remove a data da seleção); datas escolhidas aparecem como chips removíveis abaixo da grade.
- Confirma → `insert` em `convites` (`status: 'Criado'`) + `insert` em `convite_datas` para cada data (a trigger de exclusividade barra na hora se alguma já estiver ofertada em outro convite aberto da congregação) + log `convite_criado`.
- Depois de criado, mostra o link (`https://.../convite/{token}`) com botão copiar, e ação "Enviar" (`status → 'Enviado'`, `enviado_em = now()`, log `convite_enviado` — UC-CONV-002). As RPCs públicas já aceitam convites em `'Criado'` ou `'Enviado'` igualmente, então o link tecnicamente responde antes desse clique — "Enviar" nesta fatia marca o momento em que a equipe efetivamente compartilhou o link (registro para o Histórico e para UC-CONV-002), não é um requisito técnico de acesso.

**`convites/[id].tsx`:**
- Dados: orador, datas candidatas, status, link com botão copiar.
- Se `status = 'Aceito'` sem confirmação: badge "Aceito — dados pendentes" (join com `confirmacoes`, sem coluna nova — exatamente o comportamento que você descreveu).
- Se confirmado: mostra cântico inicial, uso de imagens, observações, anexos (link de download via Storage), permanência confirmada.
- Ações: "Reenviar" (`UC-CONV-003` — visível se `status in ('Enviado','Expirado')`; estende `expira_em` mais 7 dias, `status → 'Enviado'`, log `convite_reenviado`) e "Cancelar" (visível se `status not in ('Recusado','Cancelado','Expirado')`; se já tem Programação vinculada, cancela a Programação também via a mesma lógica de `cancelar_programacao` já usada em Programações; `status → 'Cancelado'`, log `convite_cancelado`).
- Histórico: eventos via `dados->>'convite_id'` (antes de existir Programação) ou `programacao_id` direto (depois — mesma convenção mista já usada nesta spec e em Oradores/Temas).

**`convites/index.tsx`:** lista com filtro por status (`Criado`, `Enviado`, `Aceito`, `Recusado`, `Cancelado`, `Expirado`); toque navega para o detalhe.

**`convite/[token].tsx`** (pública, sem `useAuth`, chama as RPCs direto via `supabase.rpc(...)` — funciona sem sessão porque a chave anônima do cliente já basta, ver Achado 2):
- Ao carregar, chama `consultar_convite_publico(token)`.
- `status in ('Criado','Enviado')`: **Fase 1** — nome do orador/congregação (só leitura), lista de datas candidatas (seleção única) + lista de temas disponíveis (seleção única, já filtrados pela exclusividade), botão "Não posso nenhuma dessas datas" (recusa) e botão "Confirmar disponibilidade" → `responder_convite_publico`.
- Resposta de aceite bem-sucedida: mostra imediatamente a **Fase 2** (mesma tela, sem novo link) — cântico inicial, uso de imagens (sim/não), upload de anexos (opcional), observações, checkbox de permanência até o final (obrigatório) — com botão "Responder depois" (só sai da tela, nada é gravado; o link continua válido e volta a mostrar a Fase 2 da próxima vez, porque `status='Aceito'` e `confirmacao_pendente=true`).
- `status = 'Aceito'` e `confirmacao_pendente = true` (retorno numa visita posterior): mostra Fase 2 direto.
- `status = 'Aceito'` e `confirmacao_pendente = false`: tela de resumo "Confirmado, obrigado" (só leitura).
- `status = 'Recusado' | 'Cancelado' | 'Expirado'`: tela informativa correspondente.
- `convite_invalido` (token não existe): tela de erro genérica.

**Hooks novos:**
- `src/features/convites/use-convites.ts` — lado staff: `convites` (select com embeds `orador:oradores(...)`, `convite_datas(data)`, `confirmacoes(...)`), `criarConvite`, `enviarConvite`, `reenviarConvite`, `cancelarConvite`.
- `src/features/convites/use-convite-publico.ts` — lado público: `consultarConvite(token)`, `responderConvite(token, {...})`, `enviarConfirmacao(token, {...})`, `uploadAnexo(token, arquivo)` — chamando as RPCs diretamente, sem depender de `useAuth`.

## Tratamento de erros

| Caso | Origem | Mensagem apresentada |
|---|---|---|
| Data já ofertada em outro convite aberto da congregação | Trigger `data_ja_ofertada` | "Uma ou mais datas já estão em outro convite aberto." |
| Token inválido | RPC `convite_invalido` | "Este link de convite não é válido." |
| Convite expirado | RPC `convite_expirado` | "Este convite expirou. Peça à congregação um novo link." |
| Tema não pertence ao orador ou não está mais disponível | RPC `tema_invalido`/`tema_indisponivel` | "Este tema não está mais disponível. Escolha outro." |
| Confirmação enviada duas vezes | RPC `confirmacao_ja_enviada` | "A confirmação para este convite já foi enviada." |
| Não confirmou permanência até o final | RPC `permanencia_obrigatoria` | "É necessário confirmar que permanecerá até o final da reunião." |
| Falha genérica ao responder/confirmar | Exceção não classificada | "Não foi possível enviar sua resposta. Tente novamente." |
| Falha ao carregar convite público | Exceção não classificada | "Não foi possível carregar este convite." |

## Plano de verificação (manual)

Via `npm run web`:

1. Como Coordenador/Editor, criar um Convite com 3 datas candidatas para um Orador com temas preparados → convite fica "Criado", depois "Enviado"; link copiável.
2. Tentar criar um segundo convite (outro orador) reusando uma das 3 datas, mesma congregação → bloqueado pela trigger.
3. Abrir o link em aba anônima/sem login → Fase 1 aparece com as 3 datas e os temas preparados do orador.
4. Escolher "Não posso nenhuma dessas datas" → convite vira "Recusado"; as datas voltam a ficar disponíveis para um novo convite (repetir passo 2 com sucesso agora).
5. Em um novo convite, escolher uma data + tema → Programação é criada (`status: 'Convite Enviado'`), convite vira "Aceito", Fase 2 aparece na mesma tela.
6. Clicar "Responder depois" → sair e reabrir o mesmo link → Fase 2 aparece de novo (não perdeu o estado).
7. Como staff, ver o convite em `convites/[id]` com badge "Aceito — dados pendentes".
8. Preencher a Fase 2 (com 1 anexo) e enviar → Programação muda para "Confirmada" (trigger RN-073); convite mostra os dados da confirmação e o anexo pro staff.
9. Tentar acessar o mesmo link de novo → tela de resumo "Confirmado", sem formulário.
10. Criar um novo convite oferecendo o mesmo tema já usado no passo 5 (mesma congregação, Programação ainda não realizada) → tema não aparece na lista de temas disponíveis do novo orador.
11. Testar "Reenviar" num convite expirado (ajustar `expira_em` via SQL) → volta a responder normalmente.
12. Testar "Cancelar" antes e depois do aceite → nos dois casos, convite fica "Cancelado"; depois do aceite, a Programação vinculada também é cancelada.
13. Tentar chamar as RPCs públicas via SQL simulando `set local role anon` com um token errado/expirado → erro esperado (`convite_invalido`/`convite_expirado`), confirmando que a checagem interna funciona independente de `auth.uid()`.
14. Como Leitor, acessar Convites → só consulta, sem "Novo Convite"/"Reenviar"/"Cancelar".

## Documentação a atualizar

- `06.1.6 - Convites.md` tem as referências de RN erradas (RN-050/051/054 em vez de RN-060 a RN-064, ver "Contexto", Achado 1) — fica registrado aqui como pendência; corrigir o documento formal está fora do escopo desta fatia (mesma decisão das fatias anteriores).
- `13-ADR.md` — nova entrada **ADR-011** registrando a decisão de RPCs públicas liberadas para `anon` no fluxo de resposta ao Convite de Orador, contrastando com ADR-010 (que optou pelo oposto, exigir sessão, para o convite de usuário da congregação). A registrar quando a migração for aplicada.
- `08-DER.md`/`09-Dicionario-de-Dados.md` — `convites` ganha `congregacao_id`, `token`, `expira_em`, `programacao_id` passa a nullable; `confirmacoes` ganha `anexos`; nova tabela `convite_datas`. Atualizar quando a migração for aplicada.

## Arquivos afetados

**Novos:**
- `database/migrations/<timestamp>_convites_link_publico.sql`
- `src/features/convites/use-convites.ts`
- `src/features/convites/use-convite-publico.ts`
- `src/app/(app)/convites/index.tsx`
- `src/app/(app)/convites/[id].tsx`
- `src/app/(app)/convites/novo.tsx`
- `src/app/convite/[token].tsx`

**Modificados:**
- `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx` — nova aba "Convites".
- `src/components/calendario-mensal.tsx` — novo modo de seleção múltipla de datas.
