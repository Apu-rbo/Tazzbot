import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';

const durationChoices = [
    { name: "10 minutes", value: 10 * 60 * 1000 },
    { name: "1 hour", value: 60 * 60 * 1000 },
    { name: "6 hours", value: 6 * 60 * 60 * 1000 },
    { name: "12 hours", value: 12 * 60 * 60 * 1000 },
    { name: "1 day", value: 24 * 60 * 60 * 1000 },
    { name: "3 days", value: 3 * 24 * 60 * 60 * 1000 },
    { name: "1 week", value: 7 * 24 * 60 * 60 * 1000 },
    { name: "1 month", value: 30 * 24 * 60 * 60 * 1000 },
];

export default {
    data: new SlashCommandBuilder()
        .setName("tempban")
        .setDescription("Temporarily ban a user; they are automatically unbanned after the duration expires.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The user to temporarily ban")
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("duration")
                .setDescription("How long the ban should last")
                .setRequired(true)
                .addChoices(...durationChoices),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Reason for the ban"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Tempban interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'tempban'
            });
            return;
        }

        try {
            const user = interaction.options.getUser("target");
            const durationMs = interaction.options.getInteger("duration");
            const reason = interaction.options.getString("reason") || "No reason provided";

            if (user.id === interaction.user.id) {
                throw new TitanBotError(
                    "Cannot tempban self",
                    ErrorTypes.VALIDATION,
                    "You cannot tempban yourself."
                );
            }
            if (user.id === client.user.id) {
                throw new TitanBotError(
                    "Cannot tempban bot",
                    ErrorTypes.VALIDATION,
                    "You cannot tempban the bot."
                );
            }

            const result = await ModerationService.tempbanUser({
                client,
                guild: interaction.guild,
                user,
                moderator: interaction.member,
                durationMs,
                reason
            });

            const durationDisplay =
                durationChoices.find((c) => c.value === durationMs)?.name || `${Math.round(durationMs / 60000)} minutes`;

            const unbanTimestamp = Math.floor(result.expiresAt / 1000);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        `⏱️ **Temp-banned** ${user.tag}`,
                        `**Duration:** ${durationDisplay}\n**Auto-unban:** <t:${unbanTimestamp}:R>\n**Reason:** ${reason}\n**Case ID:** #${result.caseId}`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Tempban command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        error.userMessage || "An unexpected error occurred while temp-banning this user. Please check my role permissions.",
                    ),
                ],
            });
        }
    },
};
