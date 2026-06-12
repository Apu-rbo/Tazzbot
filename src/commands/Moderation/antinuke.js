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

    .addSubcommand(s =>
      s.setName('enable')
        .setDescription('Enable Anti-Nuke')
    )

    .addSubcommand(s =>
      s.setName('disable')
        .setDescription('Disable Anti-Nuke')
    )

    .addSubcommand(s =>
      s.setName('status')
        .setDescription('View Anti-Nuke status')
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  category: 'moderation',

  async execute(interaction, config, client) {
    try {
      const sub = interaction.options.getSubcommand();
      const key = `antinuke:${interaction.guild.id}`;

      let data = await client.db.get(key);

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
        await client.db.set(key, data);

        return interaction.reply({
          embeds: [
            successEmbed('Anti-Nuke Enabled')
          ]
        });
      }

      if (sub === 'disable') {
        data.enabled = false;
        await client.db.set(key, data);

        return interaction.reply({
          embeds: [
            successEmbed('Anti-Nuke Disabled')
          ]
        });
      }

      if (sub === 'status') {
        return interaction.reply({
          embeds: [
            infoEmbed(
`Enabled: ${data.enabled ? 'Yes' : 'No'}
Punishment: ${data.punishment}

ChannelDelete: ${data.thresholds.channelDelete}
RoleDelete: ${data.thresholds.roleDelete}
RoleCreate: ${data.thresholds.roleCreate}

Whitelist: ${data.whitelist.length}`
            )
          ]
        });
      }

    } catch (err) {
      console.error('antinuke error:', err);

      return interaction.reply({
        content: 'Error loading Anti-Nuke command.',
        ephemeral: true
      });
    }
  }
};
