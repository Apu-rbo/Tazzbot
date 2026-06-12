import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from 'discord.js';

import {
  successEmbed,
  infoEmbed
} from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Manage Anti-Nuke system')

    .addSubcommand(sub =>
      sub
        .setName('enable')
        .setDescription('Enable Anti-Nuke')
    )

    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable Anti-Nuke')
    )

    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View Anti-Nuke configuration')
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  category: 'moderation',

  async execute(interaction, config, client) {

    const sub =
      interaction.options.getSubcommand();

    const key =
      `antinuke:${interaction.guild.id}`;

    let data =
      await client.db.get(key);

    if (!data) {
      data = {
        enabled: false,
        punishment: 'removeroles',
        thresholds: {
          channelDelete: 3,
          roleDelete: 3,
          roleCreate: 5
        },
        whitelist: [],
        logChannel: null
      };
    }

    if (sub === 'enable') {

      data.enabled = true;

      await client.db.set(
        key,
        data
      );

      return interaction.reply({
        embeds: [
          successEmbed(
            '🛡 Anti-Nuke Enabled',
            'Anti-Nuke protection is now enabled.'
          )
        ]
      });
    }

    if (sub === 'disable') {

      data.enabled = false;

      await client.db.set(
        key,
        data
      );

      return interaction.reply({
        embeds: [
          successEmbed(
            '❌ Anti-Nuke Disabled',
            'Anti-Nuke protection is now disabled.'
          )
        ]
      });
    }

    if (sub === 'status') {

      return interaction.reply({
        embeds: [
          infoEmbed(
            '🛡 Anti-Nuke Status',
            `**Enabled:** ${data.enabled ? 'Yes' : 'No'}

**Punishment:** ${data.punishment}

**Channel Delete Limit:** ${data.thresholds.channelDelete}

**Role Delete Limit:** ${data.thresholds.roleDelete}

**Role Create Limit:** ${data.thresholds.roleCreate}

**Whitelist Users:** ${data.whitelist.length}`
          )
        ]
      });
    }
  }
};import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from 'discord.js';

import { successEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure anti-nuke')
    .addSubcommand(sub =>
      sub
        .setName('enable')
        .setDescription('Enable anti-nuke')
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable anti-nuke')
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  category: 'moderation',

  async execute(interaction, config, client) {
    const sub = interaction.options.getSubcommand();

    const key = `antinuke:${interaction.guild.id}`;

    if (sub === 'enable') {
      await client.db.set(key, true);

      return interaction.reply({
        embeds: [
          successEmbed(
            'Anti-Nuke Enabled',
            'Anti-nuke protection is now enabled.'
          )
        ]
      });
    }

    if (sub === 'disable') {
      await client.db.set(key, false);

      return interaction.reply({
        embeds: [
          successEmbed(
            'Anti-Nuke Disabled',
            'Anti-nuke protection is now disabled.'
          )
        ]
      });
    }
  }
};
