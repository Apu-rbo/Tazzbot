import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const MAX_SLOWMODE_SECONDS = 21600; // Discord's hard limit (6 hours)

export default {
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Set or clear the slowmode (rate limit) for a channel.")
        .addIntegerOption((option) =>
            option
                .setName("seconds")
                .setDescription("Seconds between messages (0 to disable, max 21600)")
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(MAX_SLOWMODE_SECONDS),
        )
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("The channel to update (defaults to this channel)")
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement,
                    ChannelType.GuildVoice,
                    ChannelType.GuildForum,
                ),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Slowmode interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'slowmode'
            });
            return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Permission Denied",
                        "You need the `Manage Channels` permission to set slowmode.",
                    ),
                ],
            });
        }

        const seconds = interaction.options.getInteger("seconds");
        const channel = interaction.options.getChannel("channel") || interaction.channel;

        if (typeof channel.setRateLimitPerUser !== "function") {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Unsupported Channel",
                        `Slowmode cannot be set on ${channel}.`,
                    ),
                ],
            });
        }

        try {
            await channel.setRateLimitPerUser(
                seconds,
                `Slowmode updated by ${interaction.user.tag}`,
            );

            const description = seconds === 0
                ? `Slowmode has been **disabled** for ${channel}.`
                : `Slowmode for ${channel} is now **${formatDuration(seconds)}**.`;

            await logEvent({
                client,
                guild: interaction.guild,
                event: {
                    action: "Slowmode Updated",
                    target: channel.toString(),
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    metadata: {
                        channelId: channel.id,
                        seconds,
                        moderatorId: interaction.user.id,
                    },
                },
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        description,
                        seconds === 0 ? `🐇 Slowmode Disabled` : `🐌 Slowmode Updated`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Slowmode command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "An unexpected error occurred while updating slowmode. Check my permissions ('Manage Channels').",
                    ),
                ],
            });
        }
    },
};

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remSeconds = seconds % 60;
        return remSeconds === 0
            ? `${minutes} minute${minutes === 1 ? "" : "s"}`
            : `${minutes}m ${remSeconds}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const remMinutes = Math.floor((seconds % 3600) / 60);
    return remMinutes === 0
        ? `${hours} hour${hours === 1 ? "" : "s"}`
        : `${hours}h ${remMinutes}m`;
}
