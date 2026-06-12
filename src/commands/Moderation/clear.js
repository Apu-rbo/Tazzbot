import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const MAX_BULK_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export default {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete a number of messages from the current channel (Admin/Mod only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Number of messages to delete (1 – 100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('Only delete messages from this user (optional)')
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel to clear (defaults to current channel)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const amount     = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('target');
        const targetCh   = interaction.options.getChannel('channel') ?? interaction.channel;

        if (!targetCh.isTextBased()) {
            return interaction.reply({
                content: '❌ That channel is not a text channel.',
                ephemeral: true,
            });
        }

        const botMember = interaction.guild.members.me;
        const needed = [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory];
        if (!needed.every(p => targetCh.permissionsFor(botMember).has(p))) {
            return interaction.reply({
                content: `❌ I need **Manage Messages** and **Read Message History** permissions in ${targetCh}.`,
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            let deleted = 0;

            if (targetUser) {
                let collected = [];
                let lastId = undefined;

                outerLoop: while (collected.length < amount) {
                    const fetchOptions = { limit: 100 };
                    if (lastId) fetchOptions.before = lastId;

                    const fetched = await targetCh.messages.fetch(fetchOptions);
                    if (fetched.size === 0) break;

                    const now = Date.now();
                    for (const [, msg] of fetched) {
                        if (now - msg.createdTimestamp > MAX_BULK_AGE_MS) break outerLoop;
                        if (msg.author.id === targetUser.id) {
                            collected.push(msg);
                            if (collected.length >= amount) break;
                        }
                    }
                    lastId = fetched.last()?.id;
                }

                if (collected.length === 0) {
                    return interaction.editReply(`❌ No recent messages from **${targetUser.tag}** found in ${targetCh}.`);
                }

                if (collected.length === 1) {
                    await collected[0].delete();
                    deleted = 1;
                } else {
                    const result = await targetCh.bulkDelete(collected, true);
                    deleted = result.size;
                }
            } else {
                const result = await targetCh.bulkDelete(amount, true);
                deleted = result.size;
            }

            const skipped = amount - deleted;
            let reply = `✅ Deleted **${deleted}** message${deleted !== 1 ? 's' : ''} in ${targetCh}.`;
            if (skipped > 0) {
                reply += `\n⚠️ ${skipped} message${skipped !== 1 ? 's were' : ' was'} skipped (older than 14 days — Discord limitation).`;
            }
            if (targetUser) {
                reply += `\n👤 Filtered to messages from **${targetUser.tag}**.`;
            }

            return interaction.editReply(reply);

        } catch (err) {
            console.error('[Clear] Error deleting messages:', err);
            return interaction.editReply(`❌ An error occurred: ${err.message}`);
        }
    },
};
