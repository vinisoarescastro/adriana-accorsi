// O segredo do link mora no pacote do banco, porque o worker também o decifra para montar o e-mail.
export {
  cifrarSegredoDeLink,
  decifrarSegredoDeLink,
  gerarSegredoDeLink,
  hashDoSegredoDeLink,
  montarLinkDeAcompanhamento,
} from '@gabinete/banco';
