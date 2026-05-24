import { EmbedBuilder } from 'discord.js';

const COLORS = {
  PRIMARY: 0xe8713a,
  SUCCESS: 0x57f287,
  ERROR: 0xed4245,
  WARNING: 0xfee75c,
  INFO: 0x5865f2,
} as const;

export function createEmbed() {
  return new EmbedBuilder().setColor(COLORS.PRIMARY).setTimestamp();
}

export function successEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setDescription(description)
    .setTimestamp();
}

export function errorEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setDescription(description)
    .setTimestamp();
}

export function infoEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setDescription(description)
    .setTimestamp();
}
