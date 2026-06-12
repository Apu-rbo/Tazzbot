import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("lockdown")
        .setDescription("Lock or unlock multiple channels at once (use during raids).")
        .addStringOption((option) =>
            option
                .setName("action")
                .setDescription("Whether to lock or unlock the channels")
                .setRequired(true)
                .addChoices(
                    { name: "Lock", value: "lock" },
                    { name: "Unlock", value: "unlock" },
                ),
        )
        .addStringOption((option) =>
            option
                .setName("scope")
                .setDescription("Lock just this channel or every text channel in the server")
                .setRequired(true)
                .addChoices(
                    { name: "This channel", value: "channel" },
                    { name: "Entire server", value: "server" },
                ),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Lockdown interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'lockdown'
            });
            return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Permission Denied",
                        "You need the `Manage Channels` permission to use lockdown.",
                    ),
                ],
            });
        }

        const action = interaction.options.getString("action");
        const scope = interaction.options.getString("scope");
        const lock = action === "lock";
        const everyoneRole = interaction.guild.roles.everyone;

        const targetChannels = scope === "server"
            ? interaction.guild.channels.cache.filter((ch) =>
                [
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement,
                    ChannelType.GuildForum,
                ].includes(ch.type)
                  && ch.permissionsFor(everyoneRole)?.has(PermissionFlagsBits.ViewChannel),
              )
            : new Map([[interaction.channel.id, interaction.channel]]);

        if (targetChannels.size === 0) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "No Channels Found",
                        "No eligible text channels were found for this action.",
                    ),
                ],
            });
        }

        const succeeded = [];
        const failed = [];

        for (const channel of targetChannels.values()) {
            try {
                const currentPermissions = channel.permissionsFor(everyoneRole);
                const currentlyAllowed = currentPermissions?.has(PermissionFlagsBits.SendMessages);

                if (lock && currentlyAllowed === false) {
                    succeeded.push(channel);
                    continue;
                }
                if (!lock && currentlyAllowed !== false) {
                    succeeded.push(channel);
                    continue;
                }

                await channel.permissionOverwrites.edit(
                    everyoneRole,
                    { SendMessages: lock ? false : true },
                    {
                        type: 0,
                        reason: `Server ${lock ? "lockdown" : "lockdown lift"} initiated by ${interaction.user.tag}`,
                    },
                );

                succeeded.push(channel);
            } catch (error) {
                logger.warn(`Lockdown ${lock ? "lock" : "unlock"} failed for channel ${channel.id}:`, error.message);
                failed.push(channel);
            }
        }

        const verb = lock ? "Locked" : "Unlocked";
        const emoji = lock ? "🔒" : "🔓";

        const summaryEmbed = createEmbed(
            `${emoji} Server ${lock ? "Lockdown" : "Lockdown Lifted"} (Action Log)`,
            scope === "server"
                ? `${verb} ${succeeded.length} channel(s) by ${interaction.user}.`
                : `${interaction.channel} has been ${verb.toLowerCase()} by ${interaction.user}.`,
        )
            .setColor(getColor(lock ? "moderation" : "success"))
            .addFields(
                { name: "Scope", value: scope === "server" ? "Entire Server" : "This Channel", inline: true },
                {
                    name: "Moderator",
                    value: `${interaction.user.tag} (${interaction.user.id})`,
                    inline: true,
                },
                { name: "Channels Affected", value: `${succeeded.length}`, inline: true },
            );

        if (failed.length > 0) {
            summaryEmbed.addFields({
                name: "Failed",
                value: failed.map((ch) => ch.toString()).join(", ") || "None",
                inline: false,
            });
        }

        await logEvent({
            client,
            guild: interaction.guild,
            event: {
                action: lock ? "Server Lockdown" : "Server Lockdown Lifted",
                target: scope === "server" ? "Entire Server" : interaction.channel.toString(),
                executor: `${interaction.user.tag} (${interaction.user.id})`,
                metadata: {
                    scope,
                    channelsAffected: succeeded.map((ch) => ch.id),
                    channelsFailed: failed.map((ch) => ch.id),
                    moderatorId: interaction.user.id,
                },
            },
        });

        const description = scope === "server"
            ? `${emoji} **${verb}** ${succeeded.length} channel(s)${failed.length > 0 ? ` (${failed.length} failed)` : ""}.`
            : `${emoji} ${interaction.channel} is now **${lock ? "locked down" : "unlocked"}**.`;

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(description)],
        });
    }
};
