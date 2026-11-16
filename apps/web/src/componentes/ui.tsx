import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ErroDaApi } from '../api/cliente';
import { useToast } from './toast';

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';

interface PropsDoBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: Variante;
  readonly pequeno?: boolean;
  /** Ícone à esquerda do texto. */
  readonly icone?: ReactNode;
  /** Mostra o indicador de carregamento e desabilita o botão. */
  readonly carregando?: boolean;
}

/**
 * Botão. Hierarquia: UM primário por área (a ação principal), secundário para as demais, fantasma
 * para ações discretas e perigo só para o que destrói ou cancela.
 */
export function Botao({
  variante = 'primario',
  pequeno,
  icone,
  carregando,
  className,
  type = 'button',
  disabled,
  children,
  ...resto
}: PropsDoBotao) {
  const classes = [
    'botao',
    variante === 'secundario' && 'botao--secundario',
    variante === 'perigo' && 'botao--perigo',
    variante === 'fantasma' && 'botao--fantasma',
    pequeno && 'botao--pequeno',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando ? <span className="botao__giro" aria-hidden="true" /> : (icone ?? null)}
      {children}
    </button>
  );
}

interface PropsDoCampo {
  readonly rotulo: string;
  readonly ajuda?: string;
  readonly erro?: string;
  /** Marca o campo como obrigatório (o asterisco é só visual; o campo leva `required`). */
  readonly obrigatorio?: boolean;
  readonly children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }) => ReactNode;
}

/** Rótulo, ajuda e erro ligados ao controle por ids (leitores de tela leem tudo junto). */
export function Campo({ rotulo, ajuda, erro, obrigatorio, children }: PropsDoCampo) {
  const id = useId();
  const idDaAjuda = `${id}-ajuda`;
  const idDoErro = `${id}-erro`;
  const descricao = [ajuda ? idDaAjuda : '', erro ? idDoErro : ''].filter(Boolean).join(' ');
  return (
    <div className="campo">
      <label
        className={`campo__rotulo${obrigatorio ? ' campo__rotulo--obrigatorio' : ''}`}
        htmlFor={id}
      >
        {rotulo}
      </label>
      {children({
        id,
        ...(descricao ? { 'aria-describedby': descricao } : {}),
        ...(erro ? { 'aria-invalid': true } : {}),
      })}
      {ajuda ? (
        <span id={idDaAjuda} className="campo__ajuda">
          {ajuda}
        </span>
      ) : null}
      {erro ? (
        <span id={idDoErro} className="campo__erro">
          {erro}
        </span>
      ) : null}
    </div>
  );
}

type TipoDeAviso = 'erro' | 'sucesso' | 'atencao' | 'info';

const prefixoDoAviso: Record<TipoDeAviso, string> = {
  erro: 'Erro:',
  sucesso: 'Pronto:',
  atencao: 'Atenção:',
  info: 'Informação:',
};

const iconeDoAviso: Record<TipoDeAviso, ReactNode> = {
  erro: <XCircle size={18} />,
  sucesso: <CheckCircle2 size={18} />,
  atencao: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

/** O aviso nunca depende só de cor: sempre começa com uma palavra que diz o que é, e tem ícone. */
export function Aviso({
  tipo,
  titulo,
  children,
}: {
  tipo: TipoDeAviso;
  titulo?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`aviso aviso--${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <span className="aviso__icone" aria-hidden="true">
        {iconeDoAviso[tipo]}
      </span>
      <div className="aviso__corpo">
        <span className="aviso__titulo">
          {prefixoDoAviso[tipo]} {titulo}
        </span>
        {children ? <div className="aviso__texto">{children}</div> : null}
      </div>
    </div>
  );
}

/** Mostra o erro de uma chamada à API, com os detalhes que o usuário pode corrigir. */
export function AvisoDeErro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const mensagem =
    erro instanceof ErroDaApi ? erro.message : 'Não foi possível concluir a operação.';
  const detalhes = erro instanceof ErroDaApi ? erro.detalhes : undefined;
  return (
    <Aviso tipo="erro" titulo={mensagem}>
      {detalhes && detalhes.length > 0 ? (
        <ul>
          {detalhes.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
    </Aviso>
  );
}

export type TomDoSelo = 'neutro' | 'sucesso' | 'atencao' | 'perigo' | 'info' | 'primario';

/**
 * Selo de situação. O texto diz a situação; o tom e o ponto só reforçam (nunca dependem só de cor).
 * `tipo` é o jeito antigo: 'ativo' vale 'sucesso' e 'inativo' vale 'neutro'.
 */
export function Selo({
  tom,
  tipo,
  ponto,
  pequeno,
  solido,
  children,
}: {
  tom?: TomDoSelo;
  tipo?: 'ativo' | 'inativo';
  ponto?: boolean;
  pequeno?: boolean;
  /** Preenchido (a prioridade mais alta nos cartões do quadro). */
  solido?: boolean;
  children: ReactNode;
}) {
  const efetivo: TomDoSelo = tom ?? (tipo === 'ativo' ? 'sucesso' : 'neutro');
  return (
    <span
      className={`selo selo--${efetivo}${pequeno ? ' selo--pequeno' : ''}${solido ? ' selo--solido' : ''}`}
    >
      {ponto ? <span className="selo__ponto" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <p className="carregando" role="status">
      {texto}
    </p>
  );
}

/** A senha inicial aparece uma única vez; depois disso só uma nova redefinição gera outra. */
export function SenhaInicial({
  senha,
  validaAte,
  onFechar,
}: {
  senha: string;
  validaAte: string;
  onFechar: () => void;
}) {
  const avisar = useToast();
  return (
    <Aviso tipo="atencao" titulo="Anote a senha inicial agora">
      <p>
        Ela é mostrada <strong>uma única vez</strong>, vale até{' '}
        {new Date(validaAte).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} e deve ser
        trocada no primeiro acesso.
      </p>
      <code className="senha-inicial">{senha}</code>
      <div className="acoes">
        <Botao
          pequeno
          variante="secundario"
          onClick={() => {
            void navigator.clipboard?.writeText(senha);
            avisar({ tom: 'sucesso', titulo: 'Senha copiada' });
          }}
        >
          Copiar senha
        </Botao>
        <Botao pequeno variante="secundario" onClick={onFechar}>
          Já anotei, fechar
        </Botao>
      </div>
    </Aviso>
  );
}
