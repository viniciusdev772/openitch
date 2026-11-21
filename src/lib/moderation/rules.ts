/*
 * Regras da comunidade: a mesma lista vira a página /termos e as perguntas
 * feitas aos modelos de decisão. Mudar uma regra aqui muda as duas coisas.
 */

export type RuleId =
  | "menores"
  | "ilegal"
  | "malware"
  | "sexual"
  | "odio"
  | "assedio"
  | "violencia-real"
  | "golpe"
  | "direitos";

export interface Rule {
  id: RuleId;
  title: string;
  /** Texto da regra para pessoas (página de termos, formulário de denúncia). */
  text: string;
  /** Critério para o modelo: o que conta como quebrar esta regra. */
  criteria: string;
  /** Quebrar esta regra de forma clara fecha a conta na primeira vez. */
  zeroTolerance?: true;
}

export const RULES: Rule[] = [
  {
    id: "menores",
    title: "Nada que sexualize menores",
    text: "Qualquer conteúdo que sexualize crianças ou adolescentes, real, desenhado ou gerado por IA. A conta é fechada na hora e o caso pode ser levado às autoridades.",
    criteria: "Sexualizes minors in any form (real, drawn, AI-generated), or depicts or promotes child sexual abuse.",
    zeroTolerance: true,
  },
  {
    id: "malware",
    title: "Nada de vírus ou programa malicioso",
    text: "Arquivos que roubam dados, mineram criptomoeda, instalam outros programas sem avisar ou danificam o computador de quem joga.",
    criteria: "Distributes or promotes malware, spyware, cryptominers, account stealers, cheats that steal data, or any software that harms the player's device or data.",
    zeroTolerance: true,
  },
  {
    id: "ilegal",
    title: "Nada ilegal no Brasil",
    text: "Venda ou incentivo ao tráfico de drogas e de armas, apologia ao terrorismo, ou qualquer outro crime pela lei brasileira.",
    criteria: "Promotes or facilitates crimes under Brazilian law: drug or weapon trafficking, terrorism, human trafficking, or other clearly illegal activity. Fictional crime inside a game's story is NOT a violation.",
  },
  {
    id: "sexual",
    title: "Nada de sexo explícito",
    text: "O programa ainda não confere a idade de quem joga, então nudez com sexo explícito não pode. Temas adultos tratados sem cenas explícitas podem, com aviso de conteúdo.",
    criteria: "Contains explicit sexual content or pornographic imagery. Mature themes, romance, or non-explicit nudity with a content note are NOT violations.",
  },
  {
    id: "odio",
    title: "Nada de discurso de ódio",
    text: "Atacar, desumanizar ou incitar violência contra pessoas por raça, cor, etnia, religião, origem, gênero, orientação sexual, deficiência ou idade.",
    criteria: "Attacks, dehumanizes, or incites violence or discrimination against people based on race, ethnicity, religion, national origin, gender, sexual orientation, disability, or age. A game that depicts prejudice critically is NOT a violation.",
  },
  {
    id: "assedio",
    title: "Nada de assédio ou exposição de pessoas",
    text: "Ameaçar, perseguir ou humilhar uma pessoa real, ou publicar dados pessoais dela (endereço, telefone, documentos) sem permissão.",
    criteria: "Threatens, harasses, or humiliates a real, identifiable person, or exposes private personal data (address, phone, documents) without consent.",
  },
  {
    id: "violencia-real",
    title: "Nada de violência real",
    text: "Imagens ou vídeos de violência real, mutilação ou morte, ou material que glorifique ataques reais. Violência de ficção, dentro do jogo, pode.",
    criteria: "Shows real-world gore, death, or mutilation, or glorifies real attacks or their perpetrators. Fictional or cartoon violence is NOT a violation.",
  },
  {
    id: "golpe",
    title: "Nada de golpe, spam ou se passar por outra pessoa",
    text: "Página que promete o que não entrega para tirar dinheiro ou dados, links para phishing, propaganda repetida sem jogo, ou fingir ser outra pessoa ou empresa.",
    criteria: "Is a scam, phishing, fake giveaway, or spam (advertising with no actual game), or impersonates another person, studio, or company.",
  },
  {
    id: "direitos",
    title: "Só publique o que é seu",
    text: "Publicar o jogo de outra pessoa sem permissão, ou usar marca, personagem ou música protegidos sem licença. Quem cria pode pedir a remoção por uma denúncia com detalhes.",
    criteria: "Republishes someone else's game without permission, or clearly uses copyrighted or trademarked material (characters, logos, music, assets) without a license. Fan works that are clearly credited and non-commercial, or assets under free licenses (CC0, CC-BY with credit), are NOT violations.",
  },
];

export const RULE_IDS = new Set<string>(RULES.map((r) => r.id));
export const ruleById = (id: string): Rule | undefined => RULES.find((r) => r.id === id);
