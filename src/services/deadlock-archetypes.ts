/**
 * Hero archetype classification.
 *
 * Mirrored from the Deadlock Hub (Amber Almanac) so the bot uses the same
 * opinionated taxonomy the website does. Keep in sync if the Hub revises
 * its mapping.
 *
 * Source: deadlockhub/lib/data/hero-archetypes.ts
 */
export type HeroArchetype = 'carry' | 'tank' | 'burst' | 'support' | 'flex';

export const ARCHETYPE_LABELS: Record<HeroArchetype, string> = {
  carry: 'Carry',
  tank: 'Tank',
  burst: 'Burst',
  support: 'Support',
  flex: 'Flex',
};

export const ARCHETYPE_DESCRIPTIONS: Record<HeroArchetype, string> = {
  carry: 'Right-click damage, scales with souls, late-game backbone.',
  tank: 'Frontline initiator, high HP, soaks damage for the team.',
  burst: 'Spirit / ability damage, finds picks, snowballs early.',
  support: 'Utility, healing, area denial, enables the carry.',
  flex: "Doesn't slot neatly into a single role.",
};

const ARCHETYPE_BY_NAME: Record<string, HeroArchetype> = {
  // Carry
  Haze: 'carry',
  Vindicta: 'carry',
  Infernus: 'carry',
  Mirage: 'carry',
  'Grey Talon': 'carry',
  Talon: 'carry',
  Holliday: 'carry',
  Mo: 'carry',
  Seven: 'carry',

  // Tank
  Abrams: 'tank',
  Bebop: 'tank',
  'Mo & Krill': 'tank',
  Pocket: 'tank',

  // Burst
  Wraith: 'burst',
  Lash: 'burst',
  Paradox: 'burst',
  Calico: 'burst',
  Sinclair: 'burst',
  Magician: 'burst',
  Warden: 'burst',

  // Support
  Kelvin: 'support',
  McGinnis: 'support',
  Ivy: 'support',
  Viscous: 'support',
  Yamato: 'support',
  Dynamo: 'support',
  Trapper: 'support',
};

export function archetypeForHero(heroName: string): HeroArchetype {
  return ARCHETYPE_BY_NAME[heroName] ?? 'flex';
}
