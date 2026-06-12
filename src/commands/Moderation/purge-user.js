import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { checkRateLimit } from '../../utils/rateLimiter.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const FETCH_LIMIT = 100; // max messages discord allows fetching per request
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export default {
    data: new SlashCommandBuilder()
        .setName("purge-user")
        .setDescription("Delete a specific user's recent messages from this channel")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The user whose messages should be deleted")
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("Number of that user's messages to delete (1-100)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(FETCH_LIMIT),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Purge-user interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'purge-user'
            });
            return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Permission Denied",
                        "You need the `Manage Messages` permission to purge messages.",
                    ),
                ],
            });
        }

        const target = interaction.options.getUser("target");
        const amount = interaction.options.getInteger("amount");
        const channel = interaction.channel;

        try {
            const rateLimitKey = `purgeuser_${interaction.user.id}`;
            const isAllowed = await checkRateLimit(rateLimitKey, 5, 60000);
            if (!isAllowed) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        warningEmbed(
                            "You're purging messages too fast. Please wait a minute before trying again.",
                            "⏳ Rate Limited"
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const collected = [];
            let lastId;
            const cutoff = Date.now() - TWO_WEEKS_MS;

            while (collected.length < amount) {
                const options = { limit: FETCH_LIMIT };
                if (lastId) options.before = lastId;

                const batch = await channel.messages.fetch(options);
                if (batch.size === 0) break;

                for (const message of batch.values()) {
                    if (message.createdTimestamp < cutoff) {
                        lastId = null;
                        break;
                    }
                    if (message.author.id === target.id) {
                        collected.push(message);
                        if (collected.length >= amount) break;
                    }
                    lastId = message.id;
                }

                if (!lastId) break;
                if (batch.size < FETCH_LIMIT) break;
            }

            if (collected.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "No Messages Found",
                            `No recent messages from ${target.tag} were found in ${channel} (messages older than 14 days cannot be bulk deleted).`,
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const deleted = await channel.bulkDelete(collected, true);
            const deletedCount = deleted.size;

            const purgeEmbed = createEmbed(
                "🗑️ User Messages Purged (Action Log)",
                `${deletedCount} messages from ${target} were deleted by ${interaction.user}.`,
            )
                .setColor(getColor('moderation'))
                .addFields(
                    { name: "Channel", value: channel.toString(), inline: true },
                    { name: "Target", value: `${target.tag} (${target.id})`, inline: true },
                    {
                        name: "Moderator",
                        value: `${interaction.user.tag} (${interaction.user.id})`,
                        inline: true,
                    },
                    { name: "Count", value: `${deletedCount} messages`, inline: false },
                );

            await logEvent({
                client,
                guild: interaction.guild,
                event: {
                    action: "User Messages Purged",
                    target: `${target.tag} (${target.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `Deleted ${deletedCount} messages from ${channel}`,
                    metadata: {
                        channelId: channel.id,
                        userId: target.id,
                        messageCount: deletedCount,
                        requestedAmount: amount,
                        moderatorId: interaction.user.id
                    }
                }
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(`🗑️ Deleted ${deletedCount} message(s) from ${target.tag} in ${channel}.`),
                ],
                flags: MessageFlags.Ephemeral,
            });

            setTimeout(() => {
                interaction.deleteReply().catch(err =>
                    logger.debug('Failed to auto-delete purge-user response:', err)
                );
            }, 3000);
        } catch (error) {
            logger.error('Purge-user command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "An unexpected error occurred during message deletion. Note: Messages older than 14 days cannot be bulk deleted.",
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }
    }
};
