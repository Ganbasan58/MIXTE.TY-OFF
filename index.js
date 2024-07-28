const fs = require('fs');
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Partials, ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const { Guilds, GuildMembers, GuildMessages, DirectMessages, MessageContent, GuildVoiceStates, GuildModeration, GuildMessageReactions } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember, Channel } = Partials;

const client = new Client({
    intents: [
        Guilds,
        GuildMembers,
        GuildMessages,
        DirectMessages,
        MessageContent,
        GuildVoiceStates,
        GuildModeration,
        GuildMessageReactions
    ],
    partials: [User, Message, GuildMember, ThreadMember, Channel]
});

// Définir les identifiants nécessaires
const minorRoleId = '1267138418098438220';
const alertChannelId = '1267138420069634080';
const verifierRoleId = '1267138418111025177';
const ticketCategoryID = '1267138420220760141';
const logsChannelId = '1267138420220760140';

let ticketInProgress = {}; // Utiliser un objet pour stocker les tickets en cours
let ticketChannel = {}; // Utiliser un objet pour stocker les salons de tickets

const getGreetingMessage = (user) => {
    const now = new Date();
    const hour = now.getHours();
    const userMention = `<@${user.id}>`; // Assurez-vous que user.id est défini ici

    if (hour >= 6 && hour < 19) {
        return `Bonjour, quel est votre âge et date de naissance s'il vous plaît ? ${userMention}`;
    } else {
        return `Bonsoir, quel est votre âge et date de naissance s'il vous plaît ? ${userMention}`;
    }
};

client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (!oldMember.roles.cache.has(minorRoleId) && newMember.roles.cache.has(minorRoleId)) {
        const member = newMember;
        const verifierRole = member.guild.roles.cache.get(verifierRoleId);

        if (!verifierRole) {
            console.error('Le rôle vérificateur n\'a pas été trouvé');
            return;
        }

        const alertEmbed = new EmbedBuilder()
            .setTitle('⚠️ ALERTE MINEUR ⚠️')
            .setDescription(`${member} a pris le rôle mineur !`)
            .addFields(
                { name: 'Réactions', value: '🟠 : En cours de traitement\n✅ : Définir comme traitée\n👼 : Ouvrir un ticket' },
                { name: 'Statut', value: '❌ | Non traitée' }
            )
            .setColor('#FFA500');

        const alertChannel = member.guild.channels.cache.get(alertChannelId);
        if (alertChannel) {
            // Envoyer la mention du rôle vérificateur avec l'embed
            alertChannel.send({
                content: `<@&${verifierRole.id}>`,
                embeds: [alertEmbed]
            })
            .then(message => {
                message.react('🟠')
                    .then(() => message.react('✅'))
                    .then(() => message.react('👼'))
                    .catch(error => console.error('Erreur lors de l\'ajout des réactions :', error));
            })
            .catch(error => console.error('Erreur lors de l\'envoi du message d\'alerte :', error));
        } else {
            console.error('Le salon d\'alerte n\'a pas été trouvé');
        }
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.message.channel.id === alertChannelId) {
        const { message } = reaction;
        const embed = message.embeds[0];
        const memberIdMatch = embed.description.match(/<@(\d+)>/);

        if (!memberIdMatch) {
            console.error('ID de membre non trouvé dans la description de l\'embed');
            return;
        }

        const memberId = memberIdMatch[1];
        const guild = reaction.message.guild;
        const member = guild.members.cache.get(memberId);

        if (!member) {
            console.error('Membre non trouvé dans la cache de la guilde :', memberId);
            return;
        }

        // Vérifiez que le ticket est en cours pour les réactions ✅ et 👼
        if (reaction.emoji.name === '🟠') {
            if (ticketChannel[message.id]) {
                await message.reply(`Un salon privé est déjà en cours pour cette alerte.`);
                return;
            }

            const updatedEmbed = EmbedBuilder.from(embed)
                .setFields([{ name: 'Statut', value: '🟠 | En cours de traitement' }]);
            await message.edit({ embeds: [updatedEmbed] });
            await message.reply(`L'alerte est marquée comme en cours de traitement.`);
            await reaction.users.remove(user.id); // Retirer la réaction pour éviter les duplications

        } else if (reaction.emoji.name === '✅') {
            const updatedEmbed = EmbedBuilder.from(embed)
                .setFields([{ name: 'Statut', value: `✅ | Traité par ${user.username}` }]);
            await message.edit({ embeds: [updatedEmbed] });
            await message.reply(`L'alerte est marquée comme traitée par ${user.username}`);
            await message.reactions.removeAll(); // Retirer toutes les réactions
            await reaction.users.remove(user.id); // Retirer la réaction ✅

            // Nettoyer le ticket en cours
            if (ticketChannel[message.id]) {
                const messages = await ticketChannel[message.id].messages.fetch({ limit: 100 });
                const messageLog = messages.map(m => `${m.author.tag}: ${m.content}`).reverse().join('\n');
                const filePath = `./transcription-${member.user.id}.txt`;
                fs.writeFileSync(filePath, messageLog);

                const logsChannel = guild.channels.cache.get(logsChannelId);
                if (logsChannel) {
                    const attachment = new AttachmentBuilder(filePath);
                    logsChannel.send({ content: `Transcription du ticket de ${member.user.tag}:`, files: [attachment] })
                        .then(() => {
                            fs.unlinkSync(filePath);
                        })
                        .catch(console.error);
                } else {
                    console.error('Le salon de logs n\'a pas été trouvé');
                }

                await ticketChannel[message.id].delete();
                console.log(`Le salon ${ticketChannel[message.id].name} a été supprimé.`);
                delete ticketChannel[message.id]; // Supprimer l'entrée du salon
            }

        } else if (reaction.emoji.name === '👼') {
            if (ticketChannel[message.id]) {
                await message.reply(`Un salon privé a déjà été créé pour cette alerte.`);
                return;
            }

            const newTicketChannel = await guild.channels.create({
                name: `ticket-${member.user.username}`,
                type: ChannelType.GuildText,
                parent: ticketCategoryID,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: verifierRoleId,
                        allow: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: member.id,
                        allow: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel],
                    },
                ],
            });

            ticketChannel[message.id] = newTicketChannel;

            const ticketEmbed = new EmbedBuilder()
                .setColor(0x00FFFF)
                .setTitle('Ticket de vérification')
                .setDescription(`Ce salon a été ouvert pour discuter du rôle mineur de ${member}. \n\n**Créé par :** ${user.username}`)
                .setTimestamp();

            await newTicketChannel.send({ embeds: [ticketEmbed] });
            await newTicketChannel.send(getGreetingMessage(member.user));
            await message.reply(`Un salon privé a été créé pour discuter de l'alerte.`);
            await reaction.users.remove(user.id); // Retirer la réaction pour éviter les duplications
            ticketInProgress[message.id] = user.id; // Marquer le ticket comme en cours
        }
    }
});

client.on('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
});

client.login(TOKEN).catch(err => {
    console.error('Impossible de se connecter avec le token fourni:', err);
});
