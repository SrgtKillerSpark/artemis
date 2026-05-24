import { ChatInputCommandInteraction, Collection } from 'discord.js';

export interface Command {
  data: {
    name: string;
    description: string;
    toJSON(): unknown;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}
